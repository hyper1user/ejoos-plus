import { useNavigate } from 'react-router-dom'
import { Button, Space, Popconfirm, message, Input } from 'antd'
import { EyeOutlined, UndoOutlined } from '@ant-design/icons'
import { ProTable, type ProColumns } from '@ant-design/pro-components'
import type { PersonnelListItem } from '@shared/types/personnel'
import RankBadge from '../components/personnel/RankBadge'
import { usePersonnelList } from '../hooks/usePersonnel'
import { useState, useMemo } from 'react'

export default function ExcludedPersonnel() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  // v0.9.4: фільтр subdivision='Г-3' прибрано. До v0.9.4 виключені, у яких
  // currentSubdivision != 'Г-3' (наприклад, виключення відбулось коли особа
  // була у розпорядженні — `currentSubdivision='розпорядження'`), не
  // показувались. Міграція `restoreSubdivisionForExcluded()` (v0.8.7) рятувала
  // лише NULL-кейс. Додаток для одного підрозділу — фільтр `status='excluded'`
  // достатній.
  const filters = useMemo(
    () => ({
      search: search || undefined,
      status: 'excluded'
    }),
    [search]
  )

  const { data, loading, refetch } = usePersonnelList(filters)

  const handleRestore = async (id: number) => {
    await window.api.personnelUpdate(id, { status: 'active' })
    message.success('Особу відновлено')
    refetch()
  }

  const columns: ProColumns<PersonnelListItem>[] = [
    {
      title: '№',
      dataIndex: 'index',
      valueType: 'indexBorder',
      width: 48
    },
    {
      title: 'ПІБ',
      dataIndex: 'fullName',
      ellipsis: true,
      width: 220,
      render: (_, record) => (
        <a onClick={() => navigate(`/personnel/${record.id}`)}>{record.fullName}</a>
      )
    },
    {
      title: 'Звання',
      dataIndex: 'rankName',
      width: 150,
      render: (_, record) => (
        <RankBadge rankName={record.rankName} category={record.rankCategory} />
      )
    },
    {
      title: 'Підрозділ',
      dataIndex: 'currentSubdivision',
      width: 120
    },
    {
      title: 'Посада',
      dataIndex: 'positionTitle',
      ellipsis: true,
      width: 180,
      render: (_, record) => record.positionTitle || record.currentPositionIdx || '—'
    },
    {
      title: 'Позивний',
      dataIndex: 'callsign',
      width: 100
    },
    {
      title: 'Телефон',
      dataIndex: 'phone',
      width: 140
    },
    {
      title: 'ІПН',
      dataIndex: 'ipn',
      width: 120
    },
    {
      title: 'Дії',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/personnel/${record.id}`)}
          />
          <Popconfirm
            title="Відновити особу?"
            description="Запис буде повернено до активного складу"
            onConfirm={() => handleRestore(record.id)}
            okText="Так"
            cancelText="Ні"
          >
            <Button type="link" size="small" icon={<UndoOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">особовий склад · виключені</div>
          <h1>Виключені з особового складу</h1>
          <div className="sub">{data.length} записів</div>
        </div>
      </div>
      <div className="card" style={{ padding: 14 }}>
        <ProTable<PersonnelListItem>
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          search={false}
          dateFormatter="string"
          scroll={{ x: 1100 }}
          pagination={{
            defaultPageSize: 50,
            showSizeChanger: true,
            showTotal: (total) => `Всього: ${total}`
          }}
          toolbar={{
            search: (
              <Input.Search
                placeholder="Пошук за ПІБ, ІПН..."
                allowClear
                onSearch={(val) => setSearch(val)}
                style={{ width: 300 }}
              />
            )
          }}
        />
      </div>
    </>
  )
}
