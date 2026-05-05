import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, Input } from 'antd'
import { SearchOutlined, EnterOutlined } from '@ant-design/icons'
import type { PersonnelListItem } from '@shared/types/personnel'

interface QuickSearchProps {
  open: boolean
  onClose: () => void
}

const SEARCH_DEBOUNCE_MS = 200
const MAX_RESULTS = 12

export default function QuickSearch({ open, onClose }: QuickSearchProps): JSX.Element {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PersonnelListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<{ focus: () => void } | null>(null)

  // Reset state коли overlay відкривається
  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setActiveIdx(0)
    // Auto-focus input через мікросек, бо Antd Modal маунтить пізніше
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  // Debounced search — не дзвонимо IPC на кожну букву
  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await window.api.personnelSearch(trimmed)
        const list = Array.isArray(data) ? (data as PersonnelListItem[]) : []
        setResults(list.slice(0, MAX_RESULTS))
        setActiveIdx(0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, open])

  const choose = (person: PersonnelListItem): void => {
    onClose()
    navigate(`/personnel/${person.id}`)
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = results[activeIdx]
      if (target) choose(target)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={620}
      destroyOnClose
      styles={{
        content: { padding: 0, overflow: 'hidden', borderRadius: 10 },
        body: { padding: 0 },
      }}
      style={{ top: 84 }}
      maskClosable
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          borderBottom: '1px solid var(--line-1)',
        }}
      >
        <SearchOutlined style={{ fontSize: 16, color: 'var(--fg-3)' }} />
        <Input
          ref={(el) => {
            inputRef.current = el as unknown as { focus: () => void } | null
          }}
          variant="borderless"
          placeholder="Пошук за позивним, ПІБ, ІПН…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
          autoFocus
          style={{
            padding: 0,
            fontSize: 14,
            color: 'var(--fg-0)',
            flex: 1,
          }}
        />
        <span className="kbd" style={{ fontSize: 10 }}>
          Esc
        </span>
      </div>

      <div
        style={{
          maxHeight: 'min(60vh, 480px)',
          overflowY: 'auto',
        }}
      >
        {!query.trim() && (
          <div
            style={{
              padding: '32px 20px',
              textAlign: 'center',
              fontSize: 12.5,
              color: 'var(--fg-3)',
              lineHeight: 1.6,
            }}
          >
            Почніть друкувати —<br />
            пошук серед усього особового складу за позивним, ПІБ або ІПН.
            <div
              style={{
                marginTop: 12,
                display: 'inline-flex',
                gap: 8,
                alignItems: 'center',
                fontSize: 11,
                color: 'var(--fg-4)',
              }}
            >
              <span className="kbd">↑</span>
              <span className="kbd">↓</span>
              <span>навігація</span>
              <span className="kbd">
                <EnterOutlined style={{ fontSize: 10 }} />
              </span>
              <span>обрати</span>
            </div>
          </div>
        )}

        {query.trim() && !loading && results.length === 0 && (
          <div
            style={{
              padding: '24px 20px',
              textAlign: 'center',
              fontSize: 12.5,
              color: 'var(--fg-3)',
            }}
          >
            Нічого не знайдено за запитом «{query.trim()}»
          </div>
        )}

        {results.map((p, i) => {
          const isActive = i === activeIdx
          const inDisposition = p.currentSubdivision === 'розпорядження'
          return (
            <div
              key={p.id}
              onClick={() => choose(p)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                cursor: 'pointer',
                background: isActive ? 'var(--bg-2)' : 'transparent',
                borderLeft: isActive
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  background: 'var(--bg-3)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--fg-1)',
                  flexShrink: 0,
                }}
              >
                {(p.callsign || '—').slice(0, 3).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--fg-0)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.callsign && (
                    <span
                      style={{
                        color: 'var(--accent)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        marginRight: 6,
                      }}
                    >
                      {p.callsign}
                    </span>
                  )}
                  {p.fullName}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--fg-3)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.rankName ? `${p.rankName} · ` : ''}
                  {p.positionTitle || p.currentPositionIdx || '—'}
                  {inDisposition && (
                    <span
                      style={{
                        marginLeft: 8,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: 'color-mix(in oklab, var(--warn) 18%, transparent)',
                        color: 'var(--warn)',
                        fontSize: 9.5,
                        fontWeight: 600,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                      }}
                    >
                      у розпорядженні
                    </span>
                  )}
                </div>
              </div>
              {p.currentStatusCode && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--fg-3)',
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: 'var(--bg-2)',
                  }}
                >
                  {p.currentStatusCode}
                </span>
              )}
            </div>
          )
        })}

        {loading && (
          <div
            style={{
              padding: '12px 20px',
              fontSize: 11,
              color: 'var(--fg-4)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            пошук…
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--line-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10.5,
            color: 'var(--fg-4)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span>
            {results.length} {results.length === MAX_RESULTS ? `+ (показано перші ${MAX_RESULTS})` : ''}
          </span>
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> навігація · <span className="kbd">↵</span> обрати ·{' '}
            <span className="kbd">Esc</span> закрити
          </span>
        </div>
      )}
    </Modal>
  )
}
