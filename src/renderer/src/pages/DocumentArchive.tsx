import { useState } from 'react'
import { Typography, Button, Space, Input, Select, Popconfirm, Tag, message } from 'antd'
import {
  FolderOpenOutlined,
  FileWordOutlined,
  DeleteOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { ProTable, type ProColumns } from '@ant-design/pro-components'
import { useGeneratedDocuments } from '@renderer/hooks/useDocuments'
import type { GeneratedDocumentListItem } from '@shared/types/document'

const { Title } = Typography

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  order: { label: 'Наказ', color: 'blue' },
  leave_ticket: { label: 'Відпускний квиток', color: 'green' },
  injury_certificate: { label: 'Довідка поранення', color: 'orange' },
  report: { label: 'Рапорт', color: 'cyan' },
  certificate: { label: 'Довідка', color: 'purple' },
  notification: { label: 'Повідомлення', color: 'gold' }
}

export default function DocumentArchive(): JSX.Element {
  const [search, setSearch] = useState('')
  const [docType, setDocType] = useState<string | undefined>()
  const { documents, loading, refetch } = useGeneratedDocuments({
    search,
    documentType: docType
  })

  const handleOpen = async (filePath: string): Promise<void> => {
    await window.api.documentsOpen(filePath)
  }

  const handleDelete = async (id: number): Promise<void> => {
    const result = await window.api.documentsDelete(id)
    if (result?.success) {
      message.success('Документ видалено')
      refetch()
    } else {
      message.error('Помилка видалення')
    }
  }

  const columns: ProColumns<GeneratedDocumentListItem>[] = [
    {
      title: 'Назва',
      dataIndex: 'title',
      ellipsis: true,
      render: (_, record) => (
        <Space>
          <FileWordOutlined style={{ color: '#2b579a' }} />
          {record.title ?? 'Без назви'}
        </Space>
      )
    },
    {
      title: 'Тип',
      dataIndex: 'documentType',
      width: 180,
      render: (_, record) => {
        const info = TYPE_LABELS[record.documentType]
        return info ? (
          <Tag color={info.color}>{info.label}</Tag>
        ) : (
          <Tag>{record.documentType}</Tag>
        )
      }
    },
    {
      title: 'Шаблон',
      dataIndex: 'templateName',
      width: 200,
      render: (text) => text ?? '—'
    },
    {
      title: 'Дата',
      dataIndex: 'generatedAt',
      width: 160,
      render: (_, record) => {
        if (!record.generatedAt) return '—'
        const d = new Date(record.generatedAt)
        return d.toLocaleString('uk-UA', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      },
      sorter: (a, b) =>
        new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime(),
      defaultSortOrder: 'descend'
    },
    {
      title: 'Дії',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={() => handleOpen(record.filePath)}
          >
            Відкрити
          </Button>
          <Popconfirm
            title="Видалити документ?"
            onConfirm={() => handleDelete(record.id)}
            okText="Так"
            cancelText="Ні"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">документи · архів</div>
          <h1>Архів документів</h1>
          <div className="sub">Згенеровані документи · накази · рапорти</div>
        </div>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Пошук..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 260 }}
        />
        <Select
          placeholder="Тип документа"
          value={docType}
          onChange={setDocType}
          allowClear
          style={{ width: 200 }}
          options={Object.entries(TYPE_LABELS).map(([value, { label }]) => ({
            value,
            label
          }))}
        />
      </Space>

      <ProTable<GeneratedDocumentListItem>
        columns={columns}
        dataSource={documents}
        rowKey="id"
        loading={loading}
        search={false}
        toolBarRender={false}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />
    </div>
  )
}
