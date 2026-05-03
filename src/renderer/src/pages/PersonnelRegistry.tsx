import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popconfirm, message, Tooltip } from 'antd'
import {
  PlusOutlined,
  DownloadOutlined,
  FilterOutlined,
  SearchOutlined,
  RightOutlined,
  EditOutlined,
  DeleteOutlined,
  TableOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { PersonnelListItem } from '@shared/types/personnel'
import PersonnelForm from '../components/personnel/PersonnelForm'
import { useLookups } from '../hooks/useLookups'
import { usePersonnelList } from '../hooks/usePersonnel'
import { useAppStore } from '../stores/app.store'

type Cat = 'all' | 'duty' | 'combat' | 'medical' | 'leave' | 'absent'

const COMBAT_CODES = new Set(['ВБВ', 'РВ', 'РЗ'])

const CAT_LABELS: Record<Cat, string> = {
  all: 'Усі',
  duty: 'У строю',
  combat: 'БЗ',
  medical: 'Мед',
  leave: 'Відп',
  absent: 'Відс',
}

function categorizeStatus(code: string | null, group: string | null): Cat | 'other' {
  if (!code || !group) return 'other'
  if (group === 'Лікування') return 'medical'
  if (group === 'Відпустка') return 'leave'
  if (group === 'Інше' || group === 'Загиблі') return 'absent'
  if (group === 'Так') return COMBAT_CODES.has(code) ? 'combat' : 'duty'
  return 'other'
}

function pillClassFor(cat: Cat | 'other'): string {
  if (cat === 'duty') return 'pill duty'
  if (cat === 'combat') return 'pill combat'
  if (cat === 'medical') return 'pill medical'
  if (cat === 'leave') return 'pill leave'
  if (cat === 'absent') return 'pill absent'
  return 'pill muted'
}

function callsignInitials(callsign: string | null): string {
  if (!callsign) return '—'
  return callsign.slice(0, 3).toUpperCase()
}

const PAGE_SIZE = 50

export default function PersonnelRegistry(): JSX.Element {
  const navigate = useNavigate()
  const { statusTypes } = useLookups()
  const globalSubdivision = useAppStore((s) => s.globalSubdivision)

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<Cat>('all')
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<PersonnelListItem | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const filters = useMemo(
    () => ({
      search: search || undefined,
      subdivision: globalSubdivision,
      status: 'active',
    }),
    [search, globalSubdivision]
  )

  const { data, loading, refetch } = usePersonnelList(filters)

  // statusCode → groupName
  const groupByCode = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of statusTypes) m[s.code] = s.groupName
    return m
  }, [statusTypes])

  const filtered = useMemo(() => {
    if (catFilter === 'all') return data
    return data.filter((p) => {
      const cat = categorizeStatus(p.currentStatusCode, groupByCode[p.currentStatusCode || ''] ?? null)
      return cat === catFilter
    })
  }, [data, catFilter, groupByCode])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  )
  const fromIdx = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const toIdx = Math.min(safePage * PAGE_SIZE, filtered.length)

  const handleEdit = async (record: PersonnelListItem, e: React.MouseEvent) => {
    e.stopPropagation()
    const full = await window.api.personnelGet(record.id)
    setEditRecord(full as PersonnelListItem)
    setDrawerOpen(true)
  }

  const handleDelete = async (id: number) => {
    await window.api.personnelDelete(id)
    message.success('Особу виключено')
    refetch()
  }

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">
            особовий склад · {filtered.length} / {data.length}
          </div>
          <h1>Реєстр</h1>
          <div className="sub">
            Список особового складу 12 ШР станом на {dayjs().format('DD.MM.YYYY')}
          </div>
        </div>
        <div className="actions">
          <button className="btn ghost">
            <FilterOutlined />
            Фільтр
          </button>
          <button className="btn">
            <DownloadOutlined />
            Експорт
          </button>
          <button
            className="btn primary"
            onClick={() => {
              setEditRecord(null)
              setDrawerOpen(true)
            }}
          >
            <PlusOutlined />
            Додати бійця
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div
        className="card"
        style={{
          padding: 10,
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="eyebrow">категорія</span>
          <div className="seg-control">
            {(Object.keys(CAT_LABELS) as Cat[]).map((c) => (
              <button
                key={c}
                className={catFilter === c ? 'on' : ''}
                onClick={() => {
                  setCatFilter(c)
                  setPage(1)
                }}
              >
                {CAT_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div className="search-bar" style={{ width: 240 }}>
          <SearchOutlined style={{ fontSize: 13 }} />
          <input
            placeholder="ВОВК, Коваленко…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <div className="seg-control">
          <Tooltip title="Таблиця">
            <button className="on">
              <TableOutlined style={{ fontSize: 13 }} />
            </button>
          </Tooltip>
          <Tooltip title="Картки (скоро)">
            <button>
              <AppstoreOutlined style={{ fontSize: 13 }} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 70 }}>№</th>
                <th>Боєць</th>
                <th style={{ width: 160 }}>Звання</th>
                <th style={{ width: 80 }}>Підр.</th>
                <th>Посада</th>
                <th style={{ width: 150 }}>Статус</th>
                <th style={{ width: 130 }}>Телефон</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && paged.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-3)' }}>
                    Завантаження…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-3)' }}>
                    Записів не знайдено
                  </td>
                </tr>
              )}
              {paged.map((p, i) => {
                const cat = categorizeStatus(
                  p.currentStatusCode,
                  groupByCode[p.currentStatusCode || ''] ?? null
                )
                const idx = (safePage - 1) * PAGE_SIZE + i + 1
                return (
                  <tr
                    key={p.id}
                    className={p.id === selectedId ? 'selected' : ''}
                    onClick={() => setSelectedId(p.id)}
                    onDoubleClick={() => navigate(`/personnel/${p.id}`)}
                  >
                    <td className="num dim">{String(idx).padStart(3, '0')}</td>
                    <td>
                      <div className="cell-name">
                        <div className="avatar sm">{callsignInitials(p.callsign)}</div>
                        <div className="name">
                          <b>{p.fullName}</b>
                          <span>{p.callsign || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="rank">{p.rankName || '—'}</span>
                    </td>
                    <td>
                      <span className="mono dim" style={{ fontSize: 11 }}>
                        {p.currentSubdivision || '—'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--fg-1)' }}>
                      {p.positionTitle || p.currentPositionIdx || '—'}
                    </td>
                    <td>
                      {p.currentStatusCode ? (
                        <span className={pillClassFor(cat)}>
                          <span className="dot" />
                          {p.currentStatusCode}
                        </span>
                      ) : (
                        <span className="dim mono" style={{ fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className="mono dim" style={{ fontSize: 11 }}>
                        {p.phone || '—'}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Tooltip title="Редагувати">
                          <button
                            className="btn sm ghost"
                            style={{ padding: '0 6px' }}
                            onClick={(e) => handleEdit(p, e)}
                          >
                            <EditOutlined />
                          </button>
                        </Tooltip>
                        <Popconfirm
                          title="Виключити особу?"
                          description="Запис буде переміщено до виключених"
                          onConfirm={() => handleDelete(p.id)}
                          okText="Так"
                          cancelText="Ні"
                        >
                          <button
                            className="btn sm ghost"
                            style={{ padding: '0 6px', color: 'var(--crit)' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DeleteOutlined />
                          </button>
                        </Popconfirm>
                        <button
                          className="btn sm ghost"
                          style={{ padding: '0 6px' }}
                          onClick={() => navigate(`/personnel/${p.id}`)}
                        >
                          <RightOutlined />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--line-1)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 11.5,
            color: 'var(--fg-3)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span>
            {fromIdx}–{toIdx} із {filtered.length}
          </span>
          <div style={{ flex: 1 }} />
          <button
            className="btn sm ghost"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ opacity: safePage <= 1 ? 0.4 : 1 }}
          >
            ‹
          </button>
          <span>
            {safePage} / {totalPages}
          </span>
          <button
            className="btn sm ghost"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{ opacity: safePage >= totalPages ? 0.4 : 1 }}
          >
            ›
          </button>
        </div>
      </div>

      <PersonnelForm
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditRecord(null)
        }}
        onSaved={refetch}
        editRecord={editRecord as never}
      />
    </>
  )
}
