import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DatePicker, Select } from 'antd'
import { PlusOutlined, FilterOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMovementList } from '../hooks/useMovements'
import { useAppStore } from '../stores/app.store'
import MovementForm from '../components/movements/MovementForm'
import { MOVEMENT_ORDER_TYPES } from '@shared/enums/categories'

const { RangePicker } = DatePicker

type FeedFilter = 'all' | 'assignment' | 'transfer' | 'status'

const FEED_LABELS: Record<FeedFilter, string> = {
  all: 'Усі',
  assignment: 'Призначення',
  transfer: 'Переведення',
  status: 'Статуси',
}

export default function Movements(): JSX.Element {
  const navigate = useNavigate()
  const globalSubdivision = useAppStore((s) => s.globalSubdivision)

  const [orderTypeFilter, setOrderTypeFilter] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[string | undefined, string | undefined]>([
    undefined,
    undefined,
  ])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')
  const [showPeriodFilter, setShowPeriodFilter] = useState(false)

  const filters = useMemo(
    () => ({
      orderType: orderTypeFilter,
      subdivision: globalSubdivision,
      dateFrom: dateRange[0],
      dateTo: dateRange[1],
    }),
    [orderTypeFilter, globalSubdivision, dateRange]
  )

  const { data, refetch } = useMovementList(filters)

  // KPI: останні 30 діб
  const last30 = useMemo(() => {
    const cutoff = dayjs().subtract(30, 'day')
    return data.filter((m) => m.dateFrom && dayjs(m.dateFrom).isAfter(cutoff))
  }, [data])

  const totalEvents = last30.length
  const assignments = useMemo(
    () => last30.filter((m) => m.orderType.includes('Зарахуванн') || m.orderType.includes('Призначен')).length,
    [last30]
  )
  const transfers = useMemo(
    () => last30.filter((m) => m.orderType.includes('Переведенн') || m.orderType.includes('Переміщенн')).length,
    [last30]
  )
  const statusChanges = useMemo(
    () => last30.filter((m) => m.orderType.includes('розпорядженн') || m.orderType.includes('Виключенн')).length,
    [last30]
  )

  // Bar chart за днями (14 днів)
  const dayBuckets = useMemo(() => {
    const days: { l: string; v: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = dayjs().subtract(i, 'day')
      const v = data.filter((m) => m.dateFrom && dayjs(m.dateFrom).isSame(d, 'day')).length
      days.push({ l: i % 3 === 0 ? d.format('DD') : '', v })
    }
    return days
  }, [data])

  const maxBar = Math.max(...dayBuckets.map((d) => d.v), 1)

  // Top initiators
  const topIssuers = useMemo(() => {
    const m = new Map<string, number>()
    for (const mv of last30) {
      const k = mv.orderIssuer || '—'
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [last30])

  const filtered = useMemo(() => {
    if (feedFilter === 'all') return data
    if (feedFilter === 'assignment')
      return data.filter((m) => m.orderType.includes('Зарахуванн') || m.orderType.includes('Призначен'))
    if (feedFilter === 'transfer')
      return data.filter((m) => m.orderType.includes('Переведенн') || m.orderType.includes('Переміщенн'))
    if (feedFilter === 'status')
      return data.filter((m) => m.orderType.includes('розпорядженн') || m.orderType.includes('Виключенн'))
    return data
  }, [data, feedFilter])

  const recent = filtered.slice(0, 30)

  return (
    <>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">переміщення · ланцюжок призначень</div>
          <h1>Журнал переміщень</h1>
          <div className="sub">
            Усі зміни посади та підрозділу за період. Підстава — наказ.
          </div>
        </div>
        <div className="actions">
          <button
            className={'btn' + (showPeriodFilter ? ' primary' : '')}
            onClick={() => setShowPeriodFilter((v) => !v)}
          >
            <FilterOutlined />
            За період
          </button>
          <button className="btn primary" onClick={() => setDrawerOpen(true)}>
            <PlusOutlined />
            Нове переміщення
          </button>
        </div>
      </div>

      {showPeriodFilter && (
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
          <span className="eyebrow">тип</span>
          <Select
            placeholder="Тип переміщення"
            allowClear
            style={{ width: 200 }}
            value={orderTypeFilter}
            onChange={setOrderTypeFilter}
            options={MOVEMENT_ORDER_TYPES.map((t) => ({ value: t, label: t }))}
          />
          <span className="eyebrow">період</span>
          <RangePicker
            format="DD.MM.YYYY"
            onChange={(dates) => {
              setDateRange([
                dates?.[0]?.format('YYYY-MM-DD'),
                dates?.[1]?.format('YYYY-MM-DD'),
              ])
            }}
          />
        </div>
      )}

      <div className="hgrid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        {/* Стрічка */}
        <div className="card">
          <div className="card-head">
            <h3>Стрічка · 30 днів</h3>
            <div className="seg-control">
              {(Object.keys(FEED_LABELS) as FeedFilter[]).map((c) => (
                <button
                  key={c}
                  className={feedFilter === c ? 'on' : ''}
                  onClick={() => setFeedFilter(c)}
                >
                  {FEED_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: 0 }}>
            {recent.length === 0 && (
              <div style={{ padding: 24, color: 'var(--fg-3)', fontSize: 12, textAlign: 'center' }}>
                Подій немає
              </div>
            )}
            {recent.map((m, i) => {
              const when = m.dateFrom ? dayjs(m.dateFrom) : null
              const orderTag =
                [m.orderIssuer, m.orderNumber ? `№${m.orderNumber}` : null]
                  .filter(Boolean)
                  .join(' ') || '—'
              return (
                <div
                  key={m.id}
                  onClick={() => navigate(`/personnel/${m.personnelId}`)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 80px 1fr 100px',
                    gap: 12,
                    padding: '10px 14px',
                    borderTop: i ? '1px solid var(--line-1)' : 'none',
                    alignItems: 'center',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div className="mono tnum" style={{ fontSize: 12, color: 'var(--fg-1)' }}>
                      {when ? when.format('DD.MM.YYYY') : '—'}
                    </div>
                    <div className="mono dim" style={{ fontSize: 10 }}>
                      {when ? when.format('HH:mm') : ''}
                    </div>
                  </div>
                  <div
                    className="mono"
                    style={{
                      color: 'var(--accent)',
                      fontWeight: 600,
                      fontSize: 11.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {/* шукаємо callsign — у MovementListItem його нема, fallback ПІБ */}
                    {m.fullName.split(' ')[0]}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: 'var(--fg-0)' }}>
                      {m.orderType}:{' '}
                      <span style={{ color: 'var(--fg-1)', fontWeight: 400 }}>
                        {m.fullName}
                      </span>
                    </div>
                    <div className="dim mono" style={{ fontSize: 10.5, marginTop: 2 }}>
                      {m.previousPositionTitle ?? 'без посади'} →{' '}
                      {m.positionTitle ?? '—'}
                      {m.subdivisionCode ? ` · ${m.subdivisionCode}` : ''}
                    </div>
                  </div>
                  <div className="mono dim" style={{ fontSize: 11, textAlign: 'right' }}>
                    {orderTag}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* KPI */}
        <div className="card">
          <div className="card-head">
            <h3>Статистика за 30 діб</h3>
          </div>
          <div
            className="card-body"
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { l: 'Усього подій', v: totalEvents },
                { l: 'Призначень', v: assignments },
                { l: 'Переведень', v: transfers },
                { l: 'Інших', v: statusChanges },
              ].map((k, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--line-1)',
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <div className="eyebrow">{k.l}</div>
                  <div
                    className="tnum mono"
                    style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}
                  >
                    {k.v}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                За днями
              </div>
              <svg width="100%" height="80" viewBox="0 0 340 80" preserveAspectRatio="none">
                {dayBuckets.map((d, i) => {
                  const w = 340 / dayBuckets.length
                  const h = (d.v / maxBar) * 60
                  const x = i * w + 2
                  const y = 70 - h
                  return (
                    <g key={i}>
                      <rect
                        x={x}
                        y={y}
                        width={w - 4}
                        height={Math.max(h, 1)}
                        fill={i >= dayBuckets.length - 7 ? 'var(--accent)' : 'var(--bg-4)'}
                        rx={1}
                      />
                      {d.l && (
                        <text
                          x={x + (w - 4) / 2}
                          y={78}
                          textAnchor="middle"
                          fill="var(--fg-3)"
                          fontSize="9"
                          fontFamily="var(--font-mono)"
                        >
                          {d.l}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>

            <div className="divider" />

            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Топ ініціаторів
              </div>
              {topIssuers.length === 0 && (
                <div className="dim" style={{ fontSize: 12 }}>—</div>
              )}
              {topIssuers.map(([who, ct]) => (
                <div
                  key={who}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    fontSize: 12,
                  }}
                >
                  <span>{who}</span>
                  <span className="mono tnum dim">{ct}</span>
                </div>
              ))}
            </div>

            <div className="divider" />

            <button
              className="btn ghost"
              style={{ justifyContent: 'space-between', width: '100%' }}
              onClick={() => setShowPeriodFilter(true)}
            >
              <span>Розгорнутий фільтр</span>
              <RightOutlined style={{ fontSize: 11 }} />
            </button>
          </div>
        </div>
      </div>

      <MovementForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={refetch}
      />
    </>
  )
}
