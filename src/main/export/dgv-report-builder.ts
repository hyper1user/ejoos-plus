/**
 * Build DGV (Додаткова грошова винагорода) report as .xlsx
 * 4 sections: 100k, 30k, не виплачувати (п.6), не брав участі (п.7)
 */
import ExcelJS from 'exceljs'
import { dialog } from 'electron'
import { getDatabase } from '../db/connection'
import { personnel, ranks, positions, statusTypes, dgvMarks, dgvMonthMeta } from '../db/schema'
import { eq, and, asc, sql } from 'drizzle-orm'
import { DGV_CODE_MAP } from '@shared/enums/dgv-codes'
import type { DgvPeriod } from '@shared/types/dgv'
import dayjs from 'dayjs'

const MONTH_NAMES_GENITIVE = [
  '', 'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
]

const MONTH_NAMES = [
  '', 'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
]

// Absence code → human-readable reason for section 7
const ABSENCE_REASON_MAP: Record<string, string> = {
  'шп': 'Штатна позиція',
  'ВПХ': 'Відрядження',
  'вд': 'Відпустка додаткова',
  'вп': 'Відпустка після поранення',
  'ВЛК': 'ВЛК',
  'Бух': 'Бухгалтерія',
  'нар': 'Наряд',
  'п.сзч': 'Повернення після СЗЧ'
}

interface PersonData {
  personnelId: number
  fullName: string
  rankName: string | null
  positionTitle: string | null
  ipn: string
  days: Record<string, string>
  notes: string
  additionalGrounds: string
  punishmentReason: string
  punishmentOrder: string
}

// Calculate periods: group consecutive days with the same code
export function calculatePeriods(
  days: Record<string, string>,
  year: number,
  month: number,
  targetCode?: string
): DgvPeriod[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const periods: DgvPeriod[] = []
  let currentCode: string | null = null
  let startDay = 0

  for (let d = 1; d <= daysInMonth + 1; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const code = days[dateStr] ?? null

    const matches = targetCode ? code === targetCode : code !== null

    if (matches && code === currentCode) {
      // Continue current period
    } else {
      // Close previous period if any
      if (currentCode && (targetCode ? currentCode === targetCode : true)) {
        const mm = String(month).padStart(2, '0')
        periods.push({
          code: currentCode,
          dateFrom: `${String(startDay).padStart(2, '0')}.${mm}.${year}`,
          dateTo: `${String(d - 1).padStart(2, '0')}.${mm}.${year}`,
          dayCount: d - startDay
        })
      }
      // Start new period
      currentCode = matches ? code : null
      startDay = d
    }
  }

  return periods
}

// Get all unique codes used by a person in a month
function getUsedCodes(days: Record<string, string>): Set<string> {
  return new Set(Object.values(days))
}

function applyHeaderStyle(row: ExcelJS.Row, colCount: number): void {
  row.height = 30
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c)
    cell.font = { bold: true, size: 10 }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E2F3' }
    }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
  }
}

function applyDataBorder(row: ExcelJS.Row, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c)
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
    cell.alignment = { wrapText: true, vertical: 'top' }
  }
}

function formatPersonTitle(p: PersonData): string {
  const parts: string[] = []
  if (p.rankName) parts.push(p.rankName)
  parts.push(p.fullName)
  if (p.positionTitle) parts.push(p.positionTitle)
  return parts.join(', ')
}

function periodsToString(periods: DgvPeriod[]): string {
  return periods.map((p) =>
    p.dateFrom === p.dateTo
      ? p.dateFrom
      : `з ${p.dateFrom} по ${p.dateTo}`
  ).join(';\n')
}

function periodsFromCol(periods: DgvPeriod[]): string {
  return periods.map((p) => p.dateFrom).join('\n')
}

function periodsToCol(periods: DgvPeriod[]): string {
  return periods.map((p) => p.dateTo).join('\n')
}

export async function buildDgvReport(
  year: number,
  month: number
): Promise<{ success: boolean; filePath: string; error?: string }> {
  const db = getDatabase()
  const mm = String(month).padStart(2, '0')
  const yearMonth = `${year}-${mm}`

  // Get on-supply statuses
  const onSupplyCodesSet = new Set(
    db.select({ code: statusTypes.code })
      .from(statusTypes)
      .where(eq(statusTypes.onSupply, true))
      .all()
      .map((s) => s.code)
  )

  // Fetch active on-supply personnel ordered by position
  const personnelRows = db
    .select({
      id: personnel.id,
      fullName: personnel.fullName,
      rankName: ranks.name,
      positionTitle: positions.title,
      ipn: personnel.ipn,
      currentStatusCode: personnel.currentStatusCode
    })
    .from(personnel)
    .leftJoin(ranks, eq(personnel.rankId, ranks.id))
    .leftJoin(positions, eq(personnel.currentPositionIdx, positions.positionIndex))
    .where(eq(personnel.status, 'active'))
    .orderBy(asc(personnel.currentPositionIdx), asc(personnel.fullName))
    .all()
    .filter((p) => p.currentStatusCode && onSupplyCodesSet.has(p.currentStatusCode))

  // Fetch marks
  const firstDay = `${year}-${mm}-01`
  const lastDay = `${year}-${mm}-${new Date(year, month, 0).getDate()}`
  const marksRows = db
    .select()
    .from(dgvMarks)
    .where(and(
      sql`${dgvMarks.date} >= ${firstDay}`,
      sql`${dgvMarks.date} <= ${lastDay}`
    ))
    .all()

  const marksMap = new Map<number, Record<string, string>>()
  for (const m of marksRows) {
    if (!marksMap.has(m.personnelId)) marksMap.set(m.personnelId, {})
    marksMap.get(m.personnelId)![m.date] = m.dgvCode
  }

  // Fetch metadata
  const metaRows = db
    .select()
    .from(dgvMonthMeta)
    .where(eq(dgvMonthMeta.yearMonth, yearMonth))
    .all()

  let grounds100 = ''
  let grounds30 = ''
  const personMeta = new Map<number, Record<string, string>>()

  for (const m of metaRows) {
    if (m.personnelId === 0) {
      if (m.metaKey === 'grounds_100') grounds100 = m.metaValue
      if (m.metaKey === 'grounds_30') grounds30 = m.metaValue
    } else {
      if (!personMeta.has(m.personnelId)) personMeta.set(m.personnelId, {})
      personMeta.get(m.personnelId)![m.metaKey] = m.metaValue
    }
  }

  // Build person data
  const people: PersonData[] = personnelRows.map((p) => {
    const pm = personMeta.get(p.id) ?? {}
    return {
      personnelId: p.id,
      fullName: p.fullName,
      rankName: p.rankName,
      positionTitle: p.positionTitle,
      ipn: p.ipn,
      days: marksMap.get(p.id) ?? {},
      notes: pm['notes'] ?? '',
      additionalGrounds: pm['additional_grounds'] ?? '',
      punishmentReason: pm['punishment_reason'] ?? '',
      punishmentOrder: pm['punishment_order'] ?? ''
    }
  })

  // Classify people
  const section1: PersonData[] = [] // has '100' marks
  const section2: PersonData[] = [] // has '30' marks
  const section6: PersonData[] = [] // has punishment
  const section7: PersonData[] = [] // has absence codes (but not in 1/2/6)

  for (const p of people) {
    const codes = getUsedCodes(p.days)
    if (codes.size === 0) continue

    if (codes.has('100')) section1.push(p)
    if (codes.has('30')) section2.push(p)
    if (p.punishmentReason) section6.push(p)

    // Section 7: anyone with absence codes
    const absentCodes = [...codes].filter((c) => {
      const info = DGV_CODE_MAP.get(c)
      return info && (info.category === 'absent' || c === 'н/п')
    })
    if (absentCodes.length > 0) section7.push(p)
  }

  // Build workbook
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`Рапорт ДГВ ${MONTH_NAMES[month]} ${year}`)

  ws.properties.defaultRowHeight = 20

  // Column widths
  ws.columns = [
    { width: 6 },   // A: №
    { width: 45 },  // B: звання, ПІБ, посада
    { width: 16 },  // C: з (дата)
    { width: 16 },  // D: по (дата)
    { width: 50 },  // E: підстава / причина
  ]

  const monthGen = MONTH_NAMES_GENITIVE[month]

  // ========== HEADER ==========
  ws.addRow([])
  const titleRow = ws.addRow([`Командиру 4 штурмового батальйону`])
  titleRow.getCell(1).alignment = { horizontal: 'right' }
  ws.mergeCells(titleRow.number, 1, titleRow.number, 5)
  ws.addRow([])
  const raptRow = ws.addRow(['РАПОРТ'])
  raptRow.getCell(1).font = { bold: true, size: 14 }
  raptRow.getCell(1).alignment = { horizontal: 'center' }
  ws.mergeCells(raptRow.number, 1, raptRow.number, 5)
  ws.addRow([])

  const introRow = ws.addRow([
    `     Відповідно до постанови Кабінету Міністрів України від 30.12.2022 №1509 доповідаю наступне:`
  ])
  ws.mergeCells(introRow.number, 1, introRow.number, 5)
  introRow.getCell(1).alignment = { wrapText: true }
  ws.addRow([])

  // ========== SECTION 1: 100 тис. ==========
  const s1intro = ws.addRow([
    `     1. Прошу виплатити особовому складу 12 штурмової роти 4 штурмового батальйону військової частини А0501 за ${monthGen} ${year} року в розмірі 100 000 грн. 00 коп. в розрахунку на місяць пропорційно часу виконання завдань:`
  ])
  ws.mergeCells(s1intro.number, 1, s1intro.number, 5)
  s1intro.getCell(1).alignment = { wrapText: true }
  ws.addRow([])

  // Section 1 table header
  const s1header = ws.addRow(['№ з/п', 'військове звання, ПІБ, посада', 'з (дата)', 'по (дата)', 'Підстава'])
  applyHeaderStyle(s1header, 5)

  // Section 1 data
  section1.forEach((p, idx) => {
    const periods = calculatePeriods(p.days, year, month, '100')
    const row = ws.addRow([
      idx + 1,
      formatPersonTitle(p),
      periodsFromCol(periods),
      periodsToCol(periods),
      p.additionalGrounds || grounds100
    ])
    applyDataBorder(row, 5)
  })

  ws.addRow([])
  ws.addRow([])

  // ========== SECTION 2: 30 тис. ==========
  const s2intro = ws.addRow([
    `     2. Прошу виплатити особовому складу 12 штурмової роти 4 штурмового батальйону військової частини А0501 за ${monthGen} ${year} року в розмірі 30 000 грн. 00 коп. в розрахунку на місяць пропорційно часу виконання завдань:`
  ])
  ws.mergeCells(s2intro.number, 1, s2intro.number, 5)
  s2intro.getCell(1).alignment = { wrapText: true }
  ws.addRow([])

  const s2header = ws.addRow(['№ з/п', 'військове звання, ПІБ, посада', 'з (дата)', 'по (дата)', 'Підстава'])
  applyHeaderStyle(s2header, 5)

  section2.forEach((p, idx) => {
    const periods = calculatePeriods(p.days, year, month, '30')
    const row = ws.addRow([
      idx + 1,
      formatPersonTitle(p),
      periodsFromCol(periods),
      periodsToCol(periods),
      p.additionalGrounds || grounds30
    ])
    applyDataBorder(row, 5)
  })

  ws.addRow([])
  ws.addRow([])

  // ========== SECTION 6: Не виплачувати ==========
  const s6intro = ws.addRow([
    `     6. Не виплачувати додаткову винагороду особовому складу 12 штурмової роти 4 штурмового батальйону військової частини А0501 за ${monthGen} ${year} року за правопорушення, що визначені абзацами другим - дев'ятим пункту 15 розділу XXXIV. Порядку виплати грошового забезпечення:`
  ])
  ws.mergeCells(s6intro.number, 1, s6intro.number, 5)
  s6intro.getCell(1).alignment = { wrapText: true }
  ws.addRow([])

  const s6header = ws.addRow(['№ з/п', 'військове звання, ПІБ, посада', 'Вид правопорушення і т.д.', '', 'Наказ командира військової частини А0501'])
  applyHeaderStyle(s6header, 5)
  ws.mergeCells(s6header.number, 3, s6header.number, 4)

  section6.forEach((p, idx) => {
    const row = ws.addRow([
      idx + 1,
      formatPersonTitle(p),
      p.punishmentReason,
      '',
      p.punishmentOrder
    ])
    applyDataBorder(row, 5)
    ws.mergeCells(row.number, 3, row.number, 4)
  })

  ws.addRow([])
  ws.addRow([])

  // ========== SECTION 7: Не брав участі ==========
  const s7intro = ws.addRow([
    `     7. Дійсним доповідаю, що наступний особовий склад не брав безпосередню участь у бойових діях або виконанні завдань в умовах особливого періоду протягом ${monthGen} ${year} року із зазначенням періодів та підстав, визначеного розділом XXXIV Порядку виплати грошового забезпечення:`
  ])
  ws.mergeCells(s7intro.number, 1, s7intro.number, 5)
  s7intro.getCell(1).alignment = { wrapText: true }
  ws.addRow([])

  const s7header = ws.addRow(['№ з/п', 'військове звання, ПІБ, посада', 'з (дата)', 'по (дата)', 'Примітка'])
  applyHeaderStyle(s7header, 5)

  section7.forEach((p, idx) => {
    // Get all absence periods
    const absentPeriods = calculatePeriods(p.days, year, month)
      .filter((per) => {
        const info = DGV_CODE_MAP.get(per.code)
        return info && (info.category === 'absent' || per.code === 'н/п')
      })

    // Build reasons
    const reasons = absentPeriods.map((per) => {
      return ABSENCE_REASON_MAP[per.code] ?? DGV_CODE_MAP.get(per.code)?.name ?? per.code
    })
    const uniqueReasons = [...new Set(reasons)]

    const row = ws.addRow([
      idx + 1,
      formatPersonTitle(p),
      periodsFromCol(absentPeriods),
      periodsToCol(absentPeriods),
      uniqueReasons.join('.\n')
    ])
    applyDataBorder(row, 5)
  })

  ws.addRow([])
  ws.addRow([])
  ws.addRow([])

  // ========== FOOTER ==========
  const footerRow = ws.addRow(['Командир 12 штурмової роти 4 штурмового батальйону'])
  ws.mergeCells(footerRow.number, 1, footerRow.number, 5)
  const signRow = ws.addRow(['капітан'])
  signRow.getCell(5).value = ''

  // Show save dialog
  const result = await dialog.showSaveDialog({
    title: 'Зберегти рапорт ДГВ',
    defaultPath: `Рапорт_ДГВ_${MONTH_NAMES[month]}_${year}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })

  if (result.canceled || !result.filePath) {
    return { success: false, filePath: '' }
  }

  await wb.xlsx.writeFile(result.filePath)
  return { success: true, filePath: result.filePath }
}
