import { useState, useEffect, useMemo, useRef } from 'react'
import { Spin, message } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { RANKS, RankCategory } from '@shared/enums/ranks'

type CategoryFilter = 'all' | RankCategory.Officers | RankCategory.Sergeants | RankCategory.Soldiers

interface StaffRosterRow {
  positionIndex: string
  positionTitle: string
  positionDetail: string | null
  subdivisionId: number
  subdivisionCode: string
  subdivisionName: string
  subdivisionSortOrder: number
  subdivisionParentId: number | null
  personnelId: number | null
  lastName: string | null
  firstName: string | null
  patronymic: string | null
  callsign: string | null
  rankName: string | null
  ipn: string | null
  dateOfBirth: string | null
  currentStatusCode: string | null
  statusName: string | null
  statusGroupName: string | null
  fitness: string | null
  statusDateFrom: string | null
  statusDateTo: string | null
  statusComment: string | null
  statusPresenceGroup: string | null
}

interface StaffRosterSummary {
  totalPositions: number
  totalPersonnel: number
  onPositions: number
  present: number
  statusCounts: Record<string, number>
  limitedFitness: number
}

interface SubdivisionGroup {
  subdivisionId: number
  subdivisionCode: string
  subdivisionName: string
  subdivisionSortOrder: number
  subdivisionParentId: number | null
  rows: StaffRosterRow[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = dayjs(dateStr)
  return d.isValid() ? d.format('DD.MM.YYYY') : ''
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = dayjs(dateStr)
  return d.isValid() ? d.format('DD.MM') : ''
}

function calcAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null
  const dob = dayjs(dateOfBirth)
  if (!dob.isValid()) return null
  return dayjs().diff(dob, 'year')
}

function buildRemarks(row: StaffRosterRow): string {
  const parts: string[] = []
  if (
    row.currentStatusCode &&
    row.statusGroupName !== 'Так' &&
    row.currentStatusCode !== 'РВ' &&
    row.currentStatusCode !== 'ППД'
  ) {
    let remark = row.currentStatusCode
    if (row.statusDateFrom) {
      remark += ' ' + formatShortDate(row.statusDateFrom)
      if (row.statusDateTo) {
        remark += '-' + formatShortDate(row.statusDateTo)
      }
    }
    parts.push(remark)
  }
  return parts.join(', ')
}

function getLocation(row: StaffRosterRow): string {
  if (!row.personnelId) return ''
  if (row.statusComment) return row.statusComment
  if (row.statusPresenceGroup) return row.statusPresenceGroup
  // Default location for present statuses
  if (
    row.statusGroupName === 'Так' ||
    row.currentStatusCode === 'РВ' ||
    row.currentStatusCode === 'ППД' ||
    row.currentStatusCode === 'АДП'
  ) {
    return 'Покровський напрямок'
  }
  if (row.currentStatusCode === 'ШП' || row.currentStatusCode === 'НП') {
    return 'Шпиталь'
  }
  return ''
}

// Determine subdivision header color based on hierarchy level
function getSubdivisionColor(
  group: SubdivisionGroup,
  parentMap: Map<number, SubdivisionGroup[]>
): { bg: string; text: string } {
  // Root-level (no parent or parent is the main unit)
  if (!group.subdivisionParentId) {
    return { bg: '#2d5f2d', text: '#fff' }
  }
  // Check depth
  const parent = parentMap.get(group.subdivisionParentId)
  if (parent) {
    return { bg: '#b45309', text: '#fff' } // platoon level
  }
  return { bg: '#c0392b', text: '#fff' } // squad/team level
}

// Map rankName → category
const RANK_TO_CATEGORY = new Map<string, RankCategory>(
  RANKS.map((r) => [r.name, r.category])
)

export default function StaffRoster(): JSX.Element {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{
    rows: StaffRosterRow[]
    summary: StaffRosterSummary
    statusTypes: { code: string; name: string; groupName: string }[]
  } | null>(null)
  const [date] = useState(dayjs())
  const printRef = useRef<HTMLDivElement>(null)
  const [subFilter, setSubFilter] = useState<string>('all')
  const [catFilter, setCatFilter] = useState<CategoryFilter>('all')

  const fetchData = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.api.staffRoster()
      setData(result)
    } catch (err) {
      message.error(`Помилка: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Усі коди підрозділів (для фільтра)
  const subdivisionOptions = useMemo(() => {
    if (!data) return []
    const seen = new Map<string, { code: string; name: string; sortOrder: number }>()
    for (const r of data.rows) {
      if (!seen.has(r.subdivisionCode)) {
        seen.set(r.subdivisionCode, {
          code: r.subdivisionCode,
          name: r.subdivisionName,
          sortOrder: r.subdivisionSortOrder,
        })
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.sortOrder - b.sortOrder)
  }, [data])

  // Filtered rows
  const filteredRows = useMemo<StaffRosterRow[]>(() => {
    if (!data) return []
    return data.rows.filter((r) => {
      if (subFilter !== 'all' && r.subdivisionCode !== subFilter) return false
      if (catFilter !== 'all') {
        const cat = r.rankName ? RANK_TO_CATEGORY.get(r.rankName) : undefined
        if (cat !== catFilter) return false
      }
      return true
    })
  }, [data, subFilter, catFilter])

  // Group rows by subdivision, maintaining hierarchy order
  const groups = useMemo<SubdivisionGroup[]>(() => {
    if (filteredRows.length === 0) return []

    const groupMap = new Map<number, SubdivisionGroup>()

    for (const row of filteredRows) {
      if (!groupMap.has(row.subdivisionId)) {
        groupMap.set(row.subdivisionId, {
          subdivisionId: row.subdivisionId,
          subdivisionCode: row.subdivisionCode,
          subdivisionName: row.subdivisionName,
          subdivisionSortOrder: row.subdivisionSortOrder,
          subdivisionParentId: row.subdivisionParentId,
          rows: []
        })
      }
      groupMap.get(row.subdivisionId)!.rows.push(row)
    }

    return Array.from(groupMap.values()).sort(
      (a, b) => a.subdivisionSortOrder - b.subdivisionSortOrder
    )
  }, [filteredRows])

  const handlePrint = () => {
    window.print()
  }

  const summary = data?.summary

  return (
    <div>
      {/* Screen controls - hidden when printing */}
      <div className="staff-roster-controls no-print">
        <div className="page-header">
          <div className="titles">
            <div className="eyebrow">штат · документ для друку</div>
            <h1>Штатний розпис</h1>
            <div className="sub">
              12 ШР · 4 ШБ · 92 ОШБр
              {summary
                ? ` · ${summary.totalPersonnel} осіб · ${summary.totalPositions} посад`
                : ''}
              {(subFilter !== 'all' || catFilter !== 'all') &&
                ` · показано ${filteredRows.length}`}
            </div>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={handlePrint} disabled={!data}>
              <PrinterOutlined />
              Друк
            </button>
          </div>
        </div>

        {/* Фільтр-бар */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="eyebrow">підрозділ</span>
            <div className="seg-control" style={{ flexWrap: 'wrap' }}>
              <button
                className={subFilter === 'all' ? 'on' : ''}
                onClick={() => setSubFilter('all')}
              >
                Усі
              </button>
              {subdivisionOptions.map((s) => (
                <button
                  key={s.code}
                  className={subFilter === s.code ? 'on' : ''}
                  onClick={() => setSubFilter(s.code)}
                  title={s.name}
                >
                  {s.code}
                </button>
              ))}
            </div>
          </div>
          <div style={{ width: 1, height: 22, background: 'var(--line-1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eyebrow">категорія</span>
            <div className="seg-control">
              <button className={catFilter === 'all' ? 'on' : ''} onClick={() => setCatFilter('all')}>
                Усі
              </button>
              <button
                className={catFilter === RankCategory.Officers ? 'on' : ''}
                onClick={() => setCatFilter(RankCategory.Officers)}
              >
                Офіцери
              </button>
              <button
                className={catFilter === RankCategory.Sergeants ? 'on' : ''}
                onClick={() => setCatFilter(RankCategory.Sergeants)}
              >
                Сержанти
              </button>
              <button
                className={catFilter === RankCategory.Soldiers ? 'on' : ''}
                onClick={() => setCatFilter(RankCategory.Soldiers)}
              >
                Солдати
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : data ? (
        <div ref={printRef} className="staff-roster-print">
          {/* Header */}
          <table className="roster-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '30px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '50px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '30px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="rt-th rt-th-rotated">
                  <div className="rt-rotated-text">№ з/п</div>
                </th>
                <th className="rt-th">Посада</th>
                <th className="rt-th">Військове звання</th>
                <th className="rt-th">Прізвище</th>
                <th className="rt-th">Ім&apos;я</th>
                <th className="rt-th">По-батькові</th>
                <th className="rt-th">Позивний</th>
                <th className="rt-th rt-th-rotated">
                  <div className="rt-rotated-text">Категорія</div>
                </th>
                <th className="rt-th">Примітки</th>
                <th className="rt-th">Місцезнаходжен ня</th>
                <th className="rt-th">ІПН</th>
                <th className="rt-th">Дата народження</th>
                <th className="rt-th">Вік</th>
              </tr>
            </thead>
            <tbody>
              {/* Summary rows */}
              <tr className="rt-summary-row">
                <td colSpan={13} style={{ padding: '4px 8px', borderBottom: '1px solid #ccc' }}>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11 }}>
                    <span>
                      Дата: <b>{date.format('DD.MM.YYYY')}</b>
                    </span>
                  </div>
                </td>
              </tr>
              <tr className="rt-summary-row">
                <td colSpan={13} style={{ padding: '4px 8px', borderBottom: '1px solid #ccc' }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 24,
                      flexWrap: 'wrap',
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  >
                    <span>
                      За штатом: <b style={{ color: '#c00' }}>{summary?.totalPositions}</b>
                    </span>
                    <span>
                      В наявності: <b style={{ color: '#c00' }}>{summary?.present}</b>
                    </span>
                    <span>
                      Шпиталь:{' '}
                      <b style={{ color: '#c00' }}>
                        {(summary?.statusCounts?.['ШП'] ?? 0) +
                          (summary?.statusCounts?.['НП'] ?? 0)}
                      </b>
                    </span>
                    <span>
                      ВПХ:{' '}
                      <b style={{ color: '#c00' }}>{summary?.statusCounts?.['ВПХ'] ?? 0}</b>
                    </span>
                  </div>
                </td>
              </tr>
              <tr className="rt-summary-row">
                <td colSpan={13} style={{ padding: '4px 8px', borderBottom: '2px solid #333' }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 24,
                      flexWrap: 'wrap',
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  >
                    <span>
                      За списком: <b style={{ color: '#c00' }}>{summary?.totalPersonnel}</b>
                    </span>
                    <span>
                      На позиціях: <b style={{ color: '#c00' }}>{summary?.onPositions}</b>
                    </span>
                    <span>
                      Обмежено придатні:{' '}
                      <b style={{ color: '#c00' }}>{summary?.limitedFitness}</b>
                    </span>
                    <span>
                      СЗЧ:{' '}
                      <b style={{ color: '#c00' }}>{summary?.statusCounts?.['СЗЧ'] ?? 0}</b>
                    </span>
                    <span>
                      ВП:{' '}
                      <b style={{ color: '#c00' }}>{summary?.statusCounts?.['ВП'] ?? 0}</b>
                    </span>
                  </div>
                </td>
              </tr>

              {/* Subdivision groups */}
              {groups.map((group) => {
                let rowNum = 0
                return [
                  <tr key={`sub-${group.subdivisionId}`} className="rt-subdivision-header">
                    <td
                      colSpan={13}
                      style={{
                        background:
                          !group.subdivisionParentId
                            ? '#2d5f2d'
                            : '#b45309',
                        color: '#fff',
                        fontWeight: 700,
                        padding: '3px 8px',
                        fontSize: 11,
                        textAlign: 'center',
                        borderBottom: '1px solid #333'
                      }}
                    >
                      {group.subdivisionName}
                    </td>
                  </tr>,
                  ...group.rows.map((row) => {
                    rowNum++
                    const age = calcAge(row.dateOfBirth)
                    const remarks = buildRemarks(row)
                    const location = getLocation(row)
                    const isEmpty = !row.personnelId

                    return (
                      <tr
                        key={`row-${row.positionIndex}`}
                        className={isEmpty ? 'rt-row rt-empty' : 'rt-row'}
                      >
                        <td className="rt-td rt-td-center">{rowNum}</td>
                        <td className="rt-td">{row.positionTitle}</td>
                        <td className="rt-td">{row.rankName ?? row.positionDetail ?? ''}</td>
                        <td className="rt-td rt-td-bold">{row.lastName ?? ''}</td>
                        <td className="rt-td">{row.firstName ?? ''}</td>
                        <td className="rt-td">{row.patronymic ?? ''}</td>
                        <td className="rt-td rt-td-bold">{row.callsign ?? ''}</td>
                        <td className="rt-td rt-td-center rt-td-small">
                          {row.currentStatusCode &&
                          row.statusGroupName !== 'Так' &&
                          row.currentStatusCode !== 'РВ' &&
                          row.currentStatusCode !== 'ППД'
                            ? row.currentStatusCode
                            : ''}
                        </td>
                        <td className="rt-td rt-td-small">{remarks}</td>
                        <td className="rt-td rt-td-small">{location}</td>
                        <td className="rt-td rt-td-mono">{row.ipn ?? ''}</td>
                        <td className="rt-td rt-td-center">{formatDate(row.dateOfBirth)}</td>
                        <td className="rt-td rt-td-center rt-td-bold">
                          {age !== null ? age : ''}
                        </td>
                      </tr>
                    )
                  })
                ]
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <style>{`
        .staff-roster-print {
          padding: 8px;
          overflow-x: auto;
        }

        .roster-table {
          border-collapse: collapse;
          font-family: 'Times New Roman', serif;
          font-size: 10px;
          line-height: 1.2;
        }

        .rt-th {
          border: 1px solid #333;
          padding: 4px 3px;
          text-align: center;
          font-weight: 700;
          font-size: 9px;
          background: #f5f5dc;
          vertical-align: middle;
          white-space: normal;
          word-break: break-word;
        }

        .rt-th-rotated {
          width: 30px;
          max-width: 30px;
          padding: 2px;
        }

        .rt-rotated-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
          white-space: nowrap;
          font-size: 9px;
        }

        .rt-td {
          border: 1px solid #999;
          padding: 2px 3px;
          vertical-align: middle;
          font-size: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }

        .rt-td-center {
          text-align: center;
        }

        .rt-td-bold {
          font-weight: 700;
        }

        .rt-td-small {
          font-size: 8px;
          white-space: normal;
          word-break: break-word;
        }

        .rt-td-mono {
          font-family: 'Consolas', monospace;
          font-size: 9px;
          letter-spacing: -0.3px;
        }

        .rt-row:hover {
          background: #f0f7ff;
        }

        .rt-empty .rt-td {
          color: #999;
          background: #fafafa;
        }

        .rt-summary-row td {
          border-left: 1px solid #ccc;
          border-right: 1px solid #ccc;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0;
            padding: 0;
          }

          .staff-roster-print {
            padding: 0;
          }

          .roster-table {
            font-size: 8px;
            width: 100% !important;
          }

          .rt-th {
            font-size: 7px;
            padding: 2px 1px;
            background: #f5f5dc !important;
          }

          .rt-td {
            font-size: 8px;
            padding: 1px 2px;
          }

          .rt-td-small {
            font-size: 7px;
          }

          .rt-td-mono {
            font-size: 7px;
          }

          .rt-subdivision-header td {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .rt-row:hover {
            background: none;
          }

          @page {
            size: landscape;
            margin: 5mm;
          }
        }
      `}</style>
    </div>
  )
}
