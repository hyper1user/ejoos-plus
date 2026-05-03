import { useMemo } from 'react'
import { Card, Table, Tag, Space, Progress, Typography } from 'antd'
import { FileTextOutlined, TeamOutlined } from '@ant-design/icons'
import { usePositionList } from '../hooks/usePositions'
import { useLookups } from '../hooks/useLookups'
import { useAppStore } from '../stores/app.store'
import type { PositionListItem } from '@shared/types/position'

const { Title, Text } = Typography

interface SubdivisionGroup {
  subdivisionId: number
  subdivisionCode: string
  subdivisionName: string
  positions: PositionListItem[]
  staffCount: number
  filledCount: number
  vacantCount: number
  fillPercent: number
}

export default function StaffingTable(): JSX.Element {
  const { subdivisions } = useLookups()
  const globalSubdivision = useAppStore((s) => s.globalSubdivision)

  const globalSubdivisionId = useMemo(() => {
    if (!globalSubdivision) return undefined
    return subdivisions.find((s) => s.code === globalSubdivision)?.id
  }, [globalSubdivision, subdivisions])

  const { data, loading } = usePositionList({
    subdivisionId: globalSubdivisionId
  })

  // Group positions by subdivision
  const groups = useMemo(() => {
    const map = new Map<number, PositionListItem[]>()
    for (const pos of data) {
      const list = map.get(pos.subdivisionId) || []
      list.push(pos)
      map.set(pos.subdivisionId, list)
    }

    const result: SubdivisionGroup[] = []
    for (const [subdivisionId, positions] of map) {
      const activePositions = positions.filter((p) => p.isActive)
      const staffCount = activePositions.length
      const filledCount = activePositions.filter((p) => p.occupantId).length
      const vacantCount = staffCount - filledCount
      const fillPercent = staffCount > 0 ? Math.round((filledCount / staffCount) * 100) : 0

      result.push({
        subdivisionId,
        subdivisionCode: positions[0]?.subdivisionCode ?? '',
        subdivisionName: positions[0]?.subdivisionName ?? '',
        positions,
        staffCount,
        filledCount,
        vacantCount,
        fillPercent
      })
    }

    result.sort((a, b) => a.subdivisionCode.localeCompare(b.subdivisionCode))
    return result
  }, [data])

  // Summary totals
  const totalStaff = groups.reduce((s, g) => s + g.staffCount, 0)
  const totalFilled = groups.reduce((s, g) => s + g.filledCount, 0)
  const totalVacant = groups.reduce((s, g) => s + g.vacantCount, 0)
  const totalPercent = totalStaff > 0 ? Math.round((totalFilled / totalStaff) * 100) : 0


  const positionColumns = [
    {
      title: 'Індекс',
      dataIndex: 'positionIndex',
      width: 100
    },
    {
      title: 'Посада',
      dataIndex: 'title',
      ellipsis: true
    },
    {
      title: 'Деталі',
      dataIndex: 'detail',
      width: 150,
      render: (val: string | null) => val || '—'
    },
    {
      title: 'Необх. звання',
      dataIndex: 'rankRequired',
      width: 130,
      render: (val: string | null) => val || '—'
    },
    {
      title: 'Зайнято / Особа',
      key: 'occupant',
      width: 280,
      render: (_: unknown, record: PositionListItem) => {
        if (!record.isActive)
          return (
            <Text delete type="secondary">
              Деактивована
            </Text>
          )
        if (!record.occupantId) return <Tag color="orange">ВАКАНТНА</Tag>
        return (
          <Space size={4}>
            <Tag color="green">{record.occupantRank}</Tag>
            <span>{record.occupantName}</span>
          </Space>
        )
      }
    }
  ]

  return (
    <div>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">штат · посадовий облік</div>
          <h1>ШПО — Штатно-посадовий облік</h1>
          <div className="sub">
            Штат: {totalStaff} · Факт: {totalFilled} · Вакантних: {totalVacant} · Заповнено {totalPercent}%
          </div>
        </div>
      </div>

      {/* Прогрес-картка */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <Space size="large" wrap>
          <Space>
            <TeamOutlined />
            <Text strong>Загальна укомплектованість:</Text>
          </Space>
          <Tag color="blue">Штат: {totalStaff}</Tag>
          <Tag color="green">Факт: {totalFilled}</Tag>
          <Tag color="orange">Вакантних: {totalVacant}</Tag>
          <Progress
            percent={totalPercent}
            size="small"
            style={{ width: 200 }}
            strokeColor={totalPercent >= 80 ? '#52c41a' : totalPercent >= 50 ? '#faad14' : '#ff4d4f'}
          />
        </Space>
      </div>

      {/* Groups */}
      {groups.map((group) => (
        <Card
          key={group.subdivisionId}
          size="small"
          title={
            <Space>
              <Tag color="blue">{group.subdivisionCode}</Tag>
              <Text strong>{group.subdivisionName}</Text>
              <Tag>Штат: {group.staffCount}</Tag>
              <Tag color="green">Факт: {group.filledCount}</Tag>
              {group.vacantCount > 0 && <Tag color="orange">Вакантних: {group.vacantCount}</Tag>}
              <Progress
                percent={group.fillPercent}
                size="small"
                style={{ width: 120 }}
                strokeColor={
                  group.fillPercent >= 80
                    ? '#52c41a'
                    : group.fillPercent >= 50
                      ? '#faad14'
                      : '#ff4d4f'
                }
              />
            </Space>
          }
          style={{ marginBottom: 8 }}
        >
          <Table
            columns={positionColumns}
            dataSource={group.positions}
            rowKey="id"
            size="small"
            pagination={false}
            loading={loading}
            rowClassName={(record: PositionListItem) => {
              if (!record.isActive) return 'row-deactivated'
              if (!record.occupantId) return 'row-vacant'
              return ''
            }}
          />
        </Card>
      ))}

      {groups.length === 0 && !loading && (
        <Card>
          <Text type="secondary">Посади не знайдено</Text>
        </Card>
      )}

    </div>
  )
}
