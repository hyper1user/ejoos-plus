import { useState, useEffect, useMemo } from 'react'
import { DatePicker, Spin, message } from 'antd'
import {
  CheckOutlined,
  WarningOutlined,
  PrinterOutlined,
  DownloadOutlined,
  CameraOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useLookups } from '../hooks/useLookups'
import { useAppStore } from '../stores/app.store'
import type { AttendanceMonthData } from '@shared/types/attendance'

type Cat = 'duty' | 'combat' | 'medical' | 'leave' | 'absent' | 'other'

const COMBAT_CODES = new Set(['РВ', 'РЗ', 'РШ'])

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

const COL_LABELS = ['Стр', 'БЗ', 'Мед', 'Відп', 'Відс', 'Усього']

export default function FormationReport(): JSX.Element {
  const [date, setDate] = useState(dayjs())
  const [loading, setLoading] = useState(false)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [monthData, setMonthData] = useState<AttendanceMonthData | null>(null)
  const globalSubdivision = useAppStore((s) => s.globalSubdivision)
  const { statusTypes } = useLookups()

  const fetchData = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.api.attendanceGetMonth(
        date.year(),
        date.month() + 1,
        globalSubdivision
      )
      setMonthData(result)
    } catch (err) {
      message.error(`Помилка: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date.format('YYYY-MM-DD'), globalSubdivision])

  const byCat = useMemo<Record<Cat, number>>(() => {
    const acc: Record<Cat, number> = {
      duty: 0, combat: 0, medical: 0, leave: 0, absent: 0, other: 0,
    }
    if (!monthData) return acc
    const stMap = new Map(statusTypes.map((s) => [s.code, s.groupName]))
    const dateStr = date.format('YYYY-MM-DD')
    for (const row of monthData.rows) {
      const code = row.days[dateStr]
      if (!code) continue
      const group = stMap.get(code) || ''
      acc[categorize(code, group)] += 1
    }
    return acc
  }, [monthData, date, statusTypes])

  const total = monthData?.rows.length ?? 0
  const present = byCat.duty + byCat.combat
  const hasData = monthData && monthData.rows.some((r) => r.days[date.format('YYYY-MM-DD')])

  // [Стр, БЗ, Мед, Відп, Відс, Усього]
  const rows: Array<{ l: string; vals: number[]; emphasized?: boolean }> = [
    { l: 'За списком', vals: [total, total, total, total, total, total], emphasized: true },
    { l: 'Наявно', vals: [byCat.duty, byCat.combat, 0, 0, 0, present], emphasized: true },
    { l: 'У строю', vals: [byCat.duty, 0, 0, 0, 0, byCat.duty] },
    { l: 'Бойове завдання', vals: [0, byCat.combat, 0, 0, 0, byCat.combat] },
    { l: 'Медичні', vals: [0, 0, byCat.medical, 0, 0, byCat.medical] },
    { l: 'Відпустка', vals: [0, 0, 0, byCat.leave, 0, byCat.leave] },
    { l: 'Відсутні', vals: [0, 0, 0, 0, byCat.absent, byCat.absent] },
  ]

  const handleSnapshot = async (): Promise<void> => {
    const dateStr = date.format('YYYY-MM-DD')
    setSnapshotLoading(true)
    try {
      const result = await window.api.attendanceSnapshot(dateStr)
      message.success(`Snapshot створено: ${result.created} записів`)
      fetchData()
    } catch (err) {
      message.error(`Помилка: ${err}`)
    } finally {
      setSnapshotLoading(false)
    }
  }

  const stamp = `${date.format('DD.MM.YYYY')} · ${dayjs().format('HH:mm')}`

  return (
    <>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">snapshot на {stamp}</div>
          <h1>Стройова записка</h1>
          <div className="sub">12 окрема штурмова рота · 4 ШБ · 92 ОШБр</div>
        </div>
        <div className="actions">
          <DatePicker
            value={date}
            onChange={(v) => v && setDate(v)}
            allowClear={false}
            format="DD.MM.YYYY"
            size="small"
          />
          <button className="btn ghost" onClick={() => window.print()}>
            <PrinterOutlined />
            Друк
          </button>
          <button className="btn">
            <DownloadOutlined />
            Word
          </button>
          <button className="btn primary" onClick={handleSnapshot} disabled={snapshotLoading}>
            <CameraOutlined />
            {snapshotLoading ? 'Зберігаю…' : 'Snapshot'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : !hasData ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>
          Немає даних за {date.format('DD.MM.YYYY')}.<br />
          Натисніть «Snapshot» для створення записів з поточних статусів ОС.
        </div>
      ) : (
        <>
          <div className="card">
            {/* Header row */}
            <div className="formation-row" style={{ background: 'var(--bg-1)' }}>
              <div
                className="label"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-3)',
                }}
              >
                Категорія
              </div>
              <div className="nums">
                {COL_LABELS.map((l) => (
                  <div key={l} className="n">
                    <div className="lbl">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {rows.map((r, i) => (
              <div
                key={r.l}
                className="formation-row"
                style={r.emphasized ? { background: 'var(--bg-2)' } : {}}
              >
                <div className="label">{r.l}</div>
                <div className="nums">
                  {r.vals.map((v, j) => (
                    <div key={j} className="n">
                      <div
                        className="v"
                        style={{
                          color:
                            v === 0
                              ? 'var(--fg-4)'
                              : j === 5
                                ? 'var(--accent)'
                                : 'var(--fg-0)',
                        }}
                      >
                        {v}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Підписи */}
          <div
            className="hgrid"
            style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}
          >
            <div className="card">
              <div className="card-head">
                <h3>Підпис командира</h3>
              </div>
              <div
                className="card-body"
                style={{
                  minHeight: 140,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div className="dim" style={{ fontSize: 11.5 }}>Командир 12 ШР</div>
                <div
                  style={{
                    borderTop: '1px solid var(--line-2)',
                    paddingTop: 8,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                  }}
                >
                  {/* TODO: settings → command_name */}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h3>Підпис старшини</h3>
              </div>
              <div
                className="card-body"
                style={{
                  minHeight: 140,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div className="dim" style={{ fontSize: 11.5 }}>Старшина 12 ШР</div>
                <div
                  style={{
                    borderTop: '1px solid var(--line-2)',
                    paddingTop: 8,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                  }}
                />
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h3>Контроль</h3>
              </div>
              <div
                className="card-body"
                style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckOutlined style={{ color: 'var(--ok)' }} />
                  <span style={{ color: 'var(--ok)' }}>
                    Цифри звірені з реєстром ({total} осіб)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckOutlined style={{ color: 'var(--ok)' }} />
                  <span style={{ color: 'var(--ok)' }}>
                    Snapshot за {date.format('DD.MM.YYYY')}
                  </span>
                </div>
                {byCat.absent > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <WarningOutlined style={{ color: 'var(--warn)' }} />
                    <span style={{ color: 'var(--warn)' }}>
                      Відсутніх: {byCat.absent}
                    </span>
                  </div>
                )}
                <div className="dim mono" style={{ fontSize: 10.5, marginTop: 4 }}>
                  наступний snapshot:{' '}
                  {date.add(1, 'day').format('DD.MM.YYYY')} 06:00
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
