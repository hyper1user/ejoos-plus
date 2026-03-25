import { useState, useMemo, useCallback } from 'react'
import { Table, Popover, Select, Tag, message, theme, Tooltip, Button, Modal, Input, DatePicker } from 'antd'
import { ClearOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { DGV_CODES, DGV_CODE_MAP, DGV_CATEGORY_LABELS } from '@shared/enums/dgv-codes'
import type { DgvPersonRow } from '@shared/types/dgv'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

interface DgvGridProps {
  year: number
  month: number
  rows: DgvPersonRow[]
  onRefetch: () => void
}

export default function DgvGrid({ year, month, rows, onRefetch }: DgvGridProps): JSX.Element {
  const { token } = theme.useToken()
  const [saving, setSaving] = useState(false)
  const [bulkModal, setBulkModal] = useState<{
    personnelId: number
    fullName: string
  } | null>(null)
  const [bulkCode, setBulkCode] = useState<string>('')
  const [bulkRange, setBulkRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [personMetaModal, setPersonMetaModal] = useState<DgvPersonRow | null>(null)

  // DGV select options grouped by category
  const dgvOptions = useMemo(() => {
    const groups = new Map<string, typeof DGV_CODES>()
    for (const c of DGV_CODES) {
      if (!groups.has(c.category)) groups.set(c.category, [])
      groups.get(c.category)!.push(c)
    }
    return [
      // Clear option
      { label: '— Очистити —', options: [{ label: '⊘ Очистити', value: '__clear__' }] },
      ...Array.from(groups.entries()).map(([cat, items]) => ({
        label: DGV_CATEGORY_LABELS[cat] || cat,
        options: items.map((c) => ({
          label: `${c.code} — ${c.name}`,
          value: c.code
        }))
      }))
    ]
  }, [])

  const daysInMonth = new Date(year, month, 0).getDate()

  const handleSetDay = useCallback(async (personnelId: number, date: string, dgvCode: string) => {
    setSaving(true)
    try {
      if (dgvCode === '__clear__') {
        await window.api.dgvClearDay(personnelId, date)
      } else {
        await window.api.dgvSetDay(personnelId, date, dgvCode)
      }
      onRefetch()
    } catch (err) {
      message.error(`Помилка: ${err}`)
    } finally {
      setSaving(false)
    }
  }, [onRefetch])

  const handleBulkSet = async () => {
    if (!bulkModal || !bulkCode || !bulkRange) return
    setSaving(true)
    try {
      await window.api.dgvSetBulk(
        bulkModal.personnelId,
        bulkRange[0].format('YYYY-MM-DD'),
        bulkRange[1].format('YYYY-MM-DD'),
        bulkCode
      )
      message.success('Позначки встановлено')
      setBulkModal(null)
      setBulkCode('')
      setBulkRange(null)
      onRefetch()
    } catch (err) {
      message.error(`Помилка: ${err}`)
    } finally {
      setSaving(false)
    }
  }

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`

  const handleSavePersonMeta = async (
    personnelId: number,
    key: string,
    value: string
  ) => {
    try {
      await window.api.dgvPersonMetaSet(personnelId, yearMonth, key, value)
    } catch (err) {
      message.error(`Помилка: ${err}`)
    }
  }

  // Build columns
  const columns: ColumnsType<DgvPersonRow> = [
    {
      title: '№',
      width: 40,
      fixed: 'left',
      render: (_v, _r, idx) => idx + 1
    },
    {
      title: 'ПІБ',
      dataIndex: 'fullName',
      width: 200,
      fixed: 'left',
      ellipsis: true,
      render: (text: string, record) => (
        <Tooltip title="Правий клік — масове заповнення">
          <span
            style={{ cursor: 'pointer' }}
            onContextMenu={(e) => {
              e.preventDefault()
              setBulkModal({ personnelId: record.personnelId, fullName: record.fullName })
            }}
          >
            {record.rankName && (
              <span style={{ color: token.colorTextSecondary, fontSize: 11 }}>{record.rankName} </span>
            )}
            {text}
            {record.isTransferredOut && (
              <span style={{ color: token.colorTextQuaternary, fontSize: 10, marginLeft: 4 }}>(вибув)</span>
            )}
          </span>
        </Tooltip>
      )
    },
    // Day columns
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const isWeekend = [0, 6].includes(new Date(year, month - 1, day).getDay())

      return {
        title: String(day),
        width: 42,
        align: 'center' as const,
        onHeaderCell: () => ({
          style: isWeekend ? { background: token.colorWarningBg } : {}
        }),
        render: (_: unknown, record: DgvPersonRow) => {
          const code = record.days[dateStr] ?? null
          const info = code ? DGV_CODE_MAP.get(code) : null

          const cellStyle: React.CSSProperties = {
            width: '100%',
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderRadius: 2,
            fontSize: 11,
            fontWeight: code ? 600 : 400,
            ...(info
              ? { background: info.colorCode + '22', color: info.colorCode }
              : isWeekend
                ? { background: token.colorWarningBg }
                : {})
          }

          const content = (
            <div style={cellStyle}>
              {code ? (
                <span title={info?.name}>{code}</span>
              ) : (
                <span style={{ color: token.colorTextQuaternary }}>·</span>
              )}
            </div>
          )

          return (
            <Popover
              trigger="click"
              title={`${record.fullName} — ${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`}
              content={
                <Select
                  style={{ width: 280 }}
                  placeholder="Оберіть позначку"
                  value={code}
                  options={dgvOptions}
                  showSearch
                  optionFilterProp="label"
                  disabled={saving}
                  onChange={(val) => handleSetDay(record.personnelId, dateStr, val)}
                />
              }
            >
              {content}
            </Popover>
          )
        }
      }
    }),
    // Notes column
    {
      title: 'Прим.',
      width: 50,
      fixed: 'right',
      render: (_: unknown, record: DgvPersonRow) => (
        <Tooltip title="Натисніть для редагування приміток">
          <Button
            type="text"
            size="small"
            style={{
              fontSize: 11,
              color: record.notes || record.punishmentReason
                ? token.colorPrimary
                : token.colorTextQuaternary
            }}
            onClick={() => setPersonMetaModal(record)}
          >
            {record.notes || record.punishmentReason ? '✎' : '…'}
          </Button>
        </Tooltip>
      )
    }
  ]

  // Summary row
  const summaryData = useMemo(() => {
    const counts100: number[] = new Array(daysInMonth).fill(0)
    const counts30: number[] = new Array(daysInMonth).fill(0)
    const countsAbsent: number[] = new Array(daysInMonth).fill(0)

    for (let i = 0; i < daysInMonth; i++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
      for (const row of rows) {
        const code = row.days[dateStr]
        if (!code) continue
        if (code === '100') counts100[i]++
        else if (code === '30') counts30[i]++
        else countsAbsent[i]++
      }
    }

    return { counts100, counts30, countsAbsent }
  }, [rows, daysInMonth, year, month])

  return (
    <>
      <Table
        dataSource={rows}
        columns={columns}
        rowKey="personnelId"
        size="small"
        pagination={false}
        scroll={{ x: 200 + 40 + daysInMonth * 42 + 50 + 20, y: 'calc(100vh - 400px)' }}
        bordered
        rowClassName={(record) => record.isTransferredOut ? 'dgv-row-transferred' : ''}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                <strong style={{ fontSize: 11 }}>100 / 30 / ін.</strong>
              </Table.Summary.Cell>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <Table.Summary.Cell key={i} index={i + 2} align="center">
                  <div style={{ fontSize: 9, lineHeight: '12px' }}>
                    <div style={{ color: '#52c41a' }}>{summaryData.counts100[i] || ''}</div>
                    <div style={{ color: '#1677ff' }}>{summaryData.counts30[i] || ''}</div>
                    <div style={{ color: '#ff4d4f' }}>{summaryData.countsAbsent[i] || ''}</div>
                  </div>
                </Table.Summary.Cell>
              ))}
              <Table.Summary.Cell index={daysInMonth + 2}>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      {/* Bulk set modal */}
      <Modal
        title={`Масове заповнення — ${bulkModal?.fullName}`}
        open={!!bulkModal}
        onCancel={() => setBulkModal(null)}
        onOk={handleBulkSet}
        okText="Застосувати"
        cancelText="Скасувати"
        okButtonProps={{ disabled: !bulkCode || !bulkRange }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ marginBottom: 4 }}>Позначка:</div>
            <Select
              style={{ width: '100%' }}
              placeholder="Оберіть позначку"
              value={bulkCode || undefined}
              options={dgvOptions.filter((g) => g.label !== '— Очистити —')}
              showSearch
              optionFilterProp="label"
              onChange={setBulkCode}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>Період:</div>
            <RangePicker
              style={{ width: '100%' }}
              value={bulkRange}
              onChange={(dates) => setBulkRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
              format="DD.MM.YYYY"
            />
          </div>
        </div>
      </Modal>

      {/* Person meta modal */}
      <Modal
        title={`Примітки — ${personMetaModal?.fullName}`}
        open={!!personMetaModal}
        onCancel={() => { setPersonMetaModal(null); onRefetch() }}
        footer={<Button onClick={() => { setPersonMetaModal(null); onRefetch() }}>Закрити</Button>}
        width={500}
      >
        {personMetaModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <div>
              <div style={{ marginBottom: 4 }}>Примітки:</div>
              <Input.TextArea
                rows={2}
                defaultValue={personMetaModal.notes}
                onBlur={(e) => handleSavePersonMeta(personMetaModal.personnelId, 'notes', e.target.value)}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>Додаткова підстава (індивідуальна):</div>
              <Input.TextArea
                rows={2}
                defaultValue={personMetaModal.additionalGrounds}
                onBlur={(e) => handleSavePersonMeta(personMetaModal.personnelId, 'additional_grounds', e.target.value)}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>Причина невиплати (п.6):</div>
              <Input.TextArea
                rows={2}
                defaultValue={personMetaModal.punishmentReason}
                onBlur={(e) => handleSavePersonMeta(personMetaModal.personnelId, 'punishment_reason', e.target.value)}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>Наказ (п.6):</div>
              <Input
                defaultValue={personMetaModal.punishmentOrder}
                onBlur={(e) => handleSavePersonMeta(personMetaModal.personnelId, 'punishment_order', e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
