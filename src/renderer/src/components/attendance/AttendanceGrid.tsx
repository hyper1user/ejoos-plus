import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react'
import { Table, Popover, Select, Button, message, theme } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
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

// =====================================================================
// DayCell — мемоізована клітинка дня
//
// Винесено в окремий компонент і обгорнуто React.memo, щоб при зміні
// drag-range перерендерювалися лише клітинки, що увійшли/вийшли з
// діапазону, а не всі 1550 (50 ОС × 31 день). Жодних Popover/Select
// усередині — попап рендериться один раз глобально на рівні таблиці
// через anchor-ref. Ця оптимізація — головне джерело прискорення drag.
// =====================================================================
interface DayCellProps {
  rowIdx: number
  colIdx: number
  personnelId: number
  date: string
  code: string | null
  colorCode: string | null
  isWeekend: boolean
  inDrag: boolean
  inSelection: boolean
  weekendBg: string
  primaryColor: string
  onMouseDown: (e: React.MouseEvent, cell: CellRef) => void
  onClick: (e: React.MouseEvent, cell: CellRef) => void
}

const DayCell = memo(function DayCell({
  rowIdx,
  colIdx,
  personnelId,
  date,
  code,
  colorCode,
  isWeekend,
  inDrag,
  inSelection,
  weekendBg,
  primaryColor,
  onMouseDown,
  onClick
}: DayCellProps) {
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
    ...(colorCode
      ? { background: colorCode + '33', color: colorCode }
      : isWeekend
        ? { background: weekendBg }
        : {}),
    // Selection (Shift+drag, чекає Delete) — dashed outline, червонуватий
    ...(inSelection
      ? {
          outline: `1.5px dashed #ff4d4f`,
          outlineOffset: -1,
          background: `#ff4d4f1f`
        }
      : {}),
    // Live drag-paint preview — solid outline primary
    ...(inDrag
      ? {
          outline: `1.5px solid ${primaryColor}`,
          outlineOffset: -1,
          background: `${primaryColor}1f`
        }
      : {})
  }

  return (
    <div
      style={cellStyle}
      data-cell="1"
      data-row={rowIdx}
      data-col={colIdx}
      data-pid={personnelId}
      data-date={date}
      data-value={code ?? ''}
      onMouseDown={(e) => onMouseDown(e, { rowIdx, colIdx, personnelId, date, value: code })}
      onClick={(e) => onClick(e, { rowIdx, colIdx, personnelId, date, value: code })}
    >
      {code ? <span>{code.slice(0, 3)}</span> : <span style={{ color: '#ddd' }}>·</span>}
    </div>
  )
})

interface EditorState {
  cellKey: string
  personnelId: number
  date: string
  value: string | null
  fullName: string
  // Anchor rect для позиціонування Popover'а поверх клітинки
  rect: { left: number; top: number; width: number; height: number }
}

export default function AttendanceGrid({
  year,
  month,
  rows
}: AttendanceGridProps): JSX.Element {
  const { token } = theme.useToken()
  const { statusTypes } = useLookups()
  const [saving, setSaving] = useState(false)

  // Один глобальний editor — замість 1550 Popover'ів. Анкоруємо до
  // клітинки, на яку клікнули, через rect від `getBoundingClientRect()`.
  const [editor, setEditor] = useState<EditorState | null>(null)

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
  // Локально видалити багато клітинок (для bulk-clear)
  const localClearCells = (items: Array<{ personnelId: number; date: string }>) => {
    if (items.length === 0) return
    const byPid = new Map<number, Set<string>>()
    for (const it of items) {
      if (!byPid.has(it.personnelId)) byPid.set(it.personnelId, new Set())
      byPid.get(it.personnelId)!.add(it.date)
    }
    setRowsState((prev) =>
      prev.map((r) => {
        const dates = byPid.get(r.personnelId)
        if (!dates) return r
        const nextDays = { ...r.days }
        let changed = false
        for (const d of dates) {
          if (d in nextDays) {
            delete nextDays[d]
            changed = true
          }
        }
        return changed ? { ...r, days: nextDays } : r
      })
    )
  }

  // Drag state — НЕ в React state, бо змінюється часто і не повинно тригерити re-render
  // самого Table. Тільки overlay-рамка перерендерюється.
  // shiftMode: при mousedown з Shift drag працює як «select range», а не fill —
  // після mouseup замість bulk-set залишаємо `selection`, який чекає на Delete.
  const dragRef = useRef<{
    pendingSrc: CellRef | null
    pendingStart: { x: number; y: number } | null
    active: DragState | null
    justEnded: boolean
    shiftMode: boolean
  }>({ pendingSrc: null, pendingStart: null, active: null, justEnded: false, shiftMode: false })

  // Range preview під час drag (live; зникає на mouseup)
  const [dragRange, setDragRange] = useState<{
    minRow: number
    maxRow: number
    minCol: number
    maxCol: number
    value: string | null
  } | null>(null)

  // Зафіксований selection-діапазон ПІСЛЯ Shift+drag — чекає на Delete.
  // Відрізняється від dragRange візуально (інший колір outline) і живе до
  // явного зняття: Delete (=> bulk-clear), Esc, або наступний клік.
  const [selection, setSelection] = useState<{
    minRow: number
    maxRow: number
    minCol: number
    maxCol: number
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
  const handleSetDay = useCallback(
    async (personnelId: number, date: string, statusCode: string) => {
      const prevSnapshot = rowsState
      localSetCell(personnelId, date, statusCode)
      setSaving(true)
      try {
        await window.api.attendanceSetDay(personnelId, date, statusCode)
      } catch (err) {
        setRowsState(prevSnapshot)
        message.error(`Помилка: ${err}`)
      } finally {
        setSaving(false)
      }
    },
    [rowsState]
  )

  // Очистити одну клітинку — DELETE на бекенді, локально знімаємо ключ дня
  const handleClearDay = useCallback(
    async (personnelId: number, date: string) => {
      const prevSnapshot = rowsState
      // Optimistic: знімаємо ключ дня з days мапи
      setRowsState((prev) =>
        prev.map((r) => {
          if (r.personnelId !== personnelId) return r
          if (!(date in r.days)) return r
          const nextDays = { ...r.days }
          delete nextDays[date]
          return { ...r, days: nextDays }
        })
      )
      setSaving(true)
      try {
        await window.api.attendanceClearDay(personnelId, date)
      } catch (err) {
        setRowsState(prevSnapshot)
        message.error(`Помилка: ${err}`)
      } finally {
        setSaving(false)
      }
    },
    [rowsState]
  )

  // Bulk-clear для selection-діапазону (Delete після Shift+drag)
  const handleBulkClear = useCallback(
    async (range: { minRow: number; maxRow: number; minCol: number; maxCol: number }) => {
      const items: Array<{ personnelId: number; date: string }> = []
      for (let r = range.minRow; r <= range.maxRow; r++) {
        const row = rowsState[r]
        if (!row) continue
        for (let c = range.minCol; c <= range.maxCol; c++) {
          const day = c + 1
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          // Фільтруємо одразу — не надсилаємо на бекенд клітинки, що вже порожні
          if (dateStr in row.days) {
            items.push({ personnelId: row.personnelId, date: dateStr })
          }
        }
      }
      if (items.length === 0) return
      const prevSnapshot = rowsState
      localClearCells(items)
      setSaving(true)
      try {
        const res = await window.api.attendanceBulkClear(items)
        message.success(`Очищено ${res.deleted} клітинок`)
      } catch (err) {
        setRowsState(prevSnapshot)
        message.error(`Помилка: ${err}`)
      } finally {
        setSaving(false)
      }
    },
    [rowsState, year, month]
  )

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

  const computeRange = (active: DragState) => {
    const minRow = Math.min(active.src.rowIdx, active.current.rowIdx)
    const maxRow = Math.max(active.src.rowIdx, active.current.rowIdx)
    const minCol = Math.min(active.src.colIdx, active.current.colIdx)
    const maxCol = Math.max(active.src.colIdx, active.current.colIdx)
    return { minRow, maxRow, minCol, maxCol, value: active.src.value }
  }

  const updateRange = (active: DragState) => setDragRange(computeRange(active))

  // Глобальні listenerи для mousemove/mouseup, щоб не губити drag при виході курсора з клітинки
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      // Стадія 1: pending → перевіряємо threshold
      if (d.pendingSrc && d.pendingStart && !d.active) {
        const dx = Math.abs(e.clientX - d.pendingStart.x)
        const dy = Math.abs(e.clientY - d.pendingStart.y)
        if (dx >= DRAG_THRESHOLD_PX || dy >= DRAG_THRESHOLD_PX) {
          // Shift-drag працює навіть з порожньої source-клітинки (це чистий select),
          // звичайний drag-paint вимагає, щоб у source було значення для копіювання.
          if (d.shiftMode || d.pendingSrc.value) {
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
        const r = computeRange(d.active)
        const wasShift = d.shiftMode
        d.active = null
        d.shiftMode = false
        d.justEnded = true
        setDragRange(null)
        if (wasShift) {
          // Shift+drag → залишаємо як selection, чекаємо на Delete
          setSelection({ minRow: r.minRow, maxRow: r.maxRow, minCol: r.minCol, maxCol: r.maxCol })
        } else {
          handleBulkApply(r)
        }
      } else {
        d.active = null
        d.pendingSrc = null
        d.pendingStart = null
        d.shiftMode = false
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

  // Keyboard: Delete/Backspace для очищення editor-клітинки або selection-діапазону.
  // Esc — знімає selection (editor закриває власний `useEffect` нижче).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Не перехоплювати, якщо фокус у input/textarea/select — щоб користувач
      // міг шукати в Select списку клавішею Backspace
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Пріоритет: editor зі значенням → selection
        if (editor && editor.value) {
          e.preventDefault()
          handleClearDay(editor.personnelId, editor.date)
          setEditor(null)
          return
        }
        if (selection) {
          e.preventDefault()
          handleBulkClear(selection)
          setSelection(null)
        }
      } else if (e.key === 'Escape') {
        if (selection) setSelection(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor, selection, handleClearDay, handleBulkClear])

  const onCellMouseDown = useCallback((e: React.MouseEvent, cell: CellRef) => {
    if (e.button !== 0) return
    dragRef.current.pendingSrc = cell
    dragRef.current.pendingStart = { x: e.clientX, y: e.clientY }
    dragRef.current.shiftMode = e.shiftKey
  }, [])

  // Click без drag відкриває редактор. Якщо щойно завершився drag —
  // не відкривати (justEnded flag). Простий клік також знімає selection.
  const onCellClick = useCallback(
    (e: React.MouseEvent, cell: CellRef) => {
      const d = dragRef.current
      if (d.justEnded) {
        d.justEnded = false
        return
      }
      // Простий клік знімає selection (якщо був) — користувач почав щось нове
      setSelection(null)
      const target = e.currentTarget as HTMLDivElement
      const rect = target.getBoundingClientRect()
      const row = rowsState[cell.rowIdx]
      const cellKey = `${cell.personnelId}-${cell.date}`
      setEditor((cur) => {
        if (cur && cur.cellKey === cellKey) return null
        return {
          cellKey,
          personnelId: cell.personnelId,
          date: cell.date,
          value: cell.value,
          fullName: row?.fullName ?? '',
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        }
      })
    },
    [rowsState]
  )

  // Перевірити, чи клітинка в зафіксованому selection-діапазоні
  const isInSelection = useCallback(
    (rowIdx: number, colIdx: number) =>
      !!selection &&
      rowIdx >= selection.minRow &&
      rowIdx <= selection.maxRow &&
      colIdx >= selection.minCol &&
      colIdx <= selection.maxCol,
    [selection]
  )

  const isInDragRange = useCallback(
    (rowIdx: number, colIdx: number) =>
      !!dragRange &&
      rowIdx >= dragRange.minRow &&
      rowIdx <= dragRange.maxRow &&
      colIdx >= dragRange.minCol &&
      colIdx <= dragRange.maxCol,
    [dragRange]
  )

  // Компактна мапа дат у місяці — щоб render-функція не форматувала рядок щоразу.
  const datesInMonth = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const isWeekend = [0, 6].includes(new Date(year, month - 1, day).getDay())
      return { day, dateStr, isWeekend }
    })
  }, [daysInMonth, year, month])

  const weekendBg = token.colorWarningBg
  const primaryColor = token.colorPrimary

  // useMemo на columns — щоб Ant Table не вважав columns зміненими при кожному
  // ререндері основного компонента. Залежності: усе, що бере участь у render
  // клітинки (datesInMonth, statusMap, dragRange-derived isInDragRange,
  // мемо-stable handlers).
  const columns: ColumnsType<PersonnelAttendanceRow> = useMemo(() => {
    return [
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
      ...datesInMonth.map(({ day, dateStr, isWeekend }, i) => ({
        title: String(day),
        width: 38,
        align: 'center' as const,
        onHeaderCell: () => ({
          style: isWeekend ? { background: weekendBg } : {}
        }),
        render: (_: unknown, record: PersonnelAttendanceRow, rowIdx: number) => {
          const code = record.days[dateStr] ?? null
          const meta = code ? statusMap.get(code) : null
          return (
            <DayCell
              rowIdx={rowIdx}
              colIdx={i}
              personnelId={record.personnelId}
              date={dateStr}
              code={code}
              colorCode={meta?.colorCode ?? null}
              isWeekend={isWeekend}
              inDrag={isInDragRange(rowIdx, i)}
              inSelection={isInSelection(rowIdx, i)}
              weekendBg={weekendBg}
              primaryColor={primaryColor}
              onMouseDown={onCellMouseDown}
              onClick={onCellClick}
            />
          )
        }
      }))
    ]
  }, [
    datesInMonth,
    statusMap,
    isInDragRange,
    isInSelection,
    weekendBg,
    primaryColor,
    onCellMouseDown,
    onCellClick
  ])

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

  // Закрити editor при кліку зовні / Esc
  useEffect(() => {
    if (!editor) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditor(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor])

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

      {/* Один глобальний редактор — anchor через fixed-positioned div */}
      {editor && (
        <Popover
          open
          trigger="click"
          placement="bottom"
          title={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
              }}
            >
              <span>
                {editor.fullName} — {editor.date.split('-').reverse().join('.')}
              </span>
              {editor.value && (
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={saving}
                  title="Очистити позначку"
                  style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }}
                  onClick={() => {
                    handleClearDay(editor.personnelId, editor.date)
                    setEditor(null)
                  }}
                >
                  Очистити
                </Button>
              )}
            </div>
          }
          content={
            <Select
              autoFocus
              defaultOpen
              style={{ width: 260 }}
              placeholder="Оберіть статус"
              value={editor.value}
              options={statusOptions}
              showSearch
              optionFilterProp="label"
              disabled={saving}
              onChange={(val) => {
                handleSetDay(editor.personnelId, editor.date, val)
                setEditor(null)
              }}
            />
          }
          onOpenChange={(open) => {
            if (!open) setEditor(null)
          }}
        >
          <div
            style={{
              position: 'fixed',
              top: editor.rect.top,
              left: editor.rect.left,
              width: editor.rect.width,
              height: editor.rect.height,
              pointerEvents: 'none'
            }}
          />
        </Popover>
      )}

      {dragRange && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: dragRef.current.shiftMode ? '#ff4d4f' : token.colorPrimary,
            color: '#fff',
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            pointerEvents: 'none'
          }}
        >
          {dragRef.current.shiftMode
            ? `Виділено ${(dragRange.maxRow - dragRange.minRow + 1) * (dragRange.maxCol - dragRange.minCol + 1)} клітинок`
            : `${dragRange.value ?? '—'} → ${(dragRange.maxRow - dragRange.minRow + 1) * (dragRange.maxCol - dragRange.minCol + 1)} клітинок`}
        </div>
      )}

      {/* Persistent pill для зафіксованого selection (після Shift+drag, чекає Delete) */}
      {selection && !dragRange && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: '#ff4d4f',
            color: '#fff',
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            pointerEvents: 'none'
          }}
        >
          Виділено {(selection.maxRow - selection.minRow + 1) * (selection.maxCol - selection.minCol + 1)} клітинок · Delete = очистити
        </div>
      )}
    </div>
  )
}
