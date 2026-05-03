import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Empty } from 'antd'
import { PrinterOutlined, EditOutlined, TeamOutlined } from '@ant-design/icons'
import type { SubdivisionTreeNode } from '@shared/types/position'
import type { PersonnelListItem } from '@shared/types/personnel'
import { useSubdivisionTree } from '../hooks/usePositions'
import { usePersonnelList } from '../hooks/usePersonnel'
import { useAppStore } from '../stores/app.store'

function findByCode(nodes: SubdivisionTreeNode[], code: string): SubdivisionTreeNode | null {
  for (const n of nodes) {
    if (n.code === code) return n
    const found = findByCode(n.children, code)
    if (found) return found
  }
  return null
}

function callsignInitials(callsign: string | null): string {
  if (!callsign) return '—'
  return callsign.slice(0, 3).toUpperCase()
}

export default function OrgStructure(): JSX.Element {
  const navigate = useNavigate()
  const globalSubdivision = useAppStore((s) => s.globalSubdivision)
  const { data: treeData, loading: treeLoading } = useSubdivisionTree()
  const { data: personnel } = usePersonnelList({
    subdivision: globalSubdivision,
    status: 'active',
  })

  const root = useMemo(() => {
    const g3 = findByCode(treeData, 'Г-3')
    return g3 ?? treeData[0] ?? null
  }, [treeData])

  const children = root?.children ?? []
  const totalPersonnel = root?.personnelCount ?? personnel.length
  const totalPositions = root?.positionCount ?? 0
  const totalVacant = root?.vacantCount ?? 0
  const fillPercent =
    totalPositions > 0
      ? Math.round(((totalPositions - totalVacant) / totalPositions) * 100)
      : 0

  // personnel grouped by subdivision code
  const personnelBySub = useMemo(() => {
    const m = new Map<string, PersonnelListItem[]>()
    for (const p of personnel) {
      const k = p.currentSubdivision || ''
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(p)
    }
    return m
  }, [personnel])

  if (treeLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!root) {
    return (
      <>
        <div className="page-header">
          <div className="titles">
            <h1>Структура 12 ШР</h1>
          </div>
        </div>
        <div className="card" style={{ padding: 40 }}>
          <Empty description="Підрозділ Г-3 не знайдено" />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">
            організаційна структура · {children.length} підрозділ{children.length === 1 ? '' : 'ів'}
          </div>
          <h1>Структура 12 ШР</h1>
          <div className="sub">
            ОС: {totalPersonnel} · Посад: {totalPositions} · Заповнено {fillPercent}%
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => navigate('/staff-roster')}>
            <PrinterOutlined />
            Штатний розпис
          </button>
          <button className="btn primary" onClick={() => navigate('/staffing')}>
            <EditOutlined />
            Редагувати ШПО
          </button>
        </div>
      </div>

      {/* Діаграма-дерево */}
      <div className="card" style={{ padding: 30, overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="org-node root" style={{ minWidth: 320, padding: '12px 14px' }}>
            <TeamOutlined style={{ color: 'var(--accent)', fontSize: 16 }} />
            <div>
              <div className="ttl">{root.name}</div>
              <div className="dim" style={{ fontSize: 10.5, marginTop: 2 }}>
                {root.code} · {root.fullName || '—'}
              </div>
            </div>
            <span className="ct mono">{totalPersonnel}</span>
          </div>
        </div>

        {children.length > 0 && (
          <>
            <div
              style={{
                height: 24,
                position: 'relative',
                maxWidth: 800,
                margin: '0 auto',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  width: 1,
                  height: 12,
                  background: 'var(--line-2)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: `${100 / children.length / 2}%`,
                  right: `${100 / children.length / 2}%`,
                  height: 1,
                  background: 'var(--line-2)',
                }}
              />
              {children.map((_, i) => {
                const step = 100 / children.length
                const left = step / 2 + step * i
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: 12,
                      height: 12,
                      width: 1,
                      background: 'var(--line-2)',
                      left: `${left}%`,
                    }}
                  />
                )
              })}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${children.length}, 1fr)`,
                gap: 8,
                maxWidth: 800,
                margin: '0 auto',
              }}
            >
              {children.map((c) => {
                const ct = c.personnelCount || 0
                const positions = c.positionCount || 0
                const fill =
                  positions > 0 ? Math.min(100, Math.round((ct / positions) * 100)) : 0
                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      alignItems: 'center',
                    }}
                  >
                    <div className="org-node" style={{ width: '100%' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                        {c.code}
                      </span>
                      <div className="ttl" style={{ fontSize: 11.5 }}>
                        {c.name}
                      </div>
                      <span className="ct mono">{ct}</span>
                    </div>
                    <div className="bar-track" style={{ width: '70%' }}>
                      <i style={{ width: `${fill}%` }} />
                    </div>
                    <div className="mono dim" style={{ fontSize: 10 }}>
                      {ct} / {positions} штатних
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Прев'ю по перших 3 підрозділах */}
      {children.length > 0 && (
        <div
          className="hgrid"
          style={{
            gridTemplateColumns: `repeat(${Math.min(3, children.length)}, 1fr)`,
            gap: 12,
            marginTop: 12,
          }}
        >
          {children.slice(0, 3).map((c) => {
            const list = personnelBySub.get(c.code) ?? []
            return (
              <div key={c.id} className="card">
                <div className="card-head">
                  <h3>
                    {c.code} · {c.name}
                  </h3>
                  <span className="meta">{list.length} осіб</span>
                </div>
                <div style={{ padding: 0 }}>
                  {list.length === 0 && (
                    <div
                      style={{
                        padding: 16,
                        textAlign: 'center',
                        color: 'var(--fg-3)',
                        fontSize: 12,
                      }}
                    >
                      Списків немає
                    </div>
                  )}
                  {list.slice(0, 6).map((p, i) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/personnel/${p.id}`)}
                      style={{
                        padding: '8px 14px',
                        borderTop: i ? '1px solid var(--line-1)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <div className="avatar sm">{callsignInitials(p.callsign)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            style={{
                              color: 'var(--accent)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                            }}
                          >
                            {p.callsign || '—'}
                          </span>{' '}
                          · {p.fullName}
                        </div>
                        <div
                          className="dim"
                          style={{
                            fontSize: 10.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.positionTitle || p.currentPositionIdx || '—'}
                        </div>
                      </div>
                    </div>
                  ))}
                  {list.length > 6 && (
                    <div
                      style={{
                        padding: '8px 14px',
                        borderTop: '1px solid var(--line-1)',
                        fontSize: 11,
                        color: 'var(--fg-3)',
                        fontFamily: 'var(--font-mono)',
                        textAlign: 'center',
                      }}
                    >
                      + ще {list.length - 6}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
