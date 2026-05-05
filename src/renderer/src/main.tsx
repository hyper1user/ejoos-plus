// Antd v5 + React 19 compat shim — мостить старий unmount API.
// Має бути ПЕРШИМ імпортом, до самого `antd`.
import '@ant-design/v5-patch-for-react-19'
import { createContext } from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntApp, theme as antTheme } from 'antd'
import ukUA from 'antd/locale/uk_UA'
import dayjs from 'dayjs'
import 'dayjs/locale/uk'
import App from './App'
import { useThemeMode, type ThemeMode } from './hooks/useTheme'
import './assets/main.css'

dayjs.locale('uk')

export const ThemeContext = createContext<{ mode: ThemeMode; toggle: () => void }>({
  mode: 'dark',
  toggle: () => {}
})

const FONT_SANS =
  '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

const ACCENT_DARK = 'oklch(0.80 0.13 86)'
const ACCENT_LIGHT = 'oklch(0.62 0.14 60)'

const TOKENS_DARK = {
  colorPrimary: ACCENT_DARK,
  colorInfo: 'oklch(0.72 0.10 230)',
  colorSuccess: 'oklch(0.74 0.13 158)',
  colorWarning: 'oklch(0.78 0.13 70)',
  colorError: 'oklch(0.65 0.18 25)',

  colorBgLayout: 'oklch(0.14 0.006 70)',
  colorBgContainer: 'oklch(0.17 0.006 70)',
  colorBgElevated: 'oklch(0.20 0.007 70)',
  colorBorder: 'oklch(0.27 0.006 70)',
  colorBorderSecondary: 'oklch(0.27 0.006 70)',

  colorText: 'oklch(0.97 0.005 80)',
  colorTextSecondary: 'oklch(0.84 0.006 80)',
  colorTextTertiary: 'oklch(0.66 0.007 80)',
  colorTextQuaternary: 'oklch(0.50 0.008 70)',
}

const TOKENS_LIGHT = {
  colorPrimary: ACCENT_LIGHT,
  colorInfo: 'oklch(0.62 0.10 230)',
  colorSuccess: 'oklch(0.62 0.13 158)',
  colorWarning: 'oklch(0.68 0.13 70)',
  colorError: 'oklch(0.55 0.18 25)',

  colorBgLayout: 'oklch(0.97 0.004 80)',
  colorBgContainer: 'oklch(1 0 0)',
  colorBgElevated: 'oklch(0.985 0.003 80)',
  colorBorder: 'oklch(0.85 0.006 80)',
  colorBorderSecondary: 'oklch(0.90 0.005 80)',

  colorText: 'oklch(0.18 0.008 80)',
  colorTextSecondary: 'oklch(0.32 0.008 80)',
  colorTextTertiary: 'oklch(0.46 0.008 80)',
  colorTextQuaternary: 'oklch(0.58 0.008 80)',
}

function Root(): JSX.Element {
  const [mode, toggle] = useThemeMode()
  const isDark = mode === 'dark'

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      <ConfigProvider
        locale={ukUA}
        theme={{
          cssVar: true,
          hashed: false,
          algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: {
            ...(isDark ? TOKENS_DARK : TOKENS_LIGHT),
            borderRadius: 6,
            borderRadiusLG: 10,
            borderRadiusSM: 4,
            fontFamily: FONT_SANS,
            fontSize: 13,
            controlHeight: 30,
            controlHeightSM: 24,
            wireframe: false,
          },
          components: {
            Layout: {
              headerHeight: 48,
              headerPadding: '0 16px',
              siderBg: isDark ? 'oklch(0.17 0.006 70)' : 'oklch(0.985 0.003 80)',
              headerBg: isDark ? 'oklch(0.17 0.006 70)' : 'oklch(0.985 0.003 80)',
              bodyBg: isDark ? 'oklch(0.14 0.006 70)' : 'oklch(0.97 0.004 80)',
              triggerBg: 'transparent',
            },
            Menu: {
              itemHeight: 32,
              itemMarginInline: 6,
              itemPaddingInline: 10,
              itemBorderRadius: 4,
              subMenuItemBg: 'transparent',
              itemBg: 'transparent',
              itemSelectedBg: isDark ? 'oklch(0.235 0.008 70)' : 'oklch(0.97 0.005 80)',
              itemHoverBg: isDark ? 'oklch(0.20 0.007 70)' : 'oklch(0.97 0.005 80)',
              itemSelectedColor: isDark ? 'oklch(0.97 0.005 80)' : 'oklch(0.18 0.008 80)',
              fontSize: 13,
              iconSize: 15,
            },
            Button: {
              controlHeight: 28,
              borderRadius: 5,
              fontWeight: 500,
            },
            Card: {
              borderRadiusLG: 10,
              paddingLG: 14,
            },
            Tag: {
              borderRadiusSM: 4,
            },
            Tabs: {
              titleFontSize: 12.5,
              itemColor: 'var(--fg-2)',
              itemSelectedColor: 'var(--fg-0)',
              inkBarColor: 'var(--accent)',
            },
            Table: {
              cellFontSize: 12.5,
              headerSplitColor: 'transparent',
              headerColor: 'var(--fg-3)',
              headerBg: isDark ? 'oklch(0.17 0.006 70)' : 'oklch(0.985 0.003 80)',
              rowHoverBg: isDark ? 'oklch(0.20 0.007 70)' : 'oklch(0.97 0.005 80)',
            },
            Input: {
              controlHeight: 30,
              borderRadius: 5,
            },
            Select: {
              controlHeight: 30,
              borderRadius: 5,
            },
            Segmented: {
              itemSelectedBg: isDark ? 'oklch(0.235 0.008 70)' : 'oklch(1 0 0)',
              itemSelectedColor: 'var(--fg-0)',
            },
          },
        }}
      >
        <AntApp>
          <App />
        </AntApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />)
