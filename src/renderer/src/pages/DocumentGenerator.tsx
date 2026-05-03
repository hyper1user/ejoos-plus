import { useState, useEffect } from 'react'
import {
  Card,
  Steps,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Form,
  Input,
  Result,
  Spin,
  message
} from 'antd'
import {
  FileTextOutlined,
  FileProtectOutlined,
  MedicineBoxOutlined,
  CheckCircleOutlined,
  FolderOpenOutlined,
  AlertOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'
import { useTemplateList } from '@renderer/hooks/useDocuments'
import PersonnelSearchSelect from '@renderer/components/movements/PersonnelSearchSelect'
import TemplateFieldsForm from '@renderer/components/documents/TemplateFieldsForm'
import type { DocumentTemplate, GeneratedDocument } from '@shared/types/document'

const { Title, Text } = Typography

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  order: <FileTextOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
  leave_ticket: <FileProtectOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
  injury_certificate: <MedicineBoxOutlined style={{ fontSize: 32, color: '#fa541c' }} />,
  report: <AlertOutlined style={{ fontSize: 32, color: '#faad14' }} />,
  certificate: <SafetyCertificateOutlined style={{ fontSize: 32, color: '#722ed1' }} />
}

export default function DocumentGenerator(): JSX.Element {
  const { templates, loading: templatesLoading } = useTemplateList()
  const [current, setCurrent] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [personnelId, setPersonnelId] = useState<number | undefined>()
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GeneratedDocument | null>(null)
  const [form] = Form.useForm()

  // Load tags when template selected
  useEffect(() => {
    if (!selectedTemplate) return
    setTagsLoading(true)
    window.api
      .templatesGetTags(selectedTemplate.id)
      .then((t) => setTags(t ?? []))
      .catch(() => setTags([]))
      .finally(() => setTagsLoading(false))
  }, [selectedTemplate])

  const handleSelectTemplate = (tmpl: DocumentTemplate): void => {
    setSelectedTemplate(tmpl)
    setPersonnelId(undefined)
    setResult(null)
    form.resetFields()
    setCurrent(1)
  }

  const handleGenerate = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setGenerating(true)

      const response = await window.api.documentsGenerate({
        templateId: selectedTemplate!.id,
        title: values.title || selectedTemplate!.name,
        personnelIds: personnelId ? [personnelId] : undefined,
        fields: values.fields ?? {}
      })

      if (response?.error) {
        message.error(response.message ?? 'Помилка генерації')
        return
      }

      setResult(response)
      setCurrent(3)
      message.success('Документ згенеровано!')
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return // validation
      message.error(String(err))
    } finally {
      setGenerating(false)
    }
  }

  const handleOpenFile = async (): Promise<void> => {
    if (result?.filePath) {
      await window.api.documentsOpen(result.filePath)
    }
  }

  const handleReset = (): void => {
    setCurrent(0)
    setSelectedTemplate(null)
    setTags([])
    setPersonnelId(undefined)
    setResult(null)
    form.resetFields()
  }

  const steps = [
    { title: 'Шаблон' },
    { title: 'Дані' },
    { title: 'Перевірка' },
    { title: 'Готово' }
  ]

  return (
    <div>
      <div className="page-header">
        <div className="titles">
          <div className="eyebrow">генератор · word-документи</div>
          <h1>Генерація документів</h1>
          <div className="sub">
            Шаблони з підстановкою даних бійця та реквізитів. Підтримка docxtemplater.
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <Steps current={current} items={steps} />
      </div>

      {/* Step 0: Select Template */}
      {current === 0 && (
        <Spin spinning={templatesLoading}>
          <Row gutter={[16, 16]}>
            {templates.map((tmpl) => (
              <Col key={tmpl.id} xs={24} sm={12} lg={8}>
                <Card
                  hoverable
                  onClick={() => handleSelectTemplate(tmpl)}
                  style={{ textAlign: 'center', minHeight: 160 }}
                >
                  {TEMPLATE_ICONS[tmpl.templateType] ?? (
                    <FileTextOutlined style={{ fontSize: 32 }} />
                  )}
                  <Title level={5} style={{ marginTop: 12, marginBottom: 4 }}>
                    {tmpl.name}
                  </Title>
                  <Text type="secondary">{tmpl.description}</Text>
                </Card>
              </Col>
            ))}
            {!templatesLoading && templates.length === 0 && (
              <Col span={24}>
                <Card>
                  <Text type="secondary">
                    Шаблони не знайдені. Перезапустіть додаток для створення стандартних
                    шаблонів.
                  </Text>
                </Card>
              </Col>
            )}
          </Row>
        </Spin>
      )}

      {/* Step 1: Fill Data */}
      {current === 1 && selectedTemplate && (
        <Card title={`Заповнення: ${selectedTemplate.name}`}>
          <Spin spinning={tagsLoading}>
            <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
              <Form.Item
                name="title"
                label="Назва документа"
                initialValue={selectedTemplate.name}
              >
                <Input placeholder="Назва для архіву" />
              </Form.Item>

              <Form.Item label="Особа (для автозаповнення)">
                <PersonnelSearchSelect
                  value={personnelId}
                  onChange={(v) => setPersonnelId(v)}
                  placeholder="Пошук за ПІБ або ІПН (необов'язково)..."
                />
              </Form.Item>

              <TemplateFieldsForm tags={tags} hasPersonnel={!!personnelId} />
            </Form>
          </Spin>

          <Space style={{ marginTop: 16 }}>
            <Button onClick={() => setCurrent(0)}>Назад</Button>
            <Button type="primary" onClick={() => setCurrent(2)}>
              Далі
            </Button>
          </Space>
        </Card>
      )}

      {/* Step 2: Review */}
      {current === 2 && selectedTemplate && (
        <Card title="Перевірка перед генерацією">
          <div style={{ marginBottom: 16 }}>
            <Text strong>Шаблон:</Text> {selectedTemplate.name}
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Назва:</Text>{' '}
            {form.getFieldValue('title') || selectedTemplate.name}
          </div>
          {personnelId && (
            <div style={{ marginBottom: 16 }}>
              <Text strong>Особа:</Text> ID {personnelId}
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <Text strong>Заповнені поля:</Text>
            <ul style={{ marginTop: 8 }}>
              {Object.entries(form.getFieldValue('fields') ?? {})
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <li key={k}>
                    <Text code>{k}</Text>: {String(v)}
                  </li>
                ))}
            </ul>
          </div>

          <Space>
            <Button onClick={() => setCurrent(1)}>Назад</Button>
            <Button type="primary" loading={generating} onClick={handleGenerate}>
              Згенерувати
            </Button>
          </Space>
        </Card>
      )}

      {/* Step 3: Result */}
      {current === 3 && result && (
        <Result
          status="success"
          icon={<CheckCircleOutlined />}
          title="Документ успішно згенеровано!"
          subTitle={result.title ?? result.documentType}
          extra={[
            <Button
              key="open"
              type="primary"
              icon={<FolderOpenOutlined />}
              onClick={handleOpenFile}
            >
              Відкрити файл
            </Button>,
            <Button key="new" onClick={handleReset}>
              Створити новий
            </Button>
          ]}
        />
      )}
    </div>
  )
}
