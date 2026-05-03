import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Spin,
  Typography,
  Result,
  Divider,
  Table,
  Tag,
  Badge,
  theme,
  List,
  Avatar,
  Tooltip,
  Empty,
  Tabs,
  Popconfirm,
  App
} from 'antd'
import {
  EditOutlined,
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileImageOutlined,
  FileOutlined,
  FolderOpenOutlined,
  CameraOutlined,
  PrinterOutlined,
  FormOutlined
} from '@ant-design/icons'
import { usePersonnelCard } from '../hooks/usePersonnel'
import { usePersonMovements } from '../hooks/useMovements'
import { usePersonStatusHistory } from '../hooks/useStatusHistory'
import { useLookups } from '../hooks/useLookups'
import RankBadge from '../components/personnel/RankBadge'
import StatusBadge from '../components/personnel/StatusBadge'
import PersonnelForm from '../components/personnel/PersonnelForm'
import MovementForm from '../components/movements/MovementForm'
import MovementTimeline from '../components/movements/MovementTimeline'
import StatusHistoryForm from '../components/statuses/StatusHistoryForm'
import StatusTimeline from '../components/statuses/StatusTimeline'
import dayjs from 'dayjs'

const { Text } = Typography

const COMBAT_CODES = new Set(['РВ', 'РЗ', 'РШ'])

function pillClassForStatus(code: string | null | undefined, group: string | null | undefined): string {
  if (!code || !group) return 'pill muted'
  if (group === 'Лікування') return 'pill medical'
  if (group === 'Відпустка' || group === 'Відрядження') return 'pill leave'
  if (
    group === 'Загиблі' ||
    group === 'Зниклі безвісти' ||
    group === 'Полон' ||
    group === 'СЗЧ' ||
    group === 'Ні'
  )
    return 'pill absent'
  if (group === 'Так') return COMBAT_CODES.has(code) ? 'pill combat' : 'pill duty'
  return 'pill muted'
}

interface DocFile {
  name: string
  path: string
  ext: string
  category: string
  isPhoto: boolean
}

function fileIcon(ext: string): JSX.Element {
  if (ext === '.pdf') return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
  if (ext === '.docx' || ext === '.doc') return <FileWordOutlined style={{ color: '#1890ff', fontSize: 20 }} />
  if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) return <FileImageOutlined style={{ color: '#52c41a', fontSize: 20 }} />
  return <FileOutlined style={{ fontSize: 20 }} />
}

const CATEGORY_COLORS: Record<string, string> = {
  'Паспорт': 'blue',
  'Військовий квиток': 'green',
  'УБД': 'purple',
  'ІПН': 'cyan',
  'Автобіографія': 'orange',
  'Контракт': 'gold',
  'ID-картка': 'blue',
  'Наказ': 'red',
  'Фото': 'magenta',
  'Інше': 'default'
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return dayjs(d).format('DD.MM.YYYY')
}

function SectionTitle({ children }: { children: React.ReactNode }): JSX.Element {
  const { token } = theme.useToken()
  return (
    <div
      style={{
        background: token.colorFillTertiary,
        padding: '5px 10px',
        marginBottom: 10,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: token.colorText,
        borderLeft: `3px solid ${token.colorPrimary}`
      }}
    >
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }): JSX.Element {
  const { token } = theme.useToken()
  return (
    <tr>
      <td
        style={{
          color: token.colorTextSecondary,
          padding: '3px 10px 3px 0',
          fontSize: 13,
          whiteSpace: 'nowrap',
          verticalAlign: 'top',
          width: 95
        }}
      >
        {label}
      </td>
      <td style={{ padding: '3px 0', fontSize: 13, fontWeight: 500, verticalAlign: 'top' }}>
        {value ?? '—'}
      </td>
    </tr>
  )
}

export default function PersonnelCard(): JSX.Element {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: person, loading, refetch } = usePersonnelCard(id ? Number(id) : null)
  const { bloodTypes, contractTypes, statusTypes } = useLookups()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [movementDrawerOpen, setMovementDrawerOpen] = useState(false)
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false)
  const {
    data: personMovements,
    loading: movementsLoading,
    refetch: refetchMovements
  } = usePersonMovements(id ? Number(id) : null)
  const {
    data: personStatuses,
    loading: statusesLoading,
    refetch: refetchStatuses
  } = usePersonStatusHistory(id ? Number(id) : null)

  const [docFiles, setDocFiles] = useState<DocFile[]>([])
  const [scanPhotoPath, setScanPhotoPath] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [docsLoading, setDocsLoading] = useState(false)
  const [photoHover, setPhotoHover] = useState(false)
  const [photoError, setPhotoError] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    if (!person) return
    setDocsLoading(true)
    setPhotoError(false)
    window.api.docsScanPerson(person.fullName).then((result) => {
      setDocFiles(result.files)
      setScanPhotoPath(result.photoPath)
      setFolderPath(result.folderPath)
    }).catch(() => {}).finally(() => setDocsLoading(false))
  }, [person?.fullName])

  useEffect(() => { setPhotoError(false) }, [person?.id])

  const effectivePhotoPath = person?.photoPath || scanPhotoPath


  const handlePhotoClick = async () => {
    if (!person || uploadingPhoto) return
    setUploadingPhoto(true)
    try {
      const selected = await window.api.openFileDialog([
        { name: 'Зображення', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
      ])
      if (!selected) return
      const result = await window.api.personnelUpdate(person.id, { photoPath: selected })
      if (result && !('error' in result)) {
        setPhotoError(false)
        refetch()
      }
    } finally {
      setUploadingPhoto(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!person) {
    return (
      <Result
        status="404"
        title="Особу не знайдено"
        subTitle={`Запис з ID ${id} не існує`}
        extra={<Button onClick={() => navigate('/personnel')}>Повернутися до реєстру</Button>}
      />
    )
  }

  const bloodTypeName = person.bloodTypeId
    ? bloodTypes.find((b) => b.id === person.bloodTypeId)?.name
    : null
  const contractName = person.contractTypeId
    ? contractTypes.find((c) => c.id === person.contractTypeId)?.name
    : null
  const statusColor = person.currentStatusCode
    ? statusTypes.find((s) => s.code === person.currentStatusCode)?.colorCode
    : null

  const tabItems = [
    {
      key: 'movements',
      label: (
        <Badge count={personMovements.length} size="small" offset={[8, 0]} color="blue">
          Переміщення
        </Badge>
      ),
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>Історія переміщень ({personMovements.length})</Text>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setMovementDrawerOpen(true)}>
              Додати
            </Button>
          </div>
          <Table
            dataSource={personMovements}
            rowKey="id"
            size="small"
            loading={movementsLoading}
            pagination={false}
            scroll={{ x: 900 }}
            columns={[
              { title: 'Тип', dataIndex: 'orderType', width: 130, render: (t: string) => <Tag color="blue">{t}</Tag> },
              {
                title: 'Посада (на)', dataIndex: 'positionTitle', width: 200, ellipsis: true,
                render: (_: unknown, r: typeof personMovements[0]) => r.positionTitle || r.positionIndex || '—'
              },
              {
                title: 'Посада (з)', dataIndex: 'previousPositionTitle', width: 200, ellipsis: true,
                render: (_: unknown, r: typeof personMovements[0]) => r.previousPositionTitle || r.previousPosition || '—'
              },
              { title: 'Дата з', dataIndex: 'dateFrom', width: 110, render: (t: string) => t ? dayjs(t).format('DD.MM.YYYY') : '—' },
              {
                title: 'Наказ', dataIndex: 'orderNumber', width: 180, ellipsis: true,
                render: (_: unknown, r: typeof personMovements[0]) => {
                  const parts = [
                    r.orderIssuer,
                    r.orderNumber ? `№${r.orderNumber}` : null,
                    r.orderDate ? `від ${dayjs(r.orderDate).format('DD.MM.YYYY')}` : null
                  ].filter(Boolean)
                  return parts.length > 0 ? parts.join(' ') : '—'
                }
              },
              { title: 'Активне', dataIndex: 'isActive', width: 80, render: (v: boolean) => v ? <Tag color="green">Так</Tag> : <Tag color="default">Ні</Tag> }
            ]}
          />
          <Divider>Часова шкала</Divider>
          <MovementTimeline movements={personMovements} />
        </Space>
      )
    },
    {
      key: 'statuses',
      label: (
        <Badge count={personStatuses.length} size="small" offset={[8, 0]} color="orange">
          Статуси
        </Badge>
      ),
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>Історія статусів ({personStatuses.length})</Text>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setStatusDrawerOpen(true)}>
              Додати
            </Button>
          </div>
          <Table
            dataSource={personStatuses}
            rowKey="id"
            size="small"
            loading={statusesLoading}
            pagination={false}
            scroll={{ x: 800 }}
            columns={[
              {
                title: 'Статус', dataIndex: 'statusName', width: 220,
                render: (_: unknown, r: typeof personStatuses[0]) => (
                  <Tag color={r.statusColor || 'default'}>{r.statusCode} — {r.statusName}</Tag>
                )
              },
              { title: 'Група', dataIndex: 'groupName', width: 140 },
              { title: 'Дата з', dataIndex: 'dateFrom', width: 110, render: (t: string) => t ? dayjs(t).format('DD.MM.YYYY') : '—' },
              { title: 'Дата по', dataIndex: 'dateTo', width: 110, render: (t: string) => t ? dayjs(t).format('DD.MM.YYYY') : '—' },
              { title: 'Присутність', dataIndex: 'presenceGroup', width: 100, render: (t: string) => t || '—' },
              { title: 'Поточний', dataIndex: 'isLast', width: 80, render: (v: boolean) => v ? <Tag color="green">Так</Tag> : <Tag color="default">Ні</Tag> },
              { title: 'Коментар', dataIndex: 'comment', width: 200, ellipsis: true, render: (t: string) => t || '—' },
              {
                title: '', width: 50, align: 'center' as const,
                render: (_: unknown, r: typeof personStatuses[0]) => (
                  <Popconfirm title="Видалити статус?" onConfirm={async () => {
                    const res = await window.api.statusHistoryDelete(r.id)
                    if (res?.success) { message.success('Статус видалено'); refetchStatuses(); refetch() }
                    else message.error('Помилка видалення')
                  }} okText="Так" cancelText="Ні">
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )
              }
            ]}
          />
          <Divider>Часова шкала</Divider>
          <StatusTimeline statuses={personStatuses} />
        </Space>
      )
    },
    {
      key: 'documents',
      label: (
        <Badge count={docFiles.filter(f => !f.isPhoto).length} size="small" offset={[8, 0]} color="geekblue">
          Документи
        </Badge>
      ),
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {docsLoading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}
          {!docsLoading && !folderPath && (
            <Result
              icon={<FolderOpenOutlined style={{ fontSize: 48, color: token.colorTextQuaternary }} />}
              title="Папку документів не знайдено"
              subTitle={<span>Вкажіть корінну папку у <b>Налаштуваннях</b>. Папка особи: <b>{person.fullName}</b></span>}
            />
          )}
          {!docsLoading && folderPath && docFiles.filter(f => !f.isPhoto).length === 0 && (
            <Empty description="Документів не знайдено" />
          )}
          {!docsLoading && folderPath && docFiles.filter(f => !f.isPhoto).length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{folderPath}</Text>
                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => window.api.docsOpenFile(folderPath!)}>
                  Відкрити папку
                </Button>
              </div>
              <List
                dataSource={docFiles.filter(f => !f.isPhoto)}
                size="small"
                renderItem={(file) => (
                  <List.Item
                    style={{ cursor: 'pointer', padding: '8px 4px' }}
                    onClick={() => window.api.docsOpenFile(file.path)}
                    actions={[<Tag color={CATEGORY_COLORS[file.category] ?? 'default'} key="cat">{file.category}</Tag>]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={fileIcon(file.ext)} shape="square" style={{ background: 'transparent' }} />}
                      title={<Tooltip title="Клік для відкриття"><Text style={{ cursor: 'pointer' }}>{file.name}</Text></Tooltip>}
                    />
                  </List.Item>
                )}
              />
            </>
          )}
        </Space>
      )
    },
    {
      key: 'details',
      label: 'Деталі',
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <SectionTitle>Документи</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <InfoRow label="Паспорт" value={[person.passportSeries || person.idDocSeries, person.passportNumber || person.idDocNumber].filter(Boolean).join(' ') || '—'} />
              <InfoRow label="Виданий" value={person.passportIssuedBy ? `${person.passportIssuedBy} ${formatDate(person.passportIssuedDate)}` : '—'} />
              <InfoRow label="Військовий квиток" value={[person.militaryIdSeries, person.militaryIdNumber].filter(Boolean).join(' ') || '—'} />
              {(person.ubdSeries || person.ubdNumber) && (
                <InfoRow label="УБД" value={[person.ubdSeries, person.ubdNumber].filter(Boolean).join(' ')} />
              )}
            </tbody>
          </table>

          <SectionTitle>Освіта та персональне</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <InfoRow label="Освіта" value={person.educationLevelName || '—'} />
              <InfoRow label="Заклад" value={person.educationInstitution || '—'} />
              <InfoRow label="Рік закінчення" value={person.educationYear || '—'} />
              <InfoRow label="Військова освіта" value={person.militaryEducation || '—'} />
              <InfoRow label="Місце народження" value={person.birthplace || '—'} />
              <InfoRow label="Адреса проживання" value={person.addressActual || '—'} />
              <InfoRow label="Громадянство" value={person.citizenship || '—'} />
              <InfoRow label="Національність" value={person.nationality || '—'} />
            </tbody>
          </table>

          {(person.iban || person.bankCard || person.bankName) && (
            <>
              <SectionTitle>Фінансові дані</SectionTitle>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <InfoRow label="IBAN" value={person.iban || '—'} />
                  <InfoRow label="Банк" value={person.bankName || '—'} />
                  <InfoRow label="Картка" value={person.bankCard || '—'} />
                </tbody>
              </table>
            </>
          )}

          {(person.driverLicenseCategory || person.driverLicenseSeries || person.driverLicenseNumber) && (
            <>
              <SectionTitle>Посвідчення водія</SectionTitle>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <InfoRow label="Категорія" value={person.driverLicenseCategory || '—'} />
                  <InfoRow label="Серія/номер" value={[person.driverLicenseSeries, person.driverLicenseNumber].filter(Boolean).join(' ') || '—'} />
                  <InfoRow label="Ким виданий" value={person.driverLicenseIssuedBy || '—'} />
                  <InfoRow label="Дата видачі" value={formatDate(person.driverLicenseIssuedDate)} />
                  <InfoRow label="Дійсне до" value={formatDate(person.driverLicenseExpiry)} />
                </tbody>
              </table>
            </>
          )}

          {(person.tractorLicenseCategory || person.tractorLicenseSeries || person.tractorLicenseNumber) && (
            <>
              <SectionTitle>Посвідчення тракториста</SectionTitle>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <InfoRow label="Категорія" value={person.tractorLicenseCategory || '—'} />
                  <InfoRow label="Серія/номер" value={[person.tractorLicenseSeries, person.tractorLicenseNumber].filter(Boolean).join(' ') || '—'} />
                  <InfoRow label="Ким виданий" value={person.tractorLicenseIssuedBy || '—'} />
                  <InfoRow label="Дата видачі" value={formatDate(person.tractorLicenseIssuedDate)} />
                  <InfoRow label="Дійсне до" value={formatDate(person.tractorLicenseExpiry)} />
                </tbody>
              </table>
            </>
          )}

          {(person.basicTrainingDateFrom || person.basicTrainingPlace || person.basicTrainingCommander) && (
            <>
              <SectionTitle>Базова загальновійськова підготовка</SectionTitle>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <InfoRow label="Дата з" value={formatDate(person.basicTrainingDateFrom)} />
                  <InfoRow label="Дата по" value={formatDate(person.basicTrainingDateTo)} />
                  <InfoRow label="Місце" value={person.basicTrainingPlace || '—'} />
                  <InfoRow label="Командир" value={person.basicTrainingCommander || '—'} />
                  <InfoRow label="Примітки" value={person.basicTrainingNotes || '—'} />
                </tbody>
              </table>
            </>
          )}

          {person.notes && (
            <>
              <SectionTitle>Примітки</SectionTitle>
              <Text>{person.notes}</Text>
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header">
        <div className="titles">
          <div
            className="eyebrow"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/personnel')}
          >
            ← Реєстр · картка №{String(person.id).padStart(3, '0')}
          </div>
          <h1>{person.fullName}</h1>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => window.print()}>
            <PrinterOutlined />
            Друк
          </button>
          <button className="btn" onClick={() => navigate('/documents/generate')}>
            <FormOutlined />
            Згенерувати документ
          </button>
          <button className="btn primary" onClick={() => setDrawerOpen(true)}>
            <EditOutlined />
            Редагувати
          </button>
        </div>
      </div>

      {/* ── Profile hero ── */}
      <div className="profile-hero" style={{ marginBottom: 12 }}>
        <div
          onClick={handlePhotoClick}
          onMouseEnter={() => setPhotoHover(true)}
          onMouseLeave={() => setPhotoHover(false)}
          style={{
            position: 'relative',
            width: 96,
            height: 96,
            cursor: 'pointer',
            overflow: 'hidden',
            borderRadius: 'var(--radius-2)',
            border: `1px solid ${photoHover ? 'var(--accent-line)' : 'var(--line-2)'}`,
            background: 'var(--bg-3)',
            display: 'grid',
            placeItems: 'center',
            transition: 'border-color 0.2s',
            flexShrink: 0,
          }}
        >
          {effectivePhotoPath && !photoError ? (
            <img
              src={`safe-file:///${effectivePhotoPath.replace(/\\/g, '/')}`}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={() => setPhotoError(true)}
            />
          ) : (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: 18,
                color: 'var(--fg-1)',
                letterSpacing: '0.04em',
              }}
            >
              {person.callsign?.slice(0, 4).toUpperCase() || <UserOutlined style={{ fontSize: 32, color: 'var(--fg-3)' }} />}
            </div>
          )}
          {(photoHover || uploadingPhoto) && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                color: '#fff',
                fontSize: 11,
              }}
            >
              <CameraOutlined style={{ fontSize: 22 }} />
              <span>Змінити</span>
            </div>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              flexWrap: 'wrap',
            }}
          >
            <span className="rank">{person.rankName || '—'}</span>
            <span style={{ width: 1, height: 12, background: 'var(--line-2)' }} />
            <span
              className="mono"
              style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}
            >
              {person.callsign || '—'}
            </span>
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.015em',
              marginBottom: 4,
              color: 'var(--fg-0)',
            }}
          >
            {person.fullName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 10 }}>
            {person.positionTitle || person.currentPositionIdx || '—'}
            {person.currentSubdivision ? ` · ${person.currentSubdivision} · 12 ШР` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {person.currentStatusCode ? (
              <span
                className={pillClassForStatus(
                  person.currentStatusCode,
                  statusTypes.find((s) => s.code === person.currentStatusCode)?.groupName
                )}
              >
                <span className="dot" />
                {person.currentStatusCode} · {person.statusName || ''}
              </span>
            ) : (
              <span className="pill muted">
                <span className="dot" />
                без статусу
              </span>
            )}
            {person.serviceType && (
              <span className="mono dim" style={{ fontSize: 11 }}>
                · {person.serviceType}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            alignItems: 'flex-end',
            flexShrink: 0,
          }}
        >
          <div className="eyebrow">ОСОБИСТИЙ №</div>
          <div
            className="mono tnum"
            style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.06em' }}
          >
            {person.personalNumber || person.ipn || '—'}
          </div>
          <div className="mono dim" style={{ fontSize: 10, marginTop: 4 }}>
            ІПН {person.ipn ? `${person.ipn.slice(0, 2)}●●●●●●${person.ipn.slice(-2)}` : '●●●●●●●●●●'}
          </div>
        </div>
      </div>

      {/* ── Top 3-column section ── */}
      <Row gutter={[12, 12]}>
        {/* ── Col 1: Основні дані ── */}
        <Col xs={24} lg={12}>
          <Card bodyStyle={{ padding: 12 }} style={{ height: '100%' }}>
            <SectionTitle>Основні дані</SectionTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 110 }} />
                <col />
              </colgroup>
              <tbody>
                <InfoRow label="ПІБ" value={<strong>{person.fullName}</strong>} />
                <InfoRow label="Звання" value={<RankBadge rankName={person.rankName} category={person.rankCategory} />} />
                <InfoRow label="Позивний" value={person.callsign || '—'} />
                <InfoRow
                  label="Статус"
                  value={
                    <StatusBadge
                      statusCode={person.currentStatusCode}
                      statusName={person.statusName}
                      colorCode={statusColor}
                    />
                  }
                />
                <InfoRow label="Підрозділ" value={person.currentSubdivision || '—'} />
                <InfoRow label="Посада" value={person.positionTitle || person.currentPositionIdx || '—'} />
                <InfoRow label="Вид служби" value={person.serviceType || '—'} />
                <InfoRow label="Особистий номер" value={person.ipn || '—'} />
              </tbody>
            </table>
          </Card>
        </Col>

        {/* ── Col 2: Особисті дані + Служба та призначення ── */}
        <Col xs={24} sm={12} lg={6}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card bodyStyle={{ padding: 12 }}>
              <SectionTitle>Особисті дані</SectionTitle>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <InfoRow label="Дата народження" value={formatDate(person.dateOfBirth)} />
                  <InfoRow
                    label="Стать"
                    value={person.gender === 'ч' ? 'Чоловіча' : person.gender === 'ж' ? 'Жіноча' : '—'}
                  />
                  <InfoRow label="Група крові" value={bloodTypeName || '—'} />
                  <InfoRow label="ІПН" value={person.ipn || '—'} />
                  <InfoRow
                    label="УБД"
                    value={[person.ubdSeries, person.ubdNumber].filter(Boolean).join(' ') || '—'}
                  />
                </tbody>
              </table>
            </Card>

            <Card bodyStyle={{ padding: 12 }}>
              <SectionTitle>Службові відомості</SectionTitle>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <InfoRow label="ВОС" value={person.specialtyCode || '—'} />
                  <InfoRow label="Зарахований до списків в/ч" value={formatDate(person.enrollmentDate)} />
                  <InfoRow label="Наказ" value={person.enrollmentOrderNum || '—'} />
                  <InfoRow label="Призваний" value={[person.tccName, formatDate(person.conscriptionDate)].filter(v => v && v !== '—').join(', ') || '—'} />
                  {person.serviceType !== 'мобілізація' && person.serviceType !== 'мобілізований' && (
                    <InfoRow label="Кінець контракту" value={
                      [contractName, formatDate(person.contractEndDate)].filter(v => v && v !== '—').join(' — ') || '—'
                    } />
                  )}
                </tbody>
              </table>
            </Card>
          </Space>
        </Col>

        {/* ── Col 3: Контакти та сім'я ── */}
        <Col xs={24} sm={12} lg={6}>
          <Card bodyStyle={{ padding: 12 }} style={{ height: '100%' }}>
            <SectionTitle>Контакти та сім&apos;я</SectionTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <InfoRow label="Телефон" value={person.phone || '—'} />
                <InfoRow label="Сімейний стан" value={person.maritalStatus || '—'} />
                {person.addressRegistered && person.addressActual && person.addressRegistered.trim().toLowerCase() === person.addressActual.trim().toLowerCase() ? (
                  <InfoRow label="Адреса проживання та реєстрації" value={person.addressActual} />
                ) : (
                  <>
                    <InfoRow label="Адреса реєстрації" value={person.addressRegistered || '—'} />
                    <InfoRow label="Адреса проживання" value={person.addressActual || '—'} />
                  </>
                )}
                <InfoRow label="Родичі" value={
                  person.relativesInfo
                    ? <span style={{ whiteSpace: 'pre-line' }}>{person.relativesInfo.replace(/;\s*/g, ';\n')}</span>
                    : '—'
                } />
              </tbody>
            </table>
          </Card>
        </Col>
      </Row>

      {/* ── Tabs ── */}
      <Card style={{ marginTop: 12 }} bodyStyle={{ paddingTop: 8 }}>
        <Tabs items={tabItems} defaultActiveKey="movements" />
      </Card>

      <PersonnelForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={refetch}
        editRecord={person as any}
      />

      <MovementForm
        open={movementDrawerOpen}
        onClose={() => setMovementDrawerOpen(false)}
        onSaved={() => { refetchMovements(); refetch() }}
        personnelId={person.id}
        currentPositionIdx={person.currentPositionIdx}
      />

      <StatusHistoryForm
        open={statusDrawerOpen}
        onClose={() => setStatusDrawerOpen(false)}
        onSaved={() => { refetchStatuses(); refetch() }}
        personnelId={person.id}
      />
    </>
  )
}
