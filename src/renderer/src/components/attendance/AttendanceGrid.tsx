import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Table, Popover, Select, message, theme } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useLookups } from '../../hooks/useLookups'
import type { PersonnelAttendanceRow } from '@shared/types/attendance'

interface AttendanceGridProps {
  year: number
  month: number
  rows: PersonnelAttendanceRow[]
  onRefetch: () => void
}

interface CellRef {
  rowIdx: number
  colIdx: number
  personnelId: number
  date: string
  value: string | null
}

interface DragState {
  src: CellRef
  current: CellRef
}

const DRAG_THRESHOLD_PX = 4

export default function AttendanceGrid({
  year,
  month,
  rows
}: AttendanceGridProps): JSX.Element {
  const { token } = theme.useToken()
  const { statusTypes } = useLookups()
  const [saving, setSaving] = useState(false)
  const [popoverKey, setPopoverKey] = useState<string | null>(null)

  // Локальна копія rows для optimistic UI — не дозволяє scroll скидатись
  // при кожному set-day. Sync з prop при зміні місяця/підрозділу.
  const [rowsState, setRowsState] = useState<PersonnelAttendanceRow[]>(rows)
  const lastPropsRef = useRef(rows)
  if (lastPropsRef.current !== rows) {
    // props.rows змінилось ззовні — replace локальний state
    lastPropsRef.current = rows
    setRowsState(rows)
  }

  // Локально оновити одну клітинку (без IPC, без refetch)
  const localSetCell = (personnelId: number, date: string, statusCode: string) => {
    setRowsState((prev) =>
      prev.map((r) =>
        r.personnelId === personnelId
          ? { ...r, days: { ...r.days, [date]: statusCode } }
          : r
      )
    )
  }
  // Локально оновити багато клітинок одночасно (для drag-fill)
  const localSetCells = (
    items: Array<{ personnelId: number; date: string; statusCode: string }>
  ) => {
    if (items.length === 0) return
    const byPid = new Map<number, Record<string, string>>()
    for (const it of items) {
      if (!byPid.has(it.personnelId)) byPid.set(it.personnelId, {})
      byPid.get(it.personnelId)![it.date] = it.statusCode
    }
    setRowsState((prev) =>
      prev.map((r) => {
        const updates = byPid.get(r.personnelId)
        if (!updates) return r
        return { ...r, days: { ...r.days, ...updates } }
      })
    )
  }

  // Drag state — НЕ в React state, бо змінюється часто і не повинно тригерити re-render
  // самого Table. Тільки overlay-рамка перерендерюється.
  const dragRef = useRef<{
    pendingSrc: CellRef | null // mousedown зафіксував кандидата, але ще не перейшли в drag mode
    pendingStart: { x: number; y: number } | null
    active: DragState | null
  }>({ pendingSrc: null, pendingStart: null, active: null })

  // Окремий state для preview-рамки — змінюється тільки при перетині нової клітинки
  const [dragRange, setDragRange] = useState<{
    minRow: number
    maxRow: number
    minCol: number
    maxCol: number
    value: string | null
  } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // Status maps
  const statusMap = useMemo(() => {
    const m = new Map<string, { name: string; colorCode: string | null; groupName: string }>()
    for (const s of statusTypes) {
      m.set(s.code, { name: s.name, colorCode: s.colorCode, groupName: s.groupName })
    }
    return m
  }, [statusTypes])

  const statusOptions = useMemo(() => {
    const groups = new Map<string, typeof statusTypes>()
    for (const s of statusTypes) {
      if (!groups.has(s.groupName)) groups.set(s.groupName, [])
      groups.get(s.groupName)!.push(s)
    }
    return Array.from(groups.entries()).map(([group, items]) => ({
      label: group,
      options: items.map((s) => ({ label: s.name, value: s.code }))
    }))
  }, [statusTypes])

  const daysInMonth = new Date(year, month, 0).getDate()

  // Один день, одна особа — optimistic update без refetch
  const handleSetDay = async (personnelId: number, date: string, statusCode: string) => {
    // Optimistic: одразу оновлюємо UI
    const prevSnapshot = rowsState
    localSetCell(personnelId, date, statusCode)
    setSaving(true)
    try {
      await window.api.attendanceSetDay(personnelId, date, statusCode)
    } catch (err) {
      // Rollback при помилці
      setRowsState(prevSnapshot)
      message.error(`Помилка: ${err}`)
    } finally {
      setSaving(false)
    }
  }

  // Bulk apply після drag-fill — optimistic update без refetch
  const handleBulkApply = useCallback(
    async (range: NonNullable<typeof dragRange>) => {
      if (!range.value) return
      const items: Array<{ personnelId: number; date: string; statusCode: string }> = []
      for (let r = range.minRow; r <= range.maxRow; r++) {
        const row = rowsState[r]
        if (!row) continue
        for (let c = range.minCol; c <= range.maxCol; c++) {
          const day = c + 1
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          items.push({
            personnelId: row.personnelId,
            date: dateStr,
            statusCode: range.value
          })
        }
      }
      if (items.length === 0) return
      // Optimistic: одразу оновлюємо UI
      const prevSnapshot = rowsState
      localSetCells(items)
      setSaving(true)
      try {
        const res = await window.api.attendanceBulkSet(items)
        message.success(`Заповнено ${res.written} клітинок`)
      } catch (err) {
        setRowsState(prevSnapshot)
        message.error(`Помилка: ${err}`)
      } finally {
        setSaving(false)
      }
    },
    [rowsState, year, month]
  )

  // Знайти data-cell під курсором
  const cellAt = (target: EventTarget | null): CellRef | null => {
    if (!(target instanceof Element)) return null
    const el = target.closest<HTMLElement>('[data-cell]')
    if (!el) return null
    const rowIdx = Number(el.dataset.row)
    const colIdx = Number(el.dataset.col)
    const personnelId = Number(el.dataset.pid)
    const date = el.dataset.date ?? ''
    const value = el.dataset.value || null
    if (Number.isNaN(rowIdx) || Number.isNaN(colIdx) || !date) return null
    return { rowIdx, colIdx, personnelId, date, value }
  }

  // Глобальні listenerи для mousemove/mouseup, щоб не губити drag при виході курсора з клітинки
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      // Стадія 1: pending → перевіряємо threshold
      if (d.pendingSrc && d.pendingStart && !d.active) {
        const dx = Math.abs(e.clientX - d.pendingStart.x)
        const dy = Math.abs(e.clientY - d.pendingStart.y)
        if (dx >= DRAG_THRESHOLD_PX || dy >= DRAG_THRESHOLD_PX) {
          // Перейти в drag mode — тільки якщо source має значення
          if (d.pendingSrc.value) {
            d.active = { src: d.pendingSrc, current: d.pendingSrc }
            updateRange(d.active)
          }
          d.pendingSrc = null
          d.pendingStart = null
        }
      }
      // Стадія 2: active drag → оновити range при переході на нову клітинку
      if (d.active) {
        const cell = cellAt(e.target)
        if (cell && (cell.rowIdx !== d.active.current.rowIdx || cell.colIdx !== d.active.current.colIdx)) {
          d.active = { src: d.active.src, current: cell }
          updateRange(d.active)
        }
      }
    }

    const onUp = () => {
      const d = dragRef.current
      if (d.active && dragRange) {
        // Виконати bulk apply, але з поточного знімку state'у — не з d.active напряму
        const r = computeRange(d.active)
        d.active = null
        setDragRange(null)
        handleBulkApply(r)
      } else {
        // Простий клік без drag — нічого не робимо тут (Popover open керується через onClick клітинки)
        d.active = null
        d.pendingSrc = null
        d.pendingStart = null
        setDragRange(null)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragRange, handleBulkApply])

  const computeRange = (active: DragState) => {
    const minRow = Math.min(active.src.rowIdx, active.current.rowIdx)
    const maxRow = Math.max(active.src.rowIdx, active.current.rowIdx)
    const minCol = Math.min(active.src.colIdx, active.current.colIdx)
    const maxCol = Math.max(active.src.colIdx, active.current.colIdx)
    return { minRow, maxRow, minCol, maxCol, value: active.src.value }
  }

  const updateRange = (active: DragState) => setDragRange(computeRange(active))

  const onCellMouseDown = (e: React.MouseEvent, cell: CellRef) => {
    if (e.button !== 0) return // тільки лівий клік
    dragRef.current.pendingSrc = cell
    dragRef.current.pendingStart = { x: e.clientX, y: e.clientY }
    // Не preventDefault — щоб клік далі міг відкрити Popover, якщо drag не відбувся
  }

  // Click без drag відкриває Popover
  const onCellClick = (e: React.MouseEvent, cellKey: string) => {
    // Якщо щойно завершили drag, dragRange ще міг не встигнути очиститись —
    // простіша евристика: якщо active.src уже null і pending теж null,
    // значить це чистий клік. Але mouseup сам очищає — на момент click це вже null.
    // Натомість перевіримо, чи був drag-range з > 1 клітинки —
    // якщо щойно завершили fill, не відкриваємо.
    void e
    setPopoverKey((cur) => (cur === cellKey ? null : cellKey))
  }

  const isInDragRange = (rowIdx: number, colIdx: number) =>
    dragRange &&
    rowIdx >= dragRange.minRow &&
    rowIdx <= dragRange.maxRow &&
    colIdx >= dragRange.minCol &&
    colIdx <= dragRange.maxCol

  const columns: ColumnsType<PersonnelAttendanceRow> = [
    {
      title: '№',
      width: 45,
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
        <span>
          {record.rankName && (
            <span style={{ color: '#888', fontSize: 12 }}>{record.rankName} </span>
          )}
          {text}
        </span>
      )
    },
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const isWeekend = [0, 6].includes(new Date(year, month - 1, day).getDay())

      return {
        title: String(day),
        width: 38,
        align: 'center' as const,
        onHeaderCell: () => ({
          style: isWeekend ? { background: token.colorWarningBg } : {}
        }),
        render: (_: unknown, record: PersonnelAttendanceRow, rowIdx: number) => {
          const code = record.days[dateStr] ?? null
          const st = code ? statusMap.get(code) : null
          const cellKey = `${record.personnelId}-${dateStr}`
          const inDrag = isInDragRange(rowIdx, i)

          const cellStyle: React.CSSProperties = {
            width: '100%',
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: code ? 'cell' : 'pointer',
            borderRadius: 2,
            fontSize: 11,
            userSelect: 'none',
            position: 'relative',
            ...(st?.colorCode
              ? { background: st.colorCode + '33', color: st.colorCode }
              : isWeekend
                ? { background: token.colorWarningBg }
                : {}),
            ...(inDrag
              ? {
                  outline: `1.5px solid ${token.colorPrimary}`,
                  outlineOffset: -1,
                  background: `${token.colorPrimary}1f`
                }
              : {})
          }

          const cellRef: CellRef = {
            rowIdx,
            colIdx: i,
            personnelId: record.personnelId,
            date: dateStr,
            value: code
          }

          const content = (
            <div
              style={cellStyle}
              data-cell="1"
              data-row={rowIdx}
              data-col={i}
              data-pid={record.personnelId}
              data-date={dateStr}
              data-value={code ?? ''}
              onMouseDown={(e) => onCellMouseDown(e, cellRef)}
              onClick={(e) => onCellClick(e, cellKey)}
            >
              {code ? (
                <span title={st?.name}>{code.slice(0, 3)}</span>
              ) : (
                <span style={{ color: '#ddd' }}>·</span>
              )}
            </div>
          )

          return (
            <Popover
              trigger="click"
              open={popoverKey === cellKey}
              onOpenChange={(open) => {
                if (!open) setPopoverKey(null)
              }}
              title={`${record.fullName} — ${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`}
              content={
                <Select
                  style={{ width: 260 }}
                  placeholder="Оберіть статус"
                  value={code}
                  options={statusOptions}
                  showSearch
                  optionFilterProp="label"
                  disabled={saving}
                  onChange={(val) => {
                    handleSetDay(record.personnelId, dateStr, val)
                    setPopoverKey(null)
                  }}
                />
              }
            >
              {content}
            </Popover>
          )
        }
      }
    })
  ]

  // Summary: present/absent per day
  const summaryData = useMemo(() => {
    const present: number[] = new Array(daysInMonth).fill(0)
    const absent: number[] = new Array(daysInMonth).fill(0)

    for (let i = 0; i < daysInMonth; i++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
      for (const row of rowsState) {
        const code = row.days[dateStr]
        if (!code) continue
        const st = statusMap.get(code)
        if (st?.groupName === 'Так') {
          present[i]++
        } else {
          absent[i]++
        }
      }
    }
    return { present, absent }
  }, [rowsState, daysInMonth, year, month, statusMap])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Table
        dataSource={rowsState}
        columns={columns}
        rowKey="personnelId"
        size="small"
        pagination={false}
        scroll={{ x: 200 + 45 + daysInMonth * 38 + 20, y: 'calc(100vh - 340px)' }}
        bordered
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                <strong>Наявні / Відсутні</strong>
              </Table.Summary.Cell>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <Table.Summary.Cell key={i} index={i + 2} align="center">
                  <div style={{ fontSize: 10, lineHeight: '14px' }}>
                    <div style={{ color: 'green' }}>{summaryData.present[i] || ''}</div>
                    <div style={{ color: 'red' }}>{summaryData.absent[i] || ''}</div>
                  </div>
                </Table.Summary.Cell>
              ))}
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
      {dragRange && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: token.colorPrimary,
            color: '#fff',
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            pointerEvents: 'none'
          }}
        >
          {dragRange.value ?? '—'} → {(dragRange.maxRow - dragRange.minRow + 1) * (dragRange.maxCol - dragRange.minCol + 1)} клітинок
        </div>
      )}
    </div>
  )
}
