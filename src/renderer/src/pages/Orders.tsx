import { useState } from 'react'
import {
  Typography,
  Button,
  Space,
  Tag,
  Popconfirm,
  Drawer,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Divider
} from 'antd'
import {
  FileProtectOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  MinusCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import { ProTable, type ProColumns } from '@ant-design/pro-components'
import { useOrderList } from '@renderer/hooks/useOrders'
import PersonnelSearchSelect from '@renderer/components/movements/PersonnelSearchSelect'
import type { OrderListItem } from '@shared/types/document'
import dayjs from 'dayjs'

const { Title } = Typography
const { TextArea } = Input

const ORDER_TYPES: Record<string, { label: string; color: string }> = {
  personnel: { label: 'По ОС', color: 'blue' },
  movement: { label: 'Переміщення', color: 'cyan' },
  leave: { label: 'Відпустка', color: 'green' },
  discipline: { label: 'Дисципліна', color: 'red' },
  duty: { label: 'Наряд', color: 'orange' },
  other: { label: 'Інший', color: 'default' }
}

export default function Orders(): JSX.Element {
  const [search, setSearch] = useState('')
  const [orderType, setOrderType] = useState<string | undefined>()
  const { orders, loading, refetch } = useOrderList({ search, orderType })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false)
  const [viewOrder, setViewOrder] = useState<OrderListItem | null>(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const result = await window.api.ordersCreate({
        orderType: values.orderType,
        orderNumber: values.orderNumber,
        orderDate: values.orderDate.format('YYYY-MM-DD'),
        subject: values.subject || '',
        bodyText: values.bodyText || '',
        signedBy: values.signedBy || '',
        items: (values.items ?? []).map(
          (item: { personnelId?: number; actionType?: string; description?: string }, i: number) => ({
            personnelId: item.personnelId ?? null,
            actionType: item.actionType || '',
            description: item.description || '',
            sortOrder: i
          })
        )
      })

      if (result?.success) {
        message.success('Наказ створено')
        setDrawerOpen(false)
        form.resetFields()
        refetch()
      } else {
        message.error(result?.error ?? 'Помилка створення')
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number): Promise<void> => {
    const result = await window.api.ordersDelete(id)
    if (result?.success) {
      message.success('Наказ видалено')
      refetch()
    } else {
      message.error('Помилка видалення')
    }
  }

  const handleView = async (record: OrderListItem): Promise<void> => {
    setViewOrder(record)
    setViewDrawerOpen(true)
  }

  const handleGenerateDoc = (): void => {
    // Navigate to DocumentGenerator — just open it (user picks template there)
    message.info('Перейдіть до Генератора документів та оберіть шаблон "Наказ по ОС"')
  }

  const columns: ProColumns<OrderListItem>[] = [
    {
      title: '№',
      dataIndex: 'orderNumber',
      width: 100,
      ellipsis: true
    },
    {
      title: 'Тип',
      dataIndex: 'orderType',
      width: 140,
      render: (_, record) => {
        const info = ORDER_TYPES[record.orderType]
        return info ? (
          <Tag color={info.color}>{info.label}</Tag>
        ) : (
          <Tag>{record.orderType}</Tag>
        )
      }
    },
    {
      title: 'Дата',
      dataIndex: 'orderDate',
      width: 120,
      render: (_, record) =>
        record.orderDate ? dayjs(record.orderDate).format('DD.MM.YYYY') : '—'
    },
    {
      title: 'Предмет',
      dataIndex: 'subject',
      ellipsis: true,
      render: (_, record) => record.subject || '—'
    },
    {
      title: 'Пунктів',
      dataIndex: 'itemsCount',
      width: 90,
      align: 'center'
    },
    {
      title: 'Підписант',
      dataIndex: 'signedBy',
      width: 180,
      ellipsis: true,
      render: (_, record) => record.signedBy || '—'
    },
    {
      title: 'Дії',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            Перегляд
          </Button>
          <Popconfirm
            title="Видалити наказ?"
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
          <div className="eyebrow">документи · накази</div>
          <h1>Накази</h1>
          <div className="sub">Журнал наказів за період · підстава для переміщень та статусів</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={handleGenerateDoc}>
            <FileTextOutlined />
            Згенерувати документ
          </button>
          <button className="btn primary" onClick={() => setDrawerOpen(true)}>
            <PlusOutlined />
            Новий наказ
          </button>
        </div>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Пошук за номером, предметом..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
        <Select
          placeholder="Тип наказу"
          value={orderType}
          onChange={setOrderType}
          allowClear
          style={{ width: 180 }}
          options={Object.entries(ORDER_TYPES).map(([value, { label }]) => ({
            value,
            label
          }))}
        />
      </Space>

      <ProTable<OrderListItem>
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        search={false}
        toolBarRender={false}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

      {/* Create Drawer */}
      <Drawer
        title="Новий наказ"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Скасувати</Button>
            <Button type="primary" loading={submitting} onClick={handleCreate}>
              Створити
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="orderType"
            label="Тип наказу"
            rules={[{ required: true, message: 'Оберіть тип' }]}
          >
            <Select
              placeholder="Оберіть тип наказу"
              options={Object.entries(ORDER_TYPES).map(([value, { label }]) => ({
                value,
                label
              }))}
            />
          </Form.Item>

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item
              name="orderNumber"
              label="Номер наказу"
              rules={[{ required: true, message: 'Введіть номер' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="№" />
            </Form.Item>

            <Form.Item
              name="orderDate"
              label="Дата наказу"
              rules={[{ required: true, message: 'Оберіть дату' }]}
            >
              <DatePicker format="DD.MM.YYYY" placeholder="Дата" style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Form.Item name="subject" label="Предмет наказу">
            <Input placeholder="Предмет наказу" />
          </Form.Item>

          <Form.Item name="bodyText" label="Текст наказу">
            <TextArea rows={4} placeholder="Основний текст наказу" />
          </Form.Item>

          <Form.Item name="signedBy" label="Підписант">
            <Input placeholder="Звання та ПІБ командира" />
          </Form.Item>

          <Divider>Пункти наказу</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginBottom: 8,
                      alignItems: 'flex-start'
                    }}
                  >
                    <Form.Item
                      {...restField}
                      name={[name, 'personnelId']}
                      style={{ flex: 1, marginBottom: 0 }}
                    >
                      <PersonnelSearchSelect placeholder="Особа (необов'язково)" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'actionType']}
                      style={{ width: 140, marginBottom: 0 }}
                    >
                      <Select
                        placeholder="Тип"
                        allowClear
                        options={[
                          { value: 'enroll', label: 'Зарахувати' },
                          { value: 'exclude', label: 'Виключити' },
                          { value: 'transfer', label: 'Перевести' },
                          { value: 'leave', label: 'Відпустка' },
                          { value: 'duty', label: 'Наряд' },
                          { value: 'other', label: 'Інше' }
                        ]}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'description']}
                      style={{ flex: 2, marginBottom: 0 }}
                    >
                      <Input placeholder="Опис пункту" />
                    </Form.Item>
                    <MinusCircleOutlined
                      onClick={() => remove(name)}
                      style={{ marginTop: 8, color: '#ff4d4f' }}
                    />
                  </div>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add()}
                  block
                  icon={<PlusOutlined />}
                >
                  Додати пункт
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>

      {/* View Drawer */}
      <Drawer
        title={`Наказ № ${viewOrder?.orderNumber ?? ''}`}
        open={viewDrawerOpen}
        onClose={() => setViewDrawerOpen(false)}
        width={520}
      >
        {viewOrder && (
          <div>
            <p>
              <strong>Тип:</strong>{' '}
              <Tag color={ORDER_TYPES[viewOrder.orderType]?.color}>
                {ORDER_TYPES[viewOrder.orderType]?.label ?? viewOrder.orderType}
              </Tag>
            </p>
            <p>
              <strong>Дата:</strong> {dayjs(viewOrder.orderDate).format('DD.MM.YYYY')}
            </p>
            <p>
              <strong>Предмет:</strong> {viewOrder.subject || '—'}
            </p>
            <p>
              <strong>Текст:</strong>
            </p>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
              {viewOrder.bodyText || '—'}
            </pre>
            <p>
              <strong>Підписант:</strong> {viewOrder.signedBy || '—'}
            </p>
            <p>
              <strong>Кількість пунктів:</strong> {viewOrder.itemsCount}
            </p>
          </div>
        )}
      </Drawer>
    </div>
  )
}
