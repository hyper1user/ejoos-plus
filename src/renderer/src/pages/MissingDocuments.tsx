import { useState, useCallback } from 'react'
import { Table, Button, Space, Tag, Typography, Alert, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SyncOutlined, FileExcelOutlined, WarningOutlined, LinkOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ExcelJS from 'exceljs'

const { Title, Text } = Typography

interface MissingEntry {
  id: number
  fullName: string
  subdivision: string | null
  missingDocs: string[]
}

const DOC_COLORS: Record<string, string> = {
  'Військовий квиток': 'red',
  'Паспорт або ID-картка': 'orange',
  'ІПН': 'volcano'
}

export default function MissingDocuments(): JSX.Element {
  const navigate = useNavigate()
  const [data, setData] = useState<MissingEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [noRoot, setNoRoot] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setNoRoot(false)
    try {
      const result = await window.api.docsMissingReport()
      if (result === null || result === undefined) {
        setNoRoot(true)
        setData([])
      } else {
        setData(result as MissingEntry[])
        setLoaded(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleExport = async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Відсутні документи')

    ws.columns = [
      { header: '№', key: 'num', width: 5 },
      { header: 'ПІБ', key: 'fullName', width: 35 },
      { header: 'Підрозділ', key: 'subdivision', width: 20 },
      { header: 'Відсутні документи', key: 'missingDocs', width: 50 }
    ]

    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
    headerRow.alignment = { horizontal: 'center' }

    data.forEach((entry, i) => {
      ws.addRow({
        num: i + 1,
        fullName: entry.fullName,
        subdivision: entry.subdivision ?? '',
        missingDocs: entry.missingDocs.join(', ')
      })
    })

    ws.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
        if (rowNumber > 1) cell.alignment = { wrapText: true, vertical: 'top' }
      })
    })

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Відсутні документи.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns: ColumnsType<MissingEntry> = [
    {
      title: '№',
      key: 'num',
      width: 50,
      render: (_v, _r, i) => i + 1
    },
    {
      title: 'ПІБ',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (name: string, record: MissingEntry) => (
        <Button
          type="link"
          size="small"
          icon={<LinkOutlined />}
          style={{ padding: 0, height: 'auto' }}
          onClick={() => navigate(`/personnel/${record.id}`)}
        >
          {name}
        </Button>
      )
    },
    {
      title: 'Підрозділ',
      dataIndex: 'subdivision',
      key: 'subdivision',
      width: 160,
      render: (v: string | null) => v ?? '—'
    },
    {
      title: 'Відсутні документи',
      dataIndex: 'missingDocs',
      key: 'missingDocs',
      render: (docs: string[]) => (
        <Space wrap size={4}>
          {docs.map((doc) => (
            <Tag key={doc} color={DOC_COLORS[doc] ?? 'default'} icon={<WarningOutlined />}>
              {doc}
            </Tag>
          ))}
        </Space>
      )
    }
  ]

  return (
    <>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">документи · перевірка повноти</div>
          <h1>Відсутні документи</h1>
          <div className="sub">
            {loaded ? `Знайдено ${data.length} осіб з відсутніми документами` : 'Натисніть «Перевірити» для запуску сканування'}
          </div>
        </div>
        <div className="actions">
          {loaded && data.length > 0 && (
            <button className="btn" onClick={handleExport}>
              <FileExcelOutlined />
              Експорт .xlsx
            </button>
          )}
          <button className="btn primary" onClick={load} disabled={loading}>
            <SyncOutlined spin={loading} />
            {loaded ? 'Оновити' : 'Перевірити'}
          </button>
        </div>
      </div>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {noRoot && (
        <Alert
          type="warning"
          showIcon
          message="Папку документів не налаштовано"
          description={
            <Text>
              Перейдіть у <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate('/settings')}>Налаштування</Button> та вкажіть корінну папку з документами особового складу.
            </Text>
          }
        />
      )}

      {!loaded && !loading && !noRoot && (
        <Alert
          type="info"
          showIcon
          message="Натисніть «Перевірити» для сканування папок з документами"
          description="Перевіряються: Військовий квиток (обов'язково), Паспорт або ID-картка (одне з двох), ІПН (лише якщо є Паспорт, без ID-картки)."
        />
      )}

      {loaded && (
        <Alert
          type={data.length === 0 ? 'success' : 'warning'}
          showIcon
          message={
            data.length === 0
              ? 'Усі документи в наявності — відсутніх не виявлено'
              : `Виявлено ${data.length} військовослужбовців з відсутніми документами`
          }
        />
      )}

      {loaded && data.length > 0 && (
        <Table
          rowKey="id"
          dataSource={data}
          columns={columns}
          size="small"
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `Всього: ${t}` }}
        />
      )}
    </Space>
    </>
  )
}
