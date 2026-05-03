import { useState } from 'react'
import { DatePicker, Spin, message } from 'antd'
import { CameraOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMonthlyAttendance } from '../hooks/useAttendance'
import { useAppStore } from '../stores/app.store'
import AttendanceGrid from '../components/attendance/AttendanceGrid'

const LEGEND: Array<{ c: string; t: string; l: string }> = [
  { c: '', t: '+', l: 'У строю' },
  { c: 's-c', t: 'БЗ', l: 'Бойове' },
  { c: 's-w', t: 'НР', l: 'Наряд' },
  { c: 's-l', t: '501', l: 'Хвороба' },
  { c: 's-v', t: 'В', l: 'Відпустка' },
  { c: 's-x', t: '×', l: 'Відсутні' },
]

const MONTHS_UK = [
  'Січ',
  'Лют',
  'Бер',
  'Кві',
  'Тра',
  'Чер',
  'Лип',
  'Сер',
  'Вер',
  'Жов',
  'Лис',
  'Гру',
]

export default function MonthlyAttendance(): JSX.Element {
  const globalSubdivision = useAppStore((s) => s.globalSubdivision)
  const today = dayjs()
  const [year, setYear] = useState(today.year())
  const [month, setMonth] = useState(today.month() + 1)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  const { data, loading, refetch } = useMonthlyAttendance(year, month, globalSubdivision)

  const handleMonthChange = (value: dayjs.Dayjs | null): void => {
    if (value) {
      setYear(value.year())
      setMonth(value.month() + 1)
    }
  }

  const handleSnapshot = async (): Promise<void> => {
    const date = dayjs().format('YYYY-MM-DD')
    setSnapshotLoading(true)
    try {
      const result = await window.api.attendanceSnapshot(date)
      message.success(`Snapshot створено: ${result.created} записів`)
      refetch()
    } catch (err) {
      message.error(`Помилка: ${err}`)
    } finally {
      setSnapshotLoading(false)
    }
  }

  // Швидкі перемикачі останніх 3 місяців
  const monthSwitches = [-1, 0, 1].map((d) => {
    const m = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).add(d, 'month')
    return { y: m.year(), m: m.month() + 1 }
  })

  return (
    <>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">
            табель · {MONTHS_UK[month - 1].toLowerCase()}{' '}
            {String(year).slice(-2)}
          </div>
          <h1>Місячний табель</h1>
          <div className="sub">
            Деталізація присутності за днями. Сьогодні — {today.format('DD.MM.YYYY')}
          </div>
        </div>
        <div className="actions">
          <div className="seg-control">
            {monthSwitches.map((s) => {
              const active = s.y === year && s.m === month
              return (
                <button
                  key={`${s.y}-${s.m}`}
                  className={active ? 'on' : ''}
                  onClick={() => {
                    setYear(s.y)
                    setMonth(s.m)
                  }}
                  style={{ minWidth: 38, lineHeight: 1.1, padding: '0 8px' }}
                >
                  <span style={{ display: 'block' }}>{MONTHS_UK[s.m - 1]}</span>
                  <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)' }}>
                    '{String(s.y).slice(-2)}
                  </span>
                </button>
              )
            })}
          </div>
          <DatePicker
            picker="month"
            value={dayjs(`${year}-${String(month).padStart(2, '0')}-01`)}
            onChange={handleMonthChange}
            allowClear={false}
            format="MMMM YYYY"
            size="small"
          />
          <button className="btn">
            <DownloadOutlined />
            Експорт
          </button>
          <button className="btn primary" onClick={handleSnapshot} disabled={snapshotLoading}>
            <CameraOutlined />
            {snapshotLoading ? 'Зберігаю…' : 'Snapshot'}
          </button>
        </div>
      </div>

      {/* Легенда */}
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
        <span className="eyebrow">умовні позначення</span>
        {LEGEND.map((x) => (
          <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              className={`cell ${x.c}`}
              style={{
                width: 24,
                height: 22,
                display: 'grid',
                placeItems: 'center',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                borderRadius: 2,
                background: 'var(--bg-2)',
                border: '1px solid var(--line-1)',
              }}
            >
              {x.t}
            </div>
            <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{x.l}</span>
          </div>
        ))}
      </div>

      {/* Сітка */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : data && data.rows.length > 0 ? (
          <AttendanceGrid year={year} month={month} rows={data.rows} onRefetch={refetch} />
        ) : (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: 'var(--fg-3)',
              fontSize: 12.5,
            }}
          >
            Немає даних. Натисніть «Snapshot» для заповнення табелю
            з поточних статусів ОС.
          </div>
        )}
      </div>
    </>
  )
}
