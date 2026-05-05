import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Tooltip } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { PersonnelListItem } from '@shared/types/personnel'
import { useLookups } from '../hooks/useLookups'
import { usePersonnelList } from '../hooks/usePersonnel'
import StatusHistoryForm from '../components/statuses/StatusHistoryForm'

type Cat = 'duty' | 'combat' | 'medical' | 'leave' | 'absent' | 'other'
type CatFilter = 'all' | 'combat' | 'medical' | 'absent' | 'disposition'

const COMBAT_CODES = new Set(['РВ', 'РЗ', 'РШ'])
const DISPOSITION_SUBDIVISION = 'розпорядження'

function categorize(code: string, group: string): Cat {
  if (group === 'Лікування') return 'medical'
  if (group === 'Відпустка' || group === 'Відрядження') return 'leave'
  if (
    group === 'Загиблі' ||
    group === 'Зниклі безвісти' ||
    group === 'Полон' ||
    group === 'СЗЧ' ||
    group === 'Ні'
  )
    return 'absent'
  if (group === 'Так') return COMBAT_CODES.has(code) ? 'combat' : 'duty'
  return 'other'
}

function inFilter(cat: Cat, filter: CatFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'combat') return cat === 'combat' || cat === 'duty'
  if (filter === 'medical') return cat === 'medical'
  if (filter === 'absent') return cat === 'absent' || cat === 'leave'
  return false
}

const FILTER_LABELS: Record<CatFilter, string> = {
  all: 'Усі категорії',
  combat: 'Бойові',
  medical: 'Медичні',
  absent: 'Відсутні',
  disposition: 'У розпорядженні',
}

const VISIBLE_CARDS = 8

function callsignInitials(callsign: string | null): string {
  if (!callsign) return '—'
  return callsign.slice(0, 3).toUpperCase()
}

export default function StatusBoard(): JSX.Element {
  const navigate = useNavigate()
  const { statusTypes } = useLookups()
  const { modal, message } = App.useApp()
  const [filter, setFilter] = useState<CatFilter>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set())

  // v1.0.0: subdivision filter прибрано — Канбан тепер показує і штатних,
  // і тих, хто в розпорядженні. status='active' автоматично виключає виключених.
  // Розпорядженни візуально розрізняються рамкою + pill «у розпорядженні».
  const filters = useMemo(
    () => ({ status: 'active' as const }),
    []
  )

  const { data: personnel, refetch } = usePersonnelList(filters)

  // Sort statusTypes by sortOrder
  const sortedStatuses = useMemo(
    () => [...statusTypes].sort((a, b) => a.sortOrder - b.sortOrder),
    [statusTypes]
  )

  // Personnel filtered by current view: при filter='disposition' показуємо
  // лише тих, хто в розпорядженні. Інші filter'и не обмежують особовий
  // склад — обмежують лише видимі колонки за категорією.
  const visiblePersonnel = useMemo(
    () =>
      filter === 'disposition'
        ? personnel.filter((p) => p.currentSubdivision === DISPOSITION_SUBDIVISION)
        : personnel,
    [personnel, filter]
  )

  // Group personnel by current status code
  const byStatus = useMemo(() => {
    const m: Record<string, PersonnelListItem[]> = {}
    for (const p of visiblePersonnel) {
      if (!p.currentStatusCode) continue
      if (!m[p.currentStatusCode]) m[p.currentStatusCode] = []
      m[p.currentStatusCode].push(p)
    }
    return m
  }, [visiblePersonnel])

  // Filter columns by category. При filter='disposition' колонки не обмежуємо —
  // показуємо всі (бо у розпорядженні можуть бути різні групи: СЗЧ, ШП, ВП тощо).
  // Порядок: непорожні колонки спочатку (за sortOrder), порожні в кінці —
  // щоб командиру не доводилось гортати «нулі», поки не дійде до робочого
  // вмісту.
  const visibleColumns = useMemo(() => {
    const filtered =
      filter === 'disposition'
        ? sortedStatuses
        : sortedStatuses.filter((s) => {
            const cat = categorize(s.code, s.groupName)
            return inFilter(cat, filter)
          })
    return [...filtered].sort((a, b) => {
      const aHas = (byStatus[a.code]?.length ?? 0) > 0
      const bHas = (byStatus[b.code]?.length ?? 0) > 0
      if (aHas !== bHas) return aHas ? -1 : 1
      return a.sortOrder - b.sortOrder
    })
  }, [sortedStatuses, filter, byStatus])

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverCol(null)
  }

  const handleDragOver = (e: React.DragEvent, code: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== code) setDragOverCol(code)
  }

  const handleDragLeave = (code: string) => {
    if (dragOverCol === code) setDragOverCol(null)
  }

  const handleDrop = (e: React.DragEvent, targetCode: string) => {
    e.preventDefault()
    const id = Number(e.dataTransfer.getData('text/plain'))
    setDragOverCol(null)
    setDraggingId(null)
    if (!id) return

    const person = personnel.find((p) => p.id === id)
    if (!person) return
    if (person.currentStatusCode === targetCode) return

    const target = sortedStatuses.find((s) => s.code === targetCode)
    if (!target) return

    // Preflight: дзеркало бекенду v0.9.8 — для розпорядженни заборонені
    // бойові коди (onSupply=true). Показуємо зрозуміле повідомлення замість
    // того, щоб дозволити drop і потім отримати IPC-помилку.
    if (person.currentSubdivision === DISPOSITION_SUBDIVISION && target.onSupply) {
      message.warning(
        `Бойові статуси (${target.code}) призначаються лише на штатній посаді. ${person.fullName} зараз у розпорядженні.`
      )
      return
    }

    modal.confirm({
      title: 'Зміна статусу',
      content: (
        <div>
          <p style={{ margin: '0 0 8px' }}>
            <strong>{person.fullName}</strong>
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-2)' }}>
            {person.currentStatusCode || '—'} → <strong>{target.code}</strong> ({target.name})
          </p>
        </div>
      ),
      okText: 'Підтвердити',
      cancelText: 'Скасувати',
      async onOk() {
        try {
          const result = await window.api.statusHistoryCreate({
            personnelId: id,
            statusCode: targetCode,
            dateFrom: dayjs().format('YYYY-MM-DD'),
            dateTo: '',
            presenceGroup: '',
            comment: 'Зміна через Kanban',
          })
          if ((result as { error?: unknown })?.error) {
            message.error('Не вдалося змінити статус')
            return
          }
          message.success(`Статус змінено: ${person.fullName} → ${target.code}`)
          refetch()
        } catch (err) {
          message.error('Помилка зміни статусу')
        }
      },
    })
  }

  const toggleExpand = (code: string) => {
    setExpandedCols((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">
            kanban · {sortedStatuses.length} статусів · штат + розпорядження
          </div>
          <h1>Статуси особового складу</h1>
          <div className="sub">
            Перетягніть картку для зміни статусу. Картки з помаранчевою рамкою — у розпорядженні (бойові статуси для них недоступні).
          </div>
        </div>
        <div className="actions">
          <div className="seg-control">
            {(Object.keys(FILTER_LABELS) as CatFilter[]).map((c) => (
              <button
                key={c}
                className={filter === c ? 'on' : ''}
                onClick={() => setFilter(c)}
              >
                {FILTER_LABELS[c]}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={() => setDrawerOpen(true)}>
            <PlusOutlined />
            Додати статус
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="kanban">
        {visibleColumns.map((col) => {
          const cat = categorize(col.code, col.groupName)
          const list = byStatus[col.code] ?? []
          const expanded = expandedCols.has(col.code)
          const visible = expanded ? list : list.slice(0, VISIBLE_CARDS)
          const isDragOver = dragOverCol === col.code
          return (
            <div
              key={col.code}
              className={`kanban-col col-c-${cat}${isDragOver ? ' drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.code)}
              onDragLeave={() => handleDragLeave(col.code)}
              onDrop={(e) => handleDrop(e, col.code)}
            >
              <div className="kanban-col-head">
                <span className="marker" />
                <Tooltip title={col.name} placement="top">
                  <span className="ttl">{col.name}</span>
                </Tooltip>
                <span className="mono dim" style={{ fontSize: 10, marginLeft: 4 }}>
                  {col.code}
                </span>
                <span className="count">{list.length}</span>
              </div>
              <div className="kanban-col-body">
                {list.length === 0 && (
                  <div
                    style={{
                      padding: '14px 8px',
                      textAlign: 'center',
                      fontSize: 11,
                      color: 'var(--fg-4)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    — порожньо —
                  </div>
                )}
                {visible.map((p) => {
                  const inDisposition = p.currentSubdivision === DISPOSITION_SUBDIVISION
                  return (
                    <div
                      key={p.id}
                      className={
                        'k-card' +
                        (draggingId === p.id ? ' dragging' : '') +
                        (inDisposition ? ' disposition' : '')
                      }
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id)}
                      onDragEnd={handleDragEnd}
                      onDoubleClick={() => navigate(`/personnel/${p.id}`)}
                    >
                      <div className="row">
                        <div className="avatar sm">{callsignInitials(p.callsign)}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="name">
                            <span
                              style={{
                                color: 'var(--accent)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: 11,
                                marginRight: 4,
                              }}
                            >
                              {p.callsign || '—'}
                            </span>
                            · {p.fullName}
                          </div>
                          <div className="pos">
                            {p.rankName ? `${p.rankName} · ` : ''}
                            {p.positionTitle || p.currentPositionIdx || '—'}
                          </div>
                        </div>
                      </div>
                      <div className="meta">
                        {inDisposition ? (
                          <span className="disposition-pill" title="Військовослужбовець у розпорядженні">
                            у розпорядженні
                          </span>
                        ) : (
                          <span>{p.currentSubdivision || '—'}</span>
                        )}
                        <span>id {String(p.id).padStart(3, '0')}</span>
                      </div>
                    </div>
                  )
                })}
                {list.length > VISIBLE_CARDS && (
                  <button
                    className="btn sm ghost"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => toggleExpand(col.code)}
                  >
                    {expanded ? 'Згорнути' : `+ ще ${list.length - VISIBLE_CARDS}`}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <StatusHistoryForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={refetch}
      />
    </>
  )
}
