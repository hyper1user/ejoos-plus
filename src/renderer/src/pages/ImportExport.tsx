import { useState } from 'react'
import {
  Card,
  Button,
  Typography,
  Tabs,
  Table,
  Tag,
  Statistic,
  Row,
  Col,
  Alert,
  Space,
  Result,
  Spin,
  Progress,
  Badge
} from 'antd'
import {
  CloudUploadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  UserOutlined,
  SwapOutlined,
  TagsOutlined,
  AppstoreOutlined,
  DownloadOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import type { ParseResult, ImportResult, ParseError, DataImportResult, ImpulseImportResult } from '@shared/types/import'
import type { ExportResult, CsvExportResult } from '@shared/types/export'

const { Title, Text, Paragraph } = Typography

type ImportPhase = 'idle' | 'loading' | 'preview' | 'importing' | 'done' | 'error'
type DataPhase = 'idle' | 'loading' | 'done' | 'error'
type ImpulsePhase = 'idle' | 'loading' | 'done' | 'error'
type ExportPhase = 'idle' | 'exporting' | 'done' | 'error'

export default function ImportExport(): JSX.Element {
  // EJOOS state
  const [ejoosPhase, setEjoosPhase] = useState<ImportPhase>('idle')
  const [ejoosPath, setEjoosPath] = useState<string>('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [ejoosError, setEjoosError] = useState<string>('')

  // Data.xlsx state
  const [dataPhase, setDataPhase] = useState<DataPhase>('idle')
  const [dataPath, setDataPath] = useState<string>('')
  const [dataResult, setDataResult] = useState<DataImportResult | null>(null)
  const [dataError, setDataError] = useState<string>('')

  // Impulse state
  const [impulsePhase, setImpulsePhase] = useState<ImpulsePhase>('idle')
  const [impulseResult, setImpulseResult] = useState<ImpulseImportResult | null>(null)
  const [impulseError, setImpulseError] = useState<string>('')

  // Export EJOOS state
  const [exportEjoosPhase, setExportEjoosPhase] = useState<ExportPhase>('idle')
  const [exportEjoosResult, setExportEjoosResult] = useState<ExportResult | null>(null)
  const [exportEjoosError, setExportEjoosError] = useState<string>('')

  // Export CSV state
  const [exportCsvPhase, setExportCsvPhase] = useState<ExportPhase>('idle')
  const [exportCsvResult, setExportCsvResult] = useState<CsvExportResult | null>(null)
  const [exportCsvError, setExportCsvError] = useState<string>('')

  // ==================== EJOOS HANDLERS ====================

  const handleSelectEjoos = async (): Promise<void> => {
    const filePath = await window.api.openFileDialog([
      { name: 'Excel ЕЖООС', extensions: ['xlsx', 'xls'] }
    ])
    if (!filePath) return

    setEjoosPath(filePath)
    setEjoosPhase('loading')
    setParseResult(null)
    setImportResult(null)
    setEjoosError('')

    try {
      const result = await window.api.importEjoosPreview(filePath)
      if (result && 'error' in result) {
        setEjoosError(result.message || 'Помилка парсингу')
        setEjoosPhase('error')
        return
      }
      setParseResult(result as ParseResult)
      setEjoosPhase('preview')
    } catch (e) {
      setEjoosError(String(e))
      setEjoosPhase('error')
    }
  }

  const handleConfirmImport = async (): Promise<void> => {
    if (!ejoosPath) return
    setEjoosPhase('importing')
    try {
      const result = await window.api.importEjoosConfirm(ejoosPath)
      setImportResult(result as ImportResult)
      setEjoosPhase('done')
    } catch (e) {
      setEjoosError(String(e))
      setEjoosPhase('error')
    }
  }

  const handleResetEjoos = (): void => {
    setEjoosPhase('idle')
    setEjoosPath('')
    setParseResult(null)
    setImportResult(null)
    setEjoosError('')
  }

  // ==================== DATA.XLSX HANDLERS ====================

  const handleSelectData = async (): Promise<void> => {
    const filePath = await window.api.openFileDialog([
      { name: 'Excel Data', extensions: ['xlsx', 'xls'] }
    ])
    if (!filePath) return

    setDataPath(filePath)
    setDataPhase('loading')
    setDataResult(null)
    setDataError('')

    try {
      const response = await window.api.importData(filePath)
      if (response?.result) {
        setDataResult(response.result as DataImportResult)
        setDataPhase('done')
      } else {
        setDataError('Невідома відповідь від сервера')
        setDataPhase('error')
      }
    } catch (e) {
      setDataError(String(e))
      setDataPhase('error')
    }
  }

  // ==================== IMPULSE HANDLERS ====================

  const handleSelectImpulse = async (): Promise<void> => {
    const filePath = await window.api.openFileDialog([
      { name: 'Excel Impulse', extensions: ['xlsx', 'xls'] }
    ])
    if (!filePath) return

    setImpulsePhase('loading')
    setImpulseResult(null)
    setImpulseError('')

    try {
      const response = await window.api.importImpulse(filePath)
      if (response?.result) {
        setImpulseResult(response.result as ImpulseImportResult)
        setImpulsePhase('done')
      } else {
        setImpulseError('Невідома відповідь від сервера')
        setImpulsePhase('error')
      }
    } catch (e) {
      setImpulseError(String(e))
      setImpulsePhase('error')
    }
  }

  // ==================== EXPORT HANDLERS ====================

  const handleExportEjoos = async (): Promise<void> => {
    setExportEjoosPhase('exporting')
    setExportEjoosResult(null)
    setExportEjoosError('')

    try {
      const result = (await window.api.exportEjoos()) as ExportResult
      if (result.success) {
        setExportEjoosResult(result)
        setExportEjoosPhase('done')
      } else if (result.errors?.[0] === 'Скасовано користувачем') {
        setExportEjoosPhase('idle')
      } else {
        setExportEjoosError(result.errors?.join('; ') || 'Невідома помилка')
        setExportEjoosPhase('error')
      }
    } catch (e) {
      setExportEjoosError(String(e))
      setExportEjoosPhase('error')
    }
  }

  const handleExportCsv = async (): Promise<void> => {
    setExportCsvPhase('exporting')
    setExportCsvResult(null)
    setExportCsvError('')

    try {
      const result = (await window.api.exportCsv()) as CsvExportResult
      if (result.success) {
        setExportCsvResult(result)
        setExportCsvPhase('done')
      } else if (result.errors?.[0] === 'Скасовано користувачем') {
        setExportCsvPhase('idle')
      } else {
        setExportCsvError(result.errors?.join('; ') || 'Невідома помилка')
        setExportCsvPhase('error')
      }
    } catch (e) {
      setExportCsvError(String(e))
      setExportCsvPhase('error')
    }
  }

  // ==================== RENDER ====================

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">обмін даними · ЕЖООС / ШПО / Дата</div>
          <h1>Імпорт / Експорт</h1>
          <div className="sub">Імпорт із .xlsx (ЕЖООС, Імпульс) · експорт реєстру у CSV/Excel</div>
        </div>
      </div>
      {/* Section 1: EJOOS Import */}
      <Card
        title={
          <Space>
            <FileExcelOutlined />
            <span>Імпорт ЕЖООС.xlsx</span>
          </Space>
        }
        extra={
          ejoosPhase !== 'idle' && ejoosPhase !== 'loading' ? (
            <Button onClick={handleResetEjoos} size="small">
              Скинути
            </Button>
          ) : null
        }
      >
        {ejoosPhase === 'idle' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Paragraph type="secondary" style={{ marginBottom: 24 }}>
              Оберіть файл ЕЖООС.xlsx для імпорту посад, особового складу, переміщень та статусів.
            </Paragraph>
            <Button
              type="primary"
              size="large"
              icon={<CloudUploadOutlined />}
              onClick={handleSelectEjoos}
            >
              Обрати ЕЖООС.xlsx
            </Button>
          </div>
        )}

        {ejoosPhase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <Paragraph style={{ marginTop: 16 }}>Парсинг файлу...</Paragraph>
          </div>
        )}

        {ejoosPhase === 'preview' && parseResult && (
          <EjoosPreview
            parseResult={parseResult}
            filePath={ejoosPath}
            onConfirm={handleConfirmImport}
          />
        )}

        {ejoosPhase === 'importing' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <Paragraph style={{ marginTop: 16 }}>Імпорт даних у базу...</Paragraph>
          </div>
        )}

        {ejoosPhase === 'done' && importResult && (
          <EjoosResult result={importResult} />
        )}

        {ejoosPhase === 'error' && (
          <Result
            status="error"
            title="Помилка імпорту"
            subTitle={ejoosError}
            extra={
              <Button type="primary" onClick={handleResetEjoos}>
                Спробувати знову
              </Button>
            }
          />
        )}
      </Card>

      {/* Section 2: Data.xlsx Import */}
      <Card
        title={
          <Space>
            <DatabaseOutlined />
            <span>Імпорт Data.xlsx (збагачення)</span>
          </Space>
        }
      >
        {dataPhase === 'idle' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Paragraph type="secondary" style={{ marginBottom: 24 }}>
              Оберіть файл Data.xlsx для збагачення існуючих записів ОС даними паспорту, УБД, родичів,
              військового квитка тощо.
            </Paragraph>
            <Button
              type="default"
              size="large"
              icon={<CloudUploadOutlined />}
              onClick={handleSelectData}
            >
              Обрати Data.xlsx
            </Button>
          </div>
        )}

        {dataPhase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <Paragraph style={{ marginTop: 16 }}>Обробка Data.xlsx...</Paragraph>
          </div>
        )}

        {dataPhase === 'done' && dataResult && (
          <DataResult result={dataResult} />
        )}

        {dataPhase === 'error' && (
          <Result
            status="error"
            title="Помилка імпорту Data.xlsx"
            subTitle={dataError}
            extra={
              <Button
                type="primary"
                onClick={() => {
                  setDataPhase('idle')
                  setDataError('')
                }}
              >
                Спробувати знову
              </Button>
            }
          />
        )}
      </Card>

      {/* Section 3: Impulse Import */}
      <Card
        title={
          <Space>
            <CloudUploadOutlined />
            <span>Імпульс Toolkit (збагачення)</span>
          </Space>
        }
      >
        {impulsePhase === 'idle' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Paragraph type="secondary" style={{ marginBottom: 24 }}>
              Оберіть файл Імпульс Toolkit (.xlsx) для збагачення існуючих записів ОС даними:
              закордонний паспорт, IBAN/банк, посвідчення водія та тракториста,
              базова загальновійськова підготовка.
            </Paragraph>
            <Button
              type="default"
              size="large"
              icon={<CloudUploadOutlined />}
              onClick={handleSelectImpulse}
            >
              Обрати файл Імпульс
            </Button>
          </div>
        )}

        {impulsePhase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <Paragraph style={{ marginTop: 16 }}>Обробка файлу Імпульс...</Paragraph>
          </div>
        )}

        {impulsePhase === 'done' && impulseResult && (
          <ImpulseResult result={impulseResult} onReset={() => { setImpulsePhase('idle'); setImpulseResult(null) }} />
        )}

        {impulsePhase === 'error' && (
          <Result
            status="error"
            title="Помилка імпорту Імпульс"
            subTitle={impulseError}
            extra={
              <Button
                type="primary"
                onClick={() => {
                  setImpulsePhase('idle')
                  setImpulseError('')
                }}
              >
                Спробувати знову
              </Button>
            }
          />
        )}
      </Card>

      {/* Section 4: Export */}
      <Card
        title={
          <Space>
            <AppstoreOutlined />
            <span>Експорт даних</span>
          </Space>
        }
      >
        <Row gutter={16}>
          {/* Export EJOOS */}
          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <FileExcelOutlined style={{ color: '#52c41a' }} />
                  <span>Експорт ЕЖООС.xlsx</span>
                </Space>
              }
            >
              {exportEjoosPhase === 'idle' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    Експорт усіх даних у формат ЕЖООС (5 аркушів: посади, ОС, виключені, переміщення, статуси)
                  </Paragraph>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleExportEjoos}
                  >
                    Експорт у Excel
                  </Button>
                </div>
              )}

              {exportEjoosPhase === 'exporting' && (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <Spin size="large" />
                  <Paragraph style={{ marginTop: 16 }}>Формування файлу...</Paragraph>
                </div>
              )}

              {exportEjoosPhase === 'done' && exportEjoosResult && (
                <Result
                  status="success"
                  title="Експорт завершено"
                  subTitle={
                    <Space direction="vertical" size={4}>
                      <Text>Посади: {exportEjoosResult.stats.positionsCount}</Text>
                      <Text>ОС (активні): {exportEjoosResult.stats.personnelCount}</Text>
                      <Text>ОС (виключені): {exportEjoosResult.stats.excludedCount}</Text>
                      <Text>Переміщення: {exportEjoosResult.stats.movementsCount}</Text>
                      <Text>Статуси: {exportEjoosResult.stats.statusesCount}</Text>
                      <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                        {exportEjoosResult.filePath}
                      </Text>
                    </Space>
                  }
                  extra={
                    <Button onClick={() => { setExportEjoosPhase('idle'); setExportEjoosResult(null) }}>
                      Готово
                    </Button>
                  }
                />
              )}

              {exportEjoosPhase === 'error' && (
                <Result
                  status="error"
                  title="Помилка експорту"
                  subTitle={exportEjoosError}
                  extra={
                    <Button type="primary" onClick={() => { setExportEjoosPhase('idle'); setExportEjoosError('') }}>
                      Спробувати знову
                    </Button>
                  }
                />
              )}
            </Card>
          </Col>

          {/* Export CSV */}
          <Col span={12}>
            <Card
              size="small"
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#1890ff' }} />
                  <span>Експорт CSV</span>
                </Space>
              }
            >
              {exportCsvPhase === 'idle' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    Експорт особового складу у CSV (UTF-8, сумісний з Excel та Google Sheets)
                  </Paragraph>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExportCsv}
                  >
                    Експорт у CSV
                  </Button>
                </div>
              )}

              {exportCsvPhase === 'exporting' && (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <Spin size="large" />
                  <Paragraph style={{ marginTop: 16 }}>Формування файлу...</Paragraph>
                </div>
              )}

              {exportCsvPhase === 'done' && exportCsvResult && (
                <Result
                  status="success"
                  title="Експорт завершено"
                  subTitle={
                    <Space direction="vertical" size={4}>
                      <Text>Записів: {exportCsvResult.recordsCount}</Text>
                      <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                        {exportCsvResult.filePath}
                      </Text>
                    </Space>
                  }
                  extra={
                    <Button onClick={() => { setExportCsvPhase('idle'); setExportCsvResult(null) }}>
                      Готово
                    </Button>
                  }
                />
              )}

              {exportCsvPhase === 'error' && (
                <Result
                  status="error"
                  title="Помилка експорту"
                  subTitle={exportCsvError}
                  extra={
                    <Button type="primary" onClick={() => { setExportCsvPhase('idle'); setExportCsvError('') }}>
                      Спробувати знову
                    </Button>
                  }
                />
              )}
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

// ==================== SUB-COMPONENTS ====================

function EjoosPreview({
  parseResult,
  filePath,
  onConfirm
}: {
  parseResult: ParseResult
  filePath: string
  onConfirm: () => void
}): JSX.Element {
  const { stats, errors, warnings } = parseResult
  const hasErrors = stats.errorsCount > 0

  return (
    <div>
      <Alert
        type="warning"
        message="Увага: імпорт замінить усі існуючі дані"
        description="Існуючі посади, ОС, переміщення та статуси будуть видалені та замінені даними з файлу."
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Text type="secondary" style={{ fontSize: 12 }}>
        Файл: {filePath}
      </Text>

      {/* Stats cards */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="Посади"
              value={stats.positionsCount}
              prefix={<SwapOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="ОС (активні)"
              value={stats.personnelCount}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="ОС (виключені)"
              value={stats.excludedCount}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="Переміщення"
              value={stats.movementsCount}
              prefix={<SwapOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="Статуси"
              value={stats.statusesCount}
              prefix={<TagsOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="Помилки"
              value={stats.errorsCount}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: stats.errorsCount > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Confirm button — above tabs so it's always visible */}
      <div
        style={{
          marginTop: 16,
          padding: '12px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          borderBottom: '1px solid #f0f0f0'
        }}
      >
        {hasErrors && (
          <Text type="danger">
            Знайдено {stats.errorsCount} критичних помилок. Імпорт може бути неповним.
          </Text>
        )}
        <Button
          type="primary"
          size="large"
          icon={<CheckCircleOutlined />}
          onClick={onConfirm}
        >
          Імпортувати в базу даних
        </Button>
      </div>

      {/* Preview tabs */}
      <Tabs
        defaultActiveKey="errors"
        style={{ marginTop: 8 }}
        items={[
          {
            key: 'errors',
            label: (
              <Badge count={errors.length + warnings.length} size="small" offset={[8, 0]}>
                <span>Помилки / Попередження</span>
              </Badge>
            ),
            children: <ErrorsTable errors={errors} warnings={warnings} />
          },
          {
            key: 'positions',
            label: `Посади (${stats.positionsCount})`,
            children: (
              <Table
                dataSource={parseResult.positions.slice(0, 100)}
                rowKey="positionIndex"
                size="small"
                pagination={{ pageSize: 20, showTotal: (t) => `${t} з ${stats.positionsCount}` }}
                scroll={{ y: 400 }}
                columns={[
                  { title: 'Індекс', dataIndex: 'positionIndex', width: 100 },
                  { title: 'Підрозділ', dataIndex: 'subdivisionCode', width: 80 },
                  { title: 'Посада', dataIndex: 'title', ellipsis: true },
                  { title: 'Звання', dataIndex: 'rankRequired', width: 150 },
                  { title: 'ВОС', dataIndex: 'specialtyCode', width: 80 },
                  { title: 'Тариф', dataIndex: 'tariffGrade', width: 60 }
                ]}
              />
            )
          },
          {
            key: 'personnel',
            label: `ОС (${stats.personnelCount})`,
            children: (
              <Table
                dataSource={parseResult.personnel.slice(0, 100)}
                rowKey="ipn"
                size="small"
                pagination={{ pageSize: 20, showTotal: (t) => `${t} з ${stats.personnelCount}` }}
                scroll={{ y: 400 }}
                columns={[
                  { title: 'ІПН', dataIndex: 'ipn', width: 110 },
                  { title: 'ПІБ', dataIndex: 'fullName', ellipsis: true },
                  { title: 'Звання', dataIndex: 'rankName', width: 150 },
                  { title: 'Посада', dataIndex: 'currentPositionIdx', width: 100 },
                  { title: 'Підрозділ', dataIndex: 'currentSubdivision', width: 80 },
                  { title: 'Статус', dataIndex: 'currentStatusCode', width: 80 }
                ]}
              />
            )
          },
          {
            key: 'movements',
            label: `Переміщення (${stats.movementsCount})`,
            children: (
              <Table
                dataSource={parseResult.movements.slice(0, 100)}
                rowKey={(_, i) => String(i)}
                size="small"
                pagination={{ pageSize: 20, showTotal: (t) => `${t} з ${stats.movementsCount}` }}
                scroll={{ y: 400 }}
                columns={[
                  { title: 'ІПН', dataIndex: 'ipn', width: 110 },
                  { title: 'Тип', dataIndex: 'orderType', width: 140 },
                  { title: 'Посада', dataIndex: 'positionIndex', width: 100 },
                  { title: 'Дата з', dataIndex: 'dateFrom', width: 100 },
                  { title: 'Дата до', dataIndex: 'dateTo', width: 100 },
                  {
                    title: 'Активна',
                    dataIndex: 'isActive',
                    width: 80,
                    render: (v: boolean) =>
                      v ? <Tag color="green">Так</Tag> : <Tag>Ні</Tag>
                  }
                ]}
              />
            )
          },
          {
            key: 'statuses',
            label: `Статуси (${stats.statusesCount})`,
            children: (
              <Table
                dataSource={parseResult.statusHistory.slice(0, 100)}
                rowKey={(_, i) => String(i)}
                size="small"
                pagination={{ pageSize: 20, showTotal: (t) => `${t} з ${stats.statusesCount}` }}
                scroll={{ y: 400 }}
                columns={[
                  { title: 'ІПН', dataIndex: 'ipn', width: 110 },
                  { title: 'Статус', dataIndex: 'statusCode', width: 80 },
                  { title: 'Група', dataIndex: 'presenceGroup', width: 100 },
                  { title: 'Дата з', dataIndex: 'dateFrom', width: 100 },
                  { title: 'Дата до', dataIndex: 'dateTo', width: 100 },
                  { title: 'Коментар', dataIndex: 'comment', ellipsis: true }
                ]}
              />
            )
          }
        ]}
      />

    </div>
  )
}

function ErrorsTable({
  errors,
  warnings
}: {
  errors: ParseError[]
  warnings: ParseError[]
}): JSX.Element {
  const all = [
    ...errors.map((e) => ({ ...e, key: `err-${e.sheet}-${e.row}-${e.field}` })),
    ...warnings.map((w) => ({ ...w, key: `warn-${w.sheet}-${w.row}-${w.field}` }))
  ]

  if (all.length === 0) {
    return (
      <Result
        status="success"
        title="Помилок не знайдено"
        subTitle="Файл пройшов валідацію успішно"
      />
    )
  }

  return (
    <Table
      dataSource={all}
      rowKey="key"
      size="small"
      pagination={{ pageSize: 20 }}
      scroll={{ y: 400 }}
      columns={[
        {
          title: 'Тип',
          dataIndex: 'severity',
          width: 100,
          render: (v: string) =>
            v === 'error' ? (
              <Tag color="red">Помилка</Tag>
            ) : (
              <Tag color="orange">Увага</Tag>
            ),
          filters: [
            { text: 'Помилка', value: 'error' },
            { text: 'Увага', value: 'warning' }
          ],
          onFilter: (value, record) => record.severity === value
        },
        { title: 'Аркуш', dataIndex: 'sheet', width: 120 },
        { title: 'Рядок', dataIndex: 'row', width: 70 },
        { title: 'Поле', dataIndex: 'field', width: 120 },
        { title: 'Повідомлення', dataIndex: 'message', ellipsis: true }
      ]}
    />
  )
}

function EjoosResult({ result }: { result: ImportResult }): JSX.Element {
  const { imported, errors } = result

  return (
    <Result
      status={result.success ? 'success' : 'warning'}
      title={result.success ? 'Імпорт завершено успішно' : 'Імпорт завершено з помилками'}
      subTitle={
        <Space direction="vertical" size={4}>
          <Text>Посади: {imported.positions}</Text>
          <Text>Особовий склад: {imported.personnel}</Text>
          <Text>Переміщення: {imported.movements}</Text>
          <Text>Статуси: {imported.statuses}</Text>
        </Space>
      }
    >
      {errors.length > 0 && (
        <div style={{ maxHeight: 300, overflow: 'auto', textAlign: 'left' }}>
          <Title level={5}>
            <WarningOutlined style={{ color: '#faad14' }} /> Попередження ({errors.length})
          </Title>
          {errors.slice(0, 50).map((err, i) => (
            <Paragraph key={i} style={{ marginBottom: 4, fontSize: 12 }} type="secondary">
              {err}
            </Paragraph>
          ))}
          {errors.length > 50 && (
            <Text type="secondary">...та ще {errors.length - 50} повідомлень</Text>
          )}
        </div>
      )}
    </Result>
  )
}

function DataResult({ result }: { result: DataImportResult }): JSX.Element {
  return (
    <Result
      status={result.success ? 'success' : 'warning'}
      title={result.success ? 'Збагачення завершено' : 'Збагачення завершено з помилками'}
      subTitle={
        <Space direction="vertical" size={4}>
          <Text>Оновлено записів: {result.updated}</Text>
          <Text>Пропущено (не знайдено в БД): {result.skipped}</Text>
        </Space>
      }
    >
      {result.errors.length > 0 && (
        <div style={{ maxHeight: 200, overflow: 'auto', textAlign: 'left' }}>
          {result.errors.map((err, i) => (
            <Paragraph key={i} style={{ marginBottom: 4, fontSize: 12 }} type="danger">
              {err}
            </Paragraph>
          ))}
        </div>
      )}
    </Result>
  )
}

function ImpulseResult({ result, onReset }: { result: ImpulseImportResult; onReset: () => void }): JSX.Element {
  return (
    <Result
      status={result.success ? 'success' : 'warning'}
      title={result.success ? 'Імпорт Імпульс завершено' : 'Імпорт завершено з помилками'}
      subTitle={
        <Space direction="vertical" size={4}>
          <Text>Оновлено записів: {result.updated}</Text>
          <Text>Пропущено (не знайдено в БД): {result.skipped}</Text>
        </Space>
      }
      extra={<Button onClick={onReset}>Імпортувати ще раз</Button>}
    >
      {result.errors.length > 0 && (
        <div style={{ maxHeight: 200, overflow: 'auto', textAlign: 'left' }}>
          {result.errors.map((err, i) => (
            <Paragraph key={i} style={{ marginBottom: 4, fontSize: 12 }} type="danger">
              {err}
            </Paragraph>
          ))}
        </div>
      )}
    </Result>
  )
}
