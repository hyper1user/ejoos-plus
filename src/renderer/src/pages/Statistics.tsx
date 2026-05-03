import { Tabs, Card, Spin, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import {
  useStatisticsSummary,
  useStatisticsByStatus,
  useStatisticsBySubdivision
} from '../hooks/useStatistics'
import type { StatusStatItem, SubdivisionStatItem } from '../hooks/useStatistics'

const CATEGORY_COLORS: Record<string, string> = {
  'Офіцери': '#1890ff',
  'Сержанти': '#52c41a',
  'Солдати': '#faad14',
  'Працівники': '#722ed1',
  'Невизначено': '#999'
}

// --- Tab 1: By Status ---
function StatusTab(): JSX.Element {
  const { data, loading } = useStatisticsByStatus()

  const columns: ColumnsType<StatusStatItem> = [
    {
      title: 'Код',
      dataIndex: 'statusCode',
      width: 100
    },
    {
      title: 'Назва статусу',
      dataIndex: 'statusName'
    },
    {
      title: 'Група',
      dataIndex: 'groupName',
      render: (val: string, record) => (
        <Tag color={record.color}>{val}</Tag>
      )
    },
    {
      title: 'Кількість',
      dataIndex: 'count',
      width: 100,
      sorter: (a, b) => a.count - b.count,
      defaultSortOrder: 'descend'
    }
  ]

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <ResponsiveContainer width="100%" height={360}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="statusName"
              cx="50%"
              cy="50%"
              outerRadius={130}
              label={({ statusName, count }) => `${statusName}: ${count}`}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color ?? '#999'} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <Table
          rowKey="statusCode"
          columns={columns}
          dataSource={data}
          pagination={false}
          size="small"
          summary={() => {
            const total = data.reduce((acc, r) => acc + r.count, 0)
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}>
                  <strong>Всього</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <strong>{total}</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )
          }}
        />
      </Card>
    </div>
  )
}

// --- Tab 2: By Subdivision ---
function SubdivisionTab(): JSX.Element {
  const { data, loading } = useStatisticsBySubdivision()

  const columns: ColumnsType<SubdivisionStatItem> = [
    { title: 'Підрозділ', dataIndex: 'subdivisionName' },
    {
      title: 'Всього',
      dataIndex: 'total',
      width: 90,
      sorter: (a, b) => a.total - b.total,
      defaultSortOrder: 'descend'
    },
    {
      title: 'На забезпеченні',
      dataIndex: 'onSupply',
      width: 140,
      render: (v: number) => <span style={{ color: '#52c41a' }}>{v}</span>
    },
    {
      title: 'Не на забезпеченні',
      dataIndex: 'offSupply',
      width: 160,
      render: (v: number) => <span style={{ color: '#faad14' }}>{v}</span>
    }
  ]

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <ResponsiveContainer width="100%" height={Math.max(300, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="subdivisionName" width={110} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="onSupply" name="На забезпеченні" stackId="a" fill="#52c41a" />
            <Bar dataKey="offSupply" name="Не на забезпеченні" stackId="a" fill="#faad14" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <Table
          rowKey="subdivisionCode"
          columns={columns}
          dataSource={data}
          pagination={false}
          size="small"
          summary={() => {
            const totals = data.reduce(
              (acc, r) => ({
                total: acc.total + r.total,
                onSupply: acc.onSupply + r.onSupply,
                offSupply: acc.offSupply + r.offSupply
              }),
              { total: 0, onSupply: 0, offSupply: 0 }
            )
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <strong>Всього</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <strong>{totals.total}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <strong style={{ color: '#52c41a' }}>{totals.onSupply}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3}>
                  <strong style={{ color: '#faad14' }}>{totals.offSupply}</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )
          }}
        />
      </Card>
    </div>
  )
}

// --- Tab 3: By Category ---
function CategoryTab(): JSX.Element {
  const { data: summary, loading } = useStatisticsSummary()

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />

  const chartData = summary.byCategory.map((item) => ({
    ...item,
    fill: CATEGORY_COLORS[item.category] ?? '#999'
  }))

  const total = chartData.reduce((acc, r) => acc + r.count, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="Кількість">
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <Table
          rowKey="category"
          dataSource={chartData}
          pagination={false}
          size="small"
          columns={[
            {
              title: 'Категорія',
              dataIndex: 'category',
              render: (val: string) => (
                <Tag color={CATEGORY_COLORS[val] ?? '#999'}>{val}</Tag>
              )
            },
            { title: 'Кількість', dataIndex: 'count', width: 100 },
            {
              title: '%',
              key: 'percent',
              width: 100,
              render: (_: unknown, record: { count: number }) =>
                total > 0 ? `${((record.count / total) * 100).toFixed(1)}%` : '0%'
            }
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>
                <strong>Всього</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                <strong>{total}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2}>
                <strong>100%</strong>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </div>
  )
}

// --- Main ---
export default function Statistics(): JSX.Element {
  return (
    <>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">аналітика · поточний стан</div>
          <h1>Статистика</h1>
          <div className="sub">
            Розподіл особового складу за статусами, підрозділами та категоріями
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: 14 }}>
        <Tabs
          defaultActiveKey="status"
          items={[
            { key: 'status', label: 'По статусах', children: <StatusTab /> },
            { key: 'subdivision', label: 'По підрозділах', children: <SubdivisionTab /> },
            { key: 'category', label: 'По категоріях', children: <CategoryTab /> }
          ]}
        />
      </div>
    </>
  )
}
