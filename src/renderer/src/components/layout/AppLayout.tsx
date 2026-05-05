import { useState, useEffect, useContext, useMemo } from 'react'
import { Layout, Menu, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  SwapOutlined,
  TagsOutlined,
  CalendarOutlined,
  FileTextOutlined,
  BarChartOutlined,
  ImportOutlined,
  SettingOutlined,
  SolutionOutlined,
  UnorderedListOutlined,
  UserDeleteOutlined,
  BranchesOutlined,
  TableOutlined,
  FormOutlined,
  FolderOutlined,
  MedicineBoxOutlined,
  WarningOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SunOutlined,
  MoonOutlined,
  HomeOutlined,
  PrinterOutlined,
  DollarOutlined,
  RightOutlined,
  SearchOutlined,
  BellOutlined,
} from '@ant-design/icons'
import { ThemeContext } from '../../main'
import dayjs from 'dayjs'
import QuickSearch from './QuickSearch'
import AppRoutes from '../../routes'
import BrandMark from './BrandMark'

const { Header, Sider, Content } = Layout

const SIDEBAR_W = 224
const SIDEBAR_COLLAPSED_W = 56
const HEADER_H = 48

const PAGE_TITLES: Record<string, string> = {
  '/': 'Дашборд',
  '/personnel': 'Особовий склад · Реєстр',
  '/personnel/excluded': 'Особовий склад · Виключені',
  '/statuses': 'Статуси',
  '/org-structure': 'Організаційна структура',
  '/staffing': 'ШПО',
  '/positions': 'Перелік посад',
  '/staff-roster': 'Штатний розпис',
  '/movements': 'Переміщення',
  '/attendance': 'Місячний табель',
  '/formation-report': 'Стройова записка',
  '/dgv': 'Грошове забезпечення',
  '/missing-docs': 'Відсутні документи',
  '/leave': 'Відпустки',
  '/injuries': 'Поранення / Втрати',
  '/documents/generate': 'Генератор документів',
  '/documents/archive': 'Архів документів',
  '/statistics': 'Статистика',
  '/import-export': 'Імпорт / Експорт',
  '/settings': 'Налаштування',
}

function getCurrentTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/personnel/')) return 'Картка бійця'
  return 'Альварес AI'
}

function NavBadge({ value }: { value: number | string }): JSX.Element {
  return (
    <span
      className="mono"
      style={{
        fontSize: 10,
        color: 'var(--fg-3)',
        background: 'var(--bg-3)',
        padding: '1px 6px',
        borderRadius: 8,
        marginLeft: 8,
        lineHeight: 1.4,
      }}
    >
      {value}
    </span>
  )
}

export default function AppLayout(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [dbStatus, setDbStatus] = useState<string>('')
  const [appVersion, setAppVersion] = useState<string>('')
  const [personnelCount, setPersonnelCount] = useState<number>(0)
  const [quickSearchOpen, setQuickSearchOpen] = useState(false)
  const { mode, toggle: toggleTheme } = useContext(ThemeContext)
  const isDark = mode === 'dark'

  // ⌘K / Ctrl+K — глобальний шорткат для quick search.
  // Використовуємо `e.code === 'KeyK'` (фізична клавіша) замість `e.key`,
  // бо `e.key` повертає друкований символ з урахуванням розкладки —
  // на українській розкладці клавіша K дає 'л', тож перевірка по key
  // не спрацьовує. `code` працює незалежно від розкладки і регістру.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.isComposing) return
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
        e.preventDefault()
        setQuickSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    window.api.dbHealth().then((r: { ok: boolean; message: string }) => {
      setDbStatus(r.ok ? 'OK' : 'Error')
    })
    window.api.appVersion().then(setAppVersion)
    window.api
      .personnelList({})
      .then((rows: unknown[]) => setPersonnelCount(Array.isArray(rows) ? rows.length : 0))
      .catch(() => setPersonnelCount(0))
  }, [])

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      {
        type: 'group',
        label: 'Огляд',
        children: [{ key: '/', icon: <DashboardOutlined />, label: 'Дашборд' }],
      },
      {
        type: 'group',
        label: 'Особовий склад',
        children: [
          {
            key: '/personnel',
            icon: <UnorderedListOutlined />,
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', width: '100%' }}>
                <span style={{ flex: 1 }}>Реєстр</span>
                {personnelCount > 0 && !collapsed && <NavBadge value={personnelCount} />}
              </span>
            ),
          },
          { key: '/personnel/excluded', icon: <UserDeleteOutlined />, label: 'Виключені' },
          { key: '/statuses', icon: <TagsOutlined />, label: 'Статуси' },
        ],
      },
      {
        type: 'group',
        label: 'Структура',
        children: [
          { key: '/org-structure', icon: <BranchesOutlined />, label: 'Орг. структура' },
          { key: '/staffing', icon: <TableOutlined />, label: 'ШПО' },
          { key: '/positions', icon: <SolutionOutlined />, label: 'Посади' },
          { key: '/staff-roster', icon: <PrinterOutlined />, label: 'Штатний розпис' },
          { key: '/movements', icon: <SwapOutlined />, label: 'Переміщення' },
        ],
      },
      {
        type: 'group',
        label: 'Облік',
        children: [
          { key: '/attendance', icon: <CalendarOutlined />, label: 'Табель' },
          { key: '/formation-report', icon: <FormOutlined />, label: 'Стройова записка' },
          { key: '/dgv', icon: <DollarOutlined />, label: 'Грошове' },
        ],
      },
      {
        type: 'group',
        label: 'Документи',
        children: [
          { key: '/missing-docs', icon: <WarningOutlined />, label: 'Відсутні' },
          { key: '/leave', icon: <FileTextOutlined />, label: 'Відпустки' },
          { key: '/injuries', icon: <MedicineBoxOutlined />, label: 'Поранення' },
          { key: '/documents/generate', icon: <FormOutlined />, label: 'Генератор' },
          { key: '/documents/archive', icon: <FolderOutlined />, label: 'Архів' },
        ],
      },
      {
        type: 'group',
        label: 'Аналітика',
        children: [
          { key: '/statistics', icon: <BarChartOutlined />, label: 'Статистика' },
          { key: '/import-export', icon: <ImportOutlined />, label: 'Імпорт / Експорт' },
        ],
      },
      {
        type: 'group',
        label: 'Система',
        children: [{ key: '/settings', icon: <SettingOutlined />, label: 'Налаштування' }],
      },
    ],
    [personnelCount, collapsed]
  )

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key.startsWith('/')) navigate(key)
  }

  const currentTitle = getCurrentTitle(location.pathname)
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W

  return (
    <>
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsed={collapsed}
        collapsedWidth={SIDEBAR_COLLAPSED_W}
        width={SIDEBAR_W}
        trigger={null}
        style={{
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          borderRight: '1px solid var(--line-1)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 5,
        }}
      >
        {/* Brand */}
        <div
          style={{
            height: HEADER_H,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? 0 : '0 14px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderBottom: '1px solid var(--line-1)',
            flexShrink: 0,
          }}
        >
          <BrandMark />
          {!collapsed && (
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'baseline',
                gap: 5,
              }}
            >
              ALVARES
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--accent)',
                  letterSpacing: '0.1em',
                }}
              >
                AI
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 0 8px' }}>
          <Menu
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={onMenuClick}
            style={{ borderRight: 0, background: 'transparent' }}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: collapsed ? '10px 0' : '10px 14px',
            borderTop: '1px solid var(--line-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            fontSize: 11,
            color: 'var(--fg-3)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: dbStatus === 'OK' ? 'var(--ok)' : 'var(--crit)',
              flexShrink: 0,
            }}
          />
          {!collapsed && (
            <div style={{ minWidth: 0, lineHeight: 1.3 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-1)', fontWeight: 500 }}>
                {dbStatus === 'OK' ? 'БД синхронізована' : 'БД недоступна'}
              </div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                v{appVersion} · локально
              </div>
            </div>
          )}
        </div>
      </Sider>

      <Layout
        style={{
          marginLeft: sidebarWidth,
          transition: 'margin-left 0.16s ease',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <Header
          style={{
            padding: 0,
            height: HEADER_H,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingLeft: 12,
            paddingRight: 12,
            borderBottom: '1px solid var(--line-1)',
            flexShrink: 0,
          }}
        >
          {/* Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--fg-2)',
              display: 'grid',
              placeItems: 'center',
            }}
            title={collapsed ? 'Розгорнути' : 'Згорнути'}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>

          {/* Breadcrumbs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              color: 'var(--fg-2)',
            }}
          >
            <HomeOutlined style={{ fontSize: 14, color: 'var(--fg-3)' }} />
            <RightOutlined style={{ fontSize: 10, color: 'var(--fg-4)' }} />
            <span>4 ШБ / 92 ОШБр</span>
            <RightOutlined style={{ fontSize: 10, color: 'var(--fg-4)' }} />
            <span style={{ color: 'var(--fg-0)', fontWeight: 500 }}>{currentTitle}</span>
          </div>

          <div className="unit-pill">
            <span className="dot" />
            Г-3 · 12 ШР
          </div>

          <div style={{ flex: 1 }} />

          {/* Search trigger — клік чи Ctrl+K відкривають QuickSearch overlay */}
          <button
            onClick={() => setQuickSearchOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg-2)',
              border: '1px solid var(--line-1)',
              borderRadius: 5,
              padding: '0 10px',
              width: 280,
              height: 28,
              color: 'var(--fg-2)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              textAlign: 'left',
            }}
            title="Швидкий пошук (Ctrl+K)"
          >
            <SearchOutlined style={{ fontSize: 13 }} />
            <span style={{ flex: 1, color: 'var(--fg-3)' }}>
              Пошук позивного, ПІБ, ІПН…
            </span>
            <span className="kbd">⌘K</span>
          </button>

          {/* Actions */}
          <Tooltip title="Сповіщення">
            <button
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--fg-2)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <BellOutlined />
            </button>
          </Tooltip>

          <Tooltip title={isDark ? 'Світла тема' : 'Темна тема'}>
            <button
              onClick={toggleTheme}
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--fg-2)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {isDark ? <SunOutlined /> : <MoonOutlined />}
            </button>
          </Tooltip>

          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-3)',
              padding: '0 6px',
              borderLeft: '1px solid var(--line-1)',
              marginLeft: 4,
              whiteSpace: 'nowrap',
            }}
          >
            {dayjs().format('dd · DD.MM.YYYY')}
          </div>
        </Header>

        <Content
          style={{
            overflow: 'auto',
            flex: 1,
            background: 'var(--bg-0)',
            padding: '16px 20px 40px',
          }}
        >
          <AppRoutes />
        </Content>
      </Layout>
    </Layout>
    <QuickSearch open={quickSearchOpen} onClose={() => setQuickSearchOpen(false)} />
    </>
  )
}
