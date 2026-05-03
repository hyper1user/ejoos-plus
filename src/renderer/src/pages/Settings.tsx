import { useState, useEffect } from 'react'
import { Card, Typography, Button, Input, Space, Alert, Divider, App, Progress, Tag } from 'antd'
import {
  SettingOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloudDownloadOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

type UpdaterStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'up-to-date'; currentVersion: string }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

export default function Settings(): JSX.Element {
  const { message } = App.useApp()
  const [docsRoot, setDocsRoot] = useState<string>('')
  const [saved, setSaved] = useState(false)
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus>({ state: 'idle' })

  useEffect(() => {
    window.api.docsGetRoot().then((val) => {
      if (val) setDocsRoot(val)
    })

    // Get current updater status
    window.api.updaterGetStatus().then((s) => setUpdaterStatus(s as UpdaterStatus))

    // Subscribe to live status updates
    const unsub = window.api.updaterOnStatus((s) => setUpdaterStatus(s as UpdaterStatus))
    return unsub
  }, [])

  const handleBrowse = async () => {
    const path = await window.api.docsBrowseRoot()
    if (path) {
      setDocsRoot(path)
      setSaved(false)
    }
  }

  const handleSave = async () => {
    if (!docsRoot.trim()) return
    await window.api.docsSetRoot(docsRoot.trim())
    setSaved(true)
    message.success('Шлях збережено')
  }

  const handleCheckUpdate = () => {
    window.api.updaterCheck()
  }

  const renderUpdaterStatus = () => {
    switch (updaterStatus.state) {
      case 'idle':
        return <Tag icon={<InfoCircleOutlined />} color="default">Не перевірялось</Tag>
      case 'checking':
        return <Tag icon={<SyncOutlined spin />} color="processing">Перевірка оновлень...</Tag>
      case 'up-to-date':
        return <Tag icon={<CheckCircleOutlined />} color="success">Остання версія ({updaterStatus.currentVersion})</Tag>
      case 'available':
        return <Tag icon={<CloudDownloadOutlined />} color="warning">Доступне оновлення {updaterStatus.version}</Tag>
      case 'downloading':
        return (
          <Space>
            <Tag icon={<SyncOutlined spin />} color="processing">Завантаження...</Tag>
            <Progress percent={updaterStatus.percent} size="small" style={{ width: 120 }} />
          </Space>
        )
      case 'downloaded':
        return (
          <Space>
            <Tag icon={<CheckCircleOutlined />} color="success">Готово до встановлення ({updaterStatus.version})</Tag>
            <Button size="small" type="primary" onClick={() => window.api.updaterInstall()}>
              Перезапустити і встановити
            </Button>
          </Space>
        )
      case 'error':
        return (
          <Alert
            type="error"
            showIcon
            icon={<WarningOutlined />}
            message="Помилка перевірки оновлень"
            description={<Text code style={{ fontSize: 11 }}>{updaterStatus.message}</Text>}
          />
        )
      default:
        return null
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">система · конфігурація</div>
          <h1>Налаштування</h1>
          <div className="sub">Оновлення, інтеграції, папка документів, тема</div>
        </div>
      </div>
    <Space direction="vertical" size={24} style={{ width: '100%' }}>

      {/* Updater */}
      <Card
        title={
          <Space>
            <CloudDownloadOutlined />
            <span>Оновлення додатку</span>
          </Space>
        }
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Button
              icon={<SyncOutlined spin={updaterStatus.state === 'checking'} />}
              onClick={handleCheckUpdate}
              disabled={updaterStatus.state === 'checking' || updaterStatus.state === 'downloading'}
            >
              Перевірити оновлення
            </Button>
            {renderUpdaterStatus()}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Оновлення перевіряються автоматично при запуску додатку (через 5 секунд).
          </Text>
        </Space>
      </Card>

      {/* Docs folder */}
      <Card
        title={
          <Space>
            <FolderOpenOutlined />
            <span>Папка документів особового складу</span>
          </Space>
        }
      >
        <Paragraph type="secondary">
          Вкажіть корінну папку, де зберігаються документи військовослужбовців.
          Очікувана структура:
        </Paragraph>
        <pre style={{ fontSize: 12, background: '#f5f5f5', color: '#333', padding: 12, borderRadius: 6 }}>
{`Корінна папка/
  1 штурмовий взвод/
    ПРІЗВИЩЕ Ім'я По батькові/
      файл - паспорт.pdf
      файл - УБД.pdf
      фото.jpg
  2 штурмовий взвод/
    ...`}
        </pre>

        <Divider />

        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={docsRoot}
            onChange={(e) => { setDocsRoot(e.target.value); setSaved(false) }}
            placeholder="J:\Мой диск\12ШР — документи особового складу"
            style={{ flex: 1 }}
          />
          <Button icon={<FolderOpenOutlined />} onClick={handleBrowse}>
            Вибрати
          </Button>
          <Button
            type="primary"
            icon={saved ? <CheckCircleOutlined /> : <SettingOutlined />}
            onClick={handleSave}
            disabled={!docsRoot.trim()}
          >
            {saved ? 'Збережено' : 'Зберегти'}
          </Button>
        </Space.Compact>

        {docsRoot && (
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            showIcon
            message={<Text>Поточний шлях: <Text code>{docsRoot}</Text></Text>}
          />
        )}
      </Card>

      {/* About */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>Про додаток</span>
          </Space>
        }
      >
        <Paragraph>
          <b>АльваресAI</b> – система обліку особового складу 12 штурмової роти 4 штурмового батальйону 92 окремої штурмової бригади.
        </Paragraph>
      </Card>
    </Space>
    </>
  )
}
