/**
 * Parser for ЕЖООС.xlsx file
 * Extracts: positions, personnel (active + excluded), movements, status history
 */
import * as XLSX from 'xlsx'
import { validateIpn } from '@shared/validators'
import { cellStr, cellDate, cellNum, splitFullName, cleanString, parseDateValue } from './parse-utils'
import type {
  ParsedPosition,
  ParsedPersonnel,
  ParsedMovement,
  ParsedStatus,
  ParseError,
  ParseResult
} from '@shared/types/import'

// ==================== POSITIONS ====================

function parsePositions(wb: XLSX.WorkBook): { data: ParsedPosition[]; errors: ParseError[] } {
  const sheetName = findSheet(wb, ['Посади', 'посади', 'Positions'])
  if (!sheetName) return { data: [], errors: [{ row: 0, sheet: 'Посади', field: '', message: 'Аркуш "Посади" не знайдено', severity: 'error' }] }

  const sheet = wb.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null })
  const data: ParsedPosition[] = []
  const errors: ParseError[] = []

  // Row 0=title, 1=headers, 2=IDs, 3+=data
  const startRow = 3
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[0]) continue

    const positionIndex = cellStr(row, 0)
    const title = cellStr(row, 4)

    if (!positionIndex) {
      errors.push({ row: i + 1, sheet: sheetName, field: 'positionIndex', message: 'Відсутній індекс посади', severity: 'warning' })
      continue
    }
    if (!title) {
      errors.push({ row: i + 1, sheet: sheetName, field: 'title', message: `Відсутня назва посади для ${positionIndex}`, severity: 'warning' })
      continue
    }

    data.push({
      positionIndex,
      subdivisionCode: cellStr(row, 2) || '',
      title,
      rankRequired: cellStr(row, 5),
      specialtyCode: cellStr(row, 6),
      tariffGrade: cellNum(row, 7),
      staffNumber: cellStr(row, 9),
      notes: cellStr(row, 12)
    })
  }

  return { data, errors }
}

// ==================== PERSONNEL ====================

function parsePersonnelSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  status: 'active' | 'excluded'
): { data: ParsedPersonnel[]; errors: ParseError[] } {
  const actualSheet = findSheet(wb, [sheetName])
  if (!actualSheet) return { data: [], errors: [{ row: 0, sheet: sheetName, field: '', message: `Аркуш "${sheetName}" не знайдено`, severity: 'error' }] }

  const sheet = wb.Sheets[actualSheet]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null })
  const data: ParsedPersonnel[] = []
  const errors: ParseError[] = []

  // Row 0=headers, 1=sub-headers, 2=IDs, 3+=data
  const startRow = 3
  const seenIpn = new Set<string>()

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const fullNameRaw = cellStr(row, 2)
    if (!fullNameRaw) continue // skip empty rows

    const ipn = cellStr(row, 3)
    if (!ipn) {
      errors.push({ row: i + 1, sheet: actualSheet, field: 'ipn', message: `Відсутній ІПН для "${fullNameRaw}"`, severity: 'error' })
      continue
    }

    // Validate IPN
    if (!/^\d{10}$/.test(ipn)) {
      errors.push({ row: i + 1, sheet: actualSheet, field: 'ipn', message: `Невірний формат ІПН: ${ipn}`, severity: 'error' })
      continue
    }

    if (!validateIpn(ipn)) {
      errors.push({ row: i + 1, sheet: actualSheet, field: 'ipn', message: `Невірна контрольна сума ІПН: ${ipn}`, severity: 'warning' })
    }

    // Duplicate check
    if (seenIpn.has(ipn)) {
      errors.push({ row: i + 1, sheet: actualSheet, field: 'ipn', message: `Дублікат ІПН: ${ipn}`, severity: 'warning' })
      continue
    }
    seenIpn.add(ipn)

    const { lastName, firstName, patronymic } = splitFullName(fullNameRaw)

    if (!lastName || !firstName) {
      errors.push({ row: i + 1, sheet: actualSheet, field: 'fullName', message: `Невдалось розділити ПІБ: "${fullNameRaw}"`, severity: 'warning' })
    }

    // Parse gender
    let gender: string | null = cellStr(row, 48)
    if (gender) {
      gender = gender.toLowerCase()
      if (gender !== 'ч' && gender !== 'ж') {
        gender = gender.startsWith('ч') ? 'ч' : gender.startsWith('ж') ? 'ж' : null
      }
    }

    data.push({
      ipn,
      rankCategory: cellStr(row, 0),
      rankName: cellStr(row, 1),
      fullName: fullNameRaw,
      lastName: lastName || fullNameRaw,
      firstName: firstName || '',
      patronymic,
      callsign: cellStr(row, 4),
      dateOfBirth: cellDate(row, 5),
      phone: cellStr(row, 6),

      enrollmentOrderDate: cellDate(row, 7),
      enrollmentOrderInfo: cellStr(row, 8),
      arrivedFrom: cellStr(row, 9),
      arrivalPositionIdx: cellStr(row, 10),
      enrollmentDate: cellDate(row, 11),
      enrollmentOrderNum: cellStr(row, 12),

      currentPositionIdx: cellStr(row, 16),
      currentSubdivision: cellStr(row, 17),
      currentStatusCode: cellStr(row, 19),

      rankOrderDate: cellDate(row, 28),
      rankOrderInfo: cellStr(row, 29),

      serviceType: cellStr(row, 30),
      contractDate: cellDate(row, 31),
      contractTypeName: cellStr(row, 32),

      idDocNumber: cellStr(row, 34),
      idDocType: cellStr(row, 37),
      birthplace: cellStr(row, 38),
      conscriptionDate: cellDate(row, 39),
      tccName: cellStr(row, 40),
      oblast: cellStr(row, 41),
      educationLevelName: cellStr(row, 42),
      educationInstitution: cellStr(row, 43),
      educationYear: cellStr(row, 44),
      addressActual: cellStr(row, 45),
      maritalStatus: cellStr(row, 46),
      relativesInfo: cellStr(row, 47),
      gender,
      fitness: cellStr(row, 50),
      bloodTypeName: cellStr(row, 51),
      additionalInfo: cellStr(row, 52),

      status
    })
  }

  return { data, errors }
}

// ==================== MOVEMENTS ====================

function parseMovements(wb: XLSX.WorkBook): { data: ParsedMovement[]; errors: ParseError[] } {
  const sheetName = findSheet(wb, ['Переміщення', 'переміщення', 'Movements'])
  if (!sheetName) return { data: [], errors: [{ row: 0, sheet: 'Переміщення', field: '', message: 'Аркуш "Переміщення" не знайдено', severity: 'error' }] }

  const sheet = wb.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null })
  const data: ParsedMovement[] = []
  const errors: ParseError[] = []

  // Row 0=headers, 1=IDs, 2+=data
  const startRow = 2
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const ipn = cellStr(row, 5)
    if (!ipn) continue // skip empty rows

    const orderTypeRaw = cellStr(row, 4)
    if (!orderTypeRaw) {
      errors.push({ row: i + 1, sheet: sheetName, field: 'orderType', message: `Відсутній тип наказу, ІПН: ${ipn}`, severity: 'warning' })
      continue
    }
    // v0.9.5: ЕЖООС.xlsx використовує `'Виключений'` (дієприкметник минулого
    // часу), а вся внутрішня логіка (fixExcludedFromMovements, MOVEMENTS_CREATE
    // гілка, MovementTimeline кольоровий мап) очікує канонічну форму
    // `'Виключення'` (іменник, як у MOVEMENT_ORDER_TYPES enum). Приводимо до
    // канонічної форми тут — щоб у `movements` лежало одне значення з якого
    // б джерела не прийшло.
    const orderType = orderTypeRaw === 'Виключений' ? 'Виключення' : orderTypeRaw

    const dateFrom = cellDate(row, 10)
    if (!dateFrom) {
      errors.push({ row: i + 1, sheet: sheetName, field: 'dateFrom', message: `Відсутня дата початку, ІПН: ${ipn}`, severity: 'warning' })
      continue
    }

    const isActiveRaw = cellStr(row, 17)

    data.push({
      ipn,
      orderIssuer: cellStr(row, 1),
      orderNumber: cellStr(row, 2),
      orderDate: cellDate(row, 3),
      orderType,
      positionIndex: cellStr(row, 8),
      dailyOrderNumber: cellStr(row, 9),
      dateFrom,
      dateTo: cellDate(row, 12),
      previousPosition: cellStr(row, 13),
      isActive: isActiveRaw !== null && isActiveRaw !== ''
    })
  }

  return { data, errors }
}

// ==================== STATUS HISTORY ====================

function parseStatusHistory(wb: XLSX.WorkBook): { data: ParsedStatus[]; errors: ParseError[] } {
  const sheetName = findSheet(wb, ['Статуси', 'статуси', 'Statuses'])
  if (!sheetName) return { data: [], errors: [{ row: 0, sheet: 'Статуси', field: '', message: 'Аркуш "Статуси" не знайдено', severity: 'error' }] }

  const sheet = wb.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null })
  const data: ParsedStatus[] = []
  const errors: ParseError[] = []

  // Row 0=headers, 1=IDs, 2+=data
  const startRow = 2
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const ipn = cellStr(row, 0)
    if (!ipn) continue

    const statusCode = cellStr(row, 3)
    if (!statusCode) {
      errors.push({ row: i + 1, sheet: sheetName, field: 'statusCode', message: `Відсутній код статусу, ІПН: ${ipn}`, severity: 'warning' })
      continue
    }

    const dateFrom = cellDate(row, 5)
    if (!dateFrom) {
      errors.push({ row: i + 1, sheet: sheetName, field: 'dateFrom', message: `Відсутня дата початку статусу, ІПН: ${ipn}`, severity: 'warning' })
      continue
    }

    const isActiveRaw = cellStr(row, 9)
    const isLastRaw = cellStr(row, 10)

    data.push({
      ipn,
      statusCode,
      presenceGroup: cellStr(row, 4),
      dateFrom,
      dateTo: cellDate(row, 6),
      comment: cellStr(row, 7),
      isActive: isActiveRaw !== null && isActiveRaw !== '',
      isLast: isLastRaw !== null && isLastRaw !== ''
    })
  }

  return { data, errors }
}

// ==================== MAIN PARSER ====================

/**
 * Parse entire EJOOS.xlsx file
 */
export function parseEjoosFile(filePath: string): ParseResult {
  const wb = XLSX.readFile(filePath, { type: 'file', cellDates: false, raw: true })

  const allErrors: ParseError[] = []
  const allWarnings: ParseError[] = []

  const addErrors = (items: ParseError[]): void => {
    for (const e of items) {
      if (e.severity === 'error') allErrors.push(e)
      else allWarnings.push(e)
    }
  }

  // 1. Parse positions
  const posResult = parsePositions(wb)
  addErrors(posResult.errors)

  // 2. Parse active personnel (sheet "ООС")
  const persResult = parsePersonnelSheet(wb, 'ООС', 'active')
  addErrors(persResult.errors)

  // 3. Parse excluded personnel (sheet "Виключені")
  const exclResult = parsePersonnelSheet(wb, 'Виключені', 'excluded')
  addErrors(exclResult.errors)

  // 4. Parse movements
  const movResult = parseMovements(wb)
  addErrors(movResult.errors)

  // 5. Parse status history
  const statusResult = parseStatusHistory(wb)
  addErrors(statusResult.errors)

  return {
    positions: posResult.data,
    personnel: persResult.data,
    excluded: exclResult.data,
    movements: movResult.data,
    statusHistory: statusResult.data,
    errors: allErrors,
    warnings: allWarnings,
    stats: {
      positionsCount: posResult.data.length,
      personnelCount: persResult.data.length,
      excludedCount: exclResult.data.length,
      movementsCount: movResult.data.length,
      statusesCount: statusResult.data.length,
      errorsCount: allErrors.length,
      warningsCount: allWarnings.length
    }
  }
}

// ==================== HELPERS ====================

/** Find sheet by possible name variants */
function findSheet(wb: XLSX.WorkBook, names: string[]): string | null {
  for (const name of names) {
    if (wb.SheetNames.includes(name)) return name
  }
  // Fuzzy match: try includes
  for (const name of names) {
    const found = wb.SheetNames.find((s) => s.toLowerCase().includes(name.toLowerCase()))
    if (found) return found
  }
  return null
}
