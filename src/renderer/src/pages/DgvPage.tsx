import { useState, useRef } from 'react'
import { Card, DatePicker, Button, Space, Spin, message, Typography, theme, Input, Collapse } from 'antd'
import { DollarOutlined, FileExcelOutlined, SettingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useDgvMonth } from '../hooks/useDgv'
import DgvGrid from '../components/dgv/DgvGrid'

const { Title, Text } = Typography
const { TextArea } = Input

export default function DgvPage(): JSX.Element {
  const { token } = theme.useToken()
  const today = dayjs()
  const [year, setYear] = useState(today.year())
  const [month, setMonth] = useState(today.month() + 1)
  const [exporting, setExporting] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)

  const { data, loading, refetch } = useDgvMonth(year, month)

  const grounds100Ref = useRef<string>('')
  const grounds30Ref = useRef<string>('')

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`

  const handleMonthChange = (value: dayjs.Dayjs | null) => {
    if (value) {
      setYear(value.year())
      setMonth(value.month() + 1)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await window.api.dgvExportReport(year, month)
      if (result.success) {
        message.success(`Рапорт збережено: ${result.filePath}`)
      } else if (result.error) {
        message.error(`Помилка: ${result.error}`)
      }
    } catch (err) {
      message.error(`Помилка експорту: ${err}`)
    } finally {
      setExporting(false)
    }
  }

  const handleSaveGrounds = async (key: string, value: string) => {
    setSavingMeta(true)
    try {
      await window.api.dgvMetaSet(yearMonth, key, value)
    } catch (err) {
      message.error(`Помилка: ${err}`)
    } finally {
      setSavingMeta(false)
    }
  }

  // Sync refs when data loads
  if (data) {
    grounds100Ref.current = data.grounds100
    grounds30Ref.current = data.grounds30
  }

  return (
    <div style={{ padding: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            <DollarOutlined /> Грошове забезпечення (ДГВ)
          </Title>
          <Space>
            <DatePicker
              picker="month"
              value={dayjs(`${year}-${String(month).padStart(2, '0')}-01`)}
              onChange={handleMonthChange}
              allowClear={false}
              format="MMMM YYYY"
            />
            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              loading={exporting}
              onClick={handleExport}
            >
              Експорт рапорту
            </Button>
          </Space>
        </div>

        {/* Grounds settings */}
        <Collapse
          ghost
          style={{ marginBottom: 16 }}
          items={[{
            key: 'grounds',
            label: <Text type="secondary"><SettingOutlined /> Підстави для нарахування</Text>,
            children: (
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>
                    Підстави для 100 тис.:
                  </Text>
                  <TextArea
                    rows={3}
                    defaultValue={data?.grounds100 ?? ''}
                    key={`g100-${yearMonth}-${data?.grounds100}`}
                    placeholder="БР ОТУ, бойові розпорядження..."
                    onBlur={(e) => handleSaveGrounds('grounds_100', e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>
                    Підстави для 30 тис.:
                  </Text>
                  <TextArea
                    rows={3}
                    defaultValue={data?.grounds30 ?? ''}
                    key={`g30-${yearMonth}-${data?.grounds30}`}
                    placeholder="БР ОТУ, бойові розпорядження..."
                    onBlur={(e) => handleSaveGrounds('grounds_30', e.target.value)}
                  />
                </div>
              </div>
            )
          }]}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : data && data.rows.length > 0 ? (
          <>
            <div style={{ marginBottom: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Text type="secondary">
                Всього: <strong>{data.rows.length}</strong> ОС
                {data.rows.some((r) => r.isTransferredOut) && (
                  <> (з них вибулих: <strong>{data.rows.filter((r) => r.isTransferredOut).length}</strong>)</>
                )}
              </Text>
              <Text type="secondary">
                Правий клік на ПІБ — масове заповнення
              </Text>
            </div>
            <DgvGrid
              year={year}
              month={month}
              rows={data.rows}
              onRefetch={refetch}
            />
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 48, color: token.colorTextQuaternary }}>
            Немає активного особового складу для обраного місяця.
          </div>
        )}
      </Card>
    </div>
  )
}
