import { useState, useMemo } from 'react'
import { Button, Space, Tag, Segmented, Input, Popconfirm, message } from 'antd'
import { PlusOutlined, BankOutlined, EditOutlined } from '@ant-design/icons'
import { ProTable, type ProColumns } from '@ant-design/pro-components'
import { usePositionList } from '../hooks/usePositions'
import { useLookups } from '../hooks/useLookups'
import { useAppStore } from '../stores/app.store'
import PositionForm from '../components/positions/PositionForm'
import type { PositionListItem } from '@shared/types/position'

type OccupancyFilter = 'all' | 'occupied' | 'vacant' | 'deactivated'

export default function PositionRegistry(): JSX.Element {
  const [occupancy, setOccupancy] = useState<OccupancyFilter>('all')
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<PositionListItem | null>(null)

  const { subdivisions } = useLookups()
  const globalSubdivision = useAppStore((s) => s.globalSubdivision)

  // Map global subdivision code → numeric id
  const globalSubdivisionId = useMemo(() => {
    if (!globalSubdivision) return undefined
    return subdivisions.find((s) => s.code === globalSubdivision)?.id
  }, [globalSubdivision, subdivisions])

  const { data, loading, refetch } = usePositionList({
    occupancy,
    search: search || undefined,
    subdivisionId: globalSubdivisionId
  })

  const handleEdit = (record: PositionListItem) => {
    setEditRecord(record)
    setDrawerOpen(true)
  }

  const handleToggleActive = async (record: PositionListItem) => {
    const result = await window.api.positionsUpdate(record.id, { isActive: !record.isActive })
    if (result && 'error' in result) {
      message.error('Помилка оновлення')
      return
    }
    message.success(record.isActive ? 'Посаду деактивовано' : 'Посаду активовано')
    refetch()
  }

  const handleAdd = () => {
    setEditRecord(null)
    setDrawerOpen(true)
  }

  // Summary stats
  const total = data.length
  const occupied = data.filter((p) => p.isActive && p.occupantId).length
  const vacant = data.filter((p) => p.isActive && !p.occupantId).length
  const deactivated = data.filter((p) => !p.isActive).length

  const columns: ProColumns<PositionListItem>[] = [
    {
      title: 'Індекс',
      dataIndex: 'positionIndex',
      width: 110,
      sorter: (a, b) => a.positionIndex.localeCompare(b.positionIndex)
    },
    {
      title: 'Підрозділ',
      dataIndex: 'subdivisionName',
      width: 120,
      render: (_, record) => (
        <Tag>{record.subdivisionCode} — {record.subdivisionName}</Tag>
      )
    },
    {
      title: 'Посада',
      dataIndex: 'title',
      ellipsis: true
    },
    {
      title: 'Деталі',
      dataIndex: 'detail',
      width: 160,
      ellipsis: true,
      render: (val) => val || '—'
    },
    {
      title: 'Необх. звання',
      dataIndex: 'rankRequired',
      width: 140,
      render: (val) => val || '—'
    },
    {
      title: 'Особа',
      key: 'occupant',
      width: 220,
      render: (_, record) => {
        if (!record.isActive) return <Tag>Деактивована</Tag>
        if (!record.occupantId) return <Tag color="orange">Вакантна</Tag>
        return (
          <Space size={4}>
            <Tag color="green">{record.occupantRank}</Tag>
            <span>{record.occupantName}</span>
          </Space>
        )
      }
    },
    {
      title: 'Статус',
      key: 'status',
      width: 100,
      render: (_, record) =>
        record.isActive ? (
          <Tag color="green">Активна</Tag>
        ) : (
          <Tag color="default">Неактивна</Tag>
        )
    },
    {
      title: 'Дії',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Ред.
          </Button>
          <Popconfirm
            title={record.isActive ? 'Деактивувати посаду?' : 'Активувати посаду?'}
            onConfirm={() => handleToggleActive(record)}
          >
            <Button type="link" size="small" danger={record.isActive}>
              {record.isActive ? 'Деакт.' : 'Акт.'}
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">штат · перелік посад</div>
          <h1>Перелік посад</h1>
          <div className="sub">
            {total} всього · {occupied} зайнятих · {vacant} вакантних
            {deactivated > 0 ? ` · ${deactivated} неактивних` : ''}
          </div>
        </div>
      </div>
      <ProTable<PositionListItem>
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        search={false}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `Всього: ${t}` }}
        dateFormatter="string"
        rowClassName={(record) => {
          if (!record.isActive) return 'row-deactivated'
          if (!record.occupantId) return 'row-vacant'
          return ''
        }}
        toolbar={{
          actions: [
            <Input.Search
              key="search"
              placeholder="Пошук..."
              allowClear
              style={{ width: 200 }}
              onSearch={setSearch}
            />,
            <Segmented
              key="occupancy"
              value={occupancy}
              onChange={(val) => setOccupancy(val as OccupancyFilter)}
              options={[
                { label: 'Всі', value: 'all' },
                { label: 'Зайняті', value: 'occupied' },
                { label: 'Вакантні', value: 'vacant' },
                { label: 'Деактивовані', value: 'deactivated' }
              ]}
            />,
            <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Додати посаду
            </Button>
          ]
        }}
      />

      <PositionForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={refetch}
        editRecord={editRecord}
      />

    </>
  )
}
