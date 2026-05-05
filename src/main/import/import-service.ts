/**
 * Import service — writes parsed data into the database
 * Handles lookup mapping (rank name→id, subdivision code→id, etc.) and transactional writes
 */
import { getDatabase } from '../db/connection'
import {
  ranks,
  subdivisions,
  positions,
  personnel,
  movements,
  statusHistory,
  bloodTypes,
  educationLevels,
  contractTypes,
  auditLog
} from '../db/schema'
import { eq, sql } from 'drizzle-orm'
import type { ParseResult, ImportResult, DataImportResult, ParsedDataRecord, ImpulseImportResult } from '@shared/types/import'
import type { ParsedImpulseRecord } from './impulse-parser'

// ==================== LOOKUP BUILDERS ====================

interface LookupMaps {
  rankNameToId: Map<string, number>
  subdivisionCodeToId: Map<string, number>
  bloodTypeNameToId: Map<string, number>
  educationNameToId: Map<string, number>
  contractNameToId: Map<string, number>
}

function buildLookupMaps(): LookupMaps {
  const db = getDatabase()

  const rankRows = db.select().from(ranks).all()
  const rankNameToId = new Map<string, number>()
  for (const r of rankRows) {
    rankNameToId.set(r.name.toLowerCase(), r.id)
  }

  const subRows = db.select().from(subdivisions).all()
  const subdivisionCodeToId = new Map<string, number>()
  for (const s of subRows) {
    subdivisionCodeToId.set(s.code, s.id)
  }

  const btRows = db.select().from(bloodTypes).all()
  const bloodTypeNameToId = new Map<string, number>()
  for (const b of btRows) {
    bloodTypeNameToId.set(b.name.toLowerCase(), b.id)
    // Also store without spaces: "O(I)Rh+" etc
    bloodTypeNameToId.set(b.name.replace(/\s+/g, '').toLowerCase(), b.id)
  }

  const edRows = db.select().from(educationLevels).all()
  const educationNameToId = new Map<string, number>()
  for (const e of edRows) {
    educationNameToId.set(e.name.toLowerCase(), e.id)
  }

  const ctRows = db.select().from(contractTypes).all()
  const contractNameToId = new Map<string, number>()
  for (const c of ctRows) {
    contractNameToId.set(c.name.toLowerCase(), c.id)
  }

  return { rankNameToId, subdivisionCodeToId, bloodTypeNameToId, educationNameToId, contractNameToId }
}

/** Fuzzy lookup: try exact, then includes */
function fuzzyLookup(map: Map<string, number>, value: string | null): number | null {
  if (!value) return null
  const lower = value.toLowerCase().trim()

  // Exact match
  if (map.has(lower)) return map.get(lower)!

  // Partial match: find first key that contains our value or vice versa
  for (const [key, id] of map) {
    if (key.includes(lower) || lower.includes(key)) return id
  }

  return null
}

// ==================== IMPORT EJOOS ====================

export function importEjoos(parsed: ParseResult): ImportResult {
  const db = getDatabase()
  const maps = buildLookupMaps()
  const errors: string[] = []
  let importedPositions = 0
  let importedPersonnel = 0
  let importedMovements = 0
  let importedStatuses = 0

  try {
    db.run(sql`BEGIN TRANSACTION`)

    // 1. Clear existing data (reverse dependency order — всі дочірні з FK на personnel)
    db.run(sql`DELETE FROM dgv_marks`)
    db.run(sql`DELETE FROM order_items`)
    db.run(sql`DELETE FROM injury_records`)
    db.run(sql`DELETE FROM leave_records`)
    db.run(sql`DELETE FROM irrecoverable_losses`)
    db.run(sql`DELETE FROM dispositions`)
    db.run(sql`DELETE FROM absences`)
    db.run(sql`DELETE FROM attendance`)
    db.run(sql`DELETE FROM rank_history`)
    db.run(sql`DELETE FROM status_history`)
    db.run(sql`DELETE FROM movements`)
    db.run(sql`DELETE FROM personnel`)
    db.run(sql`DELETE FROM positions`)

    // 2. Import positions
    for (const pos of parsed.positions) {
      const subdivisionId = maps.subdivisionCodeToId.get(pos.subdivisionCode)
      if (!subdivisionId) {
        errors.push(`Посада ${pos.positionIndex}: підрозділ "${pos.subdivisionCode}" не знайдено`)
        continue
      }

      try {
        db.insert(positions)
          .values({
            positionIndex: pos.positionIndex,
            subdivisionId,
            title: pos.title,
            rankRequired: pos.rankRequired,
            specialtyCode: pos.specialtyCode,
            tariffGrade: pos.tariffGrade,
            staffNumber: pos.staffNumber,
            isActive: true,
            notes: pos.notes
          })
          .run()
        importedPositions++
      } catch (e) {
        errors.push(`Посада ${pos.positionIndex}: ${String(e)}`)
      }
    }

    // 3. Import personnel (active + excluded)
    const allPersonnel = [...parsed.personnel, ...parsed.excluded]
    const ipnToDbId = new Map<string, number>()

    for (const p of allPersonnel) {
      const rankId = fuzzyLookup(maps.rankNameToId, p.rankName)
      const bloodTypeId = fuzzyLookup(maps.bloodTypeNameToId, p.bloodTypeName)
      const educationLevelId = fuzzyLookup(maps.educationNameToId, p.educationLevelName)
      const contractTypeId = fuzzyLookup(maps.contractNameToId, p.contractTypeName)

      try {
        const result = db
          .insert(personnel)
          .values({
            ipn: p.ipn,
            rankId,
            lastName: p.lastName,
            firstName: p.firstName,
            patronymic: p.patronymic,
            fullName: p.fullName,
            callsign: p.callsign,
            dateOfBirth: p.dateOfBirth,
            phone: p.phone,
            enrollmentOrderDate: p.enrollmentOrderDate,
            enrollmentOrderInfo: p.enrollmentOrderInfo,
            arrivedFrom: p.arrivedFrom,
            arrivalPositionIdx: p.arrivalPositionIdx,
            enrollmentDate: p.enrollmentDate,
            enrollmentOrderNum: p.enrollmentOrderNum,
            currentPositionIdx: p.currentPositionIdx,
            currentStatusCode: p.currentStatusCode,
            currentSubdivision: p.currentSubdivision,
            rankOrderDate: p.rankOrderDate,
            rankOrderInfo: p.rankOrderInfo,
            serviceType: p.serviceType,
            contractDate: p.contractDate,
            contractTypeId,
            idDocNumber: p.idDocNumber,
            idDocType: p.idDocType,
            birthplace: p.birthplace,
            conscriptionDate: p.conscriptionDate,
            oblast: p.oblast,
            educationLevelId,
            educationInstitution: p.educationInstitution,
            educationYear: p.educationYear,
            addressActual: p.addressActual,
            maritalStatus: p.maritalStatus,
            relativesInfo: p.relativesInfo,
            gender: p.gender,
            bloodTypeId,
            fitness: p.fitness,
            additionalInfo: p.additionalInfo,
            status: p.status,
            // v0.9.3: для імпортованих з аркуша «Виключені» проставляємо
            // excludedAt — інакше вони впадуть у кінець сортування за датою
            // виключення (NULLS LAST). Точна дата з ЕЖООС невідома, тож
            // фіксуємо момент імпорту — це проксі «not earlier than».
            excludedAt: p.status === 'excluded' ? sql`datetime('now')` : null
          })
          .returning()
          .get()

        ipnToDbId.set(p.ipn, result.id)
        importedPersonnel++
      } catch (e) {
        errors.push(`ОС ${p.ipn} (${p.fullName}): ${String(e)}`)
      }
    }

    // 4. Import movements
    for (const m of parsed.movements) {
      const personnelId = ipnToDbId.get(m.ipn)
      if (!personnelId) {
        errors.push(`Переміщення: ОС з ІПН ${m.ipn} не знайдено в БД`)
        continue
      }

      try {
        db.insert(movements)
          .values({
            personnelId,
            orderIssuer: m.orderIssuer,
            orderNumber: m.orderNumber,
            orderDate: m.orderDate,
            orderType: m.orderType,
            positionIndex: m.positionIndex,
            dailyOrderNumber: m.dailyOrderNumber,
            dateFrom: m.dateFrom,
            dateTo: m.dateTo,
            previousPosition: m.previousPosition,
            isActive: m.isActive
          })
          .run()
        importedMovements++
      } catch (e) {
        errors.push(`Переміщення ІПН ${m.ipn}: ${String(e)}`)
      }
    }

    // 5. Import status history
    for (const s of parsed.statusHistory) {
      const personnelId = ipnToDbId.get(s.ipn)
      if (!personnelId) {
        errors.push(`Статус: ОС з ІПН ${s.ipn} не знайдено в БД`)
        continue
      }

      try {
        db.insert(statusHistory)
          .values({
            personnelId,
            statusCode: s.statusCode,
            presenceGroup: s.presenceGroup,
            dateFrom: s.dateFrom,
            dateTo: s.dateTo,
            comment: s.comment,
            isActive: s.isActive,
            isLast: s.isLast
          })
          .run()
        importedStatuses++
      } catch (e) {
        errors.push(`Статус ІПН ${s.ipn}: ${String(e)}`)
      }
    }

    // Audit log for import
    db.insert(auditLog)
      .values({
        tableName: 'import',
        recordId: 0,
        action: 'import_ejoos',
        newValues: JSON.stringify({
          positions: importedPositions,
          personnel: importedPersonnel,
          movements: importedMovements,
          statuses: importedStatuses,
          errors: errors.length
        })
      })
      .run()

    db.run(sql`COMMIT`)

    return {
      success: true,
      imported: {
        positions: importedPositions,
        personnel: importedPersonnel,
        movements: importedMovements,
        statuses: importedStatuses
      },
      errors
    }
  } catch (e) {
    try {
      db.run(sql`ROLLBACK`)
    } catch {
      // Ignore rollback errors
    }
    return {
      success: false,
      imported: { positions: 0, personnel: 0, movements: 0, statuses: 0 },
      errors: [`Критична помилка імпорту: ${String(e)}`]
    }
  }
}

// ==================== IMPORT DATA.XLSX ====================

// ==================== IMPORT IMPULSE ====================

export function importImpulse(records: ParsedImpulseRecord[]): ImpulseImportResult {
  const db = getDatabase()
  const maps = buildLookupMaps()
  const errors: string[] = []
  let updated = 0
  let skipped = 0

  try {
    db.run(sql`BEGIN TRANSACTION`)

    for (const rec of records) {
      // Find personnel by IPN
      const person = db
        .select({ id: personnel.id })
        .from(personnel)
        .where(eq(personnel.ipn, rec.ipn))
        .get()

      if (!person) {
        skipped++
        continue
      }

      const bloodTypeId = fuzzyLookup(maps.bloodTypeNameToId, rec.bloodTypeName)

      const updates: Record<string, unknown> = {}

      // Only update non-null fields
      if (rec.passportIssuedBy) updates.passportIssuedBy = rec.passportIssuedBy
      if (rec.passportIssuedDate) updates.passportIssuedDate = rec.passportIssuedDate
      if (rec.passportSeries) updates.passportSeries = rec.passportSeries
      if (rec.passportNumber) updates.passportNumber = rec.passportNumber

      if (rec.foreignPassportSeries) updates.foreignPassportSeries = rec.foreignPassportSeries
      if (rec.foreignPassportNumber) updates.foreignPassportNumber = rec.foreignPassportNumber
      if (rec.foreignPassportIssuedBy) updates.foreignPassportIssuedBy = rec.foreignPassportIssuedBy
      if (rec.foreignPassportIssuedDate) updates.foreignPassportIssuedDate = rec.foreignPassportIssuedDate

      if (rec.specialtyCode) updates.specialtyCode = rec.specialtyCode
      if (rec.militaryIdIssuedBy) updates.militaryIdIssuedBy = rec.militaryIdIssuedBy
      if (rec.militaryIdIssuedDate) updates.militaryIdIssuedDate = rec.militaryIdIssuedDate
      if (rec.militaryIdSeries) updates.militaryIdSeries = rec.militaryIdSeries
      if (rec.militaryIdNumber) updates.militaryIdNumber = rec.militaryIdNumber

      if (rec.ubdIssuedBy) updates.ubdIssuedBy = rec.ubdIssuedBy
      if (rec.ubdDate) updates.ubdDate = rec.ubdDate
      if (rec.ubdSeries) updates.ubdSeries = rec.ubdSeries
      if (rec.ubdNumber) updates.ubdNumber = rec.ubdNumber

      if (rec.iban) updates.iban = rec.iban
      if (rec.bankCard) updates.bankCard = rec.bankCard
      if (rec.bankName) updates.bankName = rec.bankName

      if (rec.driverLicenseIssuedBy) updates.driverLicenseIssuedBy = rec.driverLicenseIssuedBy
      if (rec.driverLicenseCategory) updates.driverLicenseCategory = rec.driverLicenseCategory
      if (rec.driverLicenseExpiry) updates.driverLicenseExpiry = rec.driverLicenseExpiry
      if (rec.driverLicenseIssuedDate) updates.driverLicenseIssuedDate = rec.driverLicenseIssuedDate
      if (rec.driverLicenseExperience !== null) updates.driverLicenseExperience = rec.driverLicenseExperience
      if (rec.driverLicenseSeries) updates.driverLicenseSeries = rec.driverLicenseSeries
      if (rec.driverLicenseNumber) updates.driverLicenseNumber = rec.driverLicenseNumber

      if (rec.tractorLicenseIssuedBy) updates.tractorLicenseIssuedBy = rec.tractorLicenseIssuedBy
      if (rec.tractorLicenseCategory) updates.tractorLicenseCategory = rec.tractorLicenseCategory
      if (rec.tractorLicenseExpiry) updates.tractorLicenseExpiry = rec.tractorLicenseExpiry
      if (rec.tractorLicenseIssuedDate) updates.tractorLicenseIssuedDate = rec.tractorLicenseIssuedDate
      if (rec.tractorLicenseExperience !== null) updates.tractorLicenseExperience = rec.tractorLicenseExperience
      if (rec.tractorLicenseSeries) updates.tractorLicenseSeries = rec.tractorLicenseSeries
      if (rec.tractorLicenseNumber) updates.tractorLicenseNumber = rec.tractorLicenseNumber

      if (rec.basicTrainingDateFrom) updates.basicTrainingDateFrom = rec.basicTrainingDateFrom
      if (rec.basicTrainingDateTo) updates.basicTrainingDateTo = rec.basicTrainingDateTo
      if (rec.basicTrainingPlace) updates.basicTrainingPlace = rec.basicTrainingPlace
      if (rec.basicTrainingCommander) updates.basicTrainingCommander = rec.basicTrainingCommander
      if (rec.basicTrainingNotes) updates.basicTrainingNotes = rec.basicTrainingNotes

      if (bloodTypeId) updates.bloodTypeId = bloodTypeId

      if (Object.keys(updates).length === 0) {
        skipped++
        continue
      }

      updates.updatedAt = sql`datetime('now')`

      try {
        db.update(personnel)
          .set(updates as Partial<typeof personnel.$inferInsert>)
          .where(eq(personnel.id, person.id))
          .run()
        updated++
      } catch (e) {
        errors.push(`Імпульс ІПН ${rec.ipn}: ${String(e)}`)
      }
    }

    db.insert(auditLog)
      .values({
        tableName: 'import',
        recordId: 0,
        action: 'import_impulse',
        newValues: JSON.stringify({ updated, skipped, errors: errors.length })
      })
      .run()

    db.run(sql`COMMIT`)

    return { success: true, updated, skipped, errors }
  } catch (e) {
    try {
      db.run(sql`ROLLBACK`)
    } catch {
      // Ignore rollback errors
    }
    return { success: false, updated: 0, skipped: 0, errors: [`Критична помилка: ${String(e)}`] }
  }
}

// ==================== IMPORT DATA.XLSX ====================

export function importData(records: ParsedDataRecord[]): DataImportResult {
  const db = getDatabase()
  const maps = buildLookupMaps()
  const errors: string[] = []
  let updated = 0
  let skipped = 0

  try {
    db.run(sql`BEGIN TRANSACTION`)

    for (const rec of records) {
      // Find personnel by IPN
      const person = db
        .select({ id: personnel.id })
        .from(personnel)
        .where(eq(personnel.ipn, rec.ipn))
        .get()

      if (!person) {
        skipped++
        continue
      }

      const bloodTypeId = fuzzyLookup(maps.bloodTypeNameToId, rec.bloodTypeName)

      const updates: Record<string, unknown> = {}

      // Only update non-null fields from Data.xlsx
      if (rec.nationality) updates.nationality = rec.nationality
      if (rec.citizenship) updates.citizenship = rec.citizenship
      if (rec.addressActual) updates.addressActual = rec.addressActual
      if (rec.addressRegistered) updates.addressRegistered = rec.addressRegistered
      if (rec.relativesInfo) updates.relativesInfo = rec.relativesInfo
      if (bloodTypeId) updates.bloodTypeId = bloodTypeId
      if (rec.militaryIdSeries) updates.militaryIdSeries = rec.militaryIdSeries
      if (rec.militaryIdNumber) updates.militaryIdNumber = rec.militaryIdNumber
      if (rec.passportSeries) updates.passportSeries = rec.passportSeries
      if (rec.passportNumber) updates.passportNumber = rec.passportNumber
      if (rec.passportIssuedBy) updates.passportIssuedBy = rec.passportIssuedBy
      if (rec.passportIssuedDate) updates.passportIssuedDate = rec.passportIssuedDate
      if (rec.ubdSeries) updates.ubdSeries = rec.ubdSeries
      if (rec.ubdNumber) updates.ubdNumber = rec.ubdNumber
      if (rec.ubdDate) updates.ubdDate = rec.ubdDate

      if (Object.keys(updates).length === 0) {
        skipped++
        continue
      }

      updates.updatedAt = sql`datetime('now')`

      try {
        db.update(personnel)
          .set(updates as Partial<typeof personnel.$inferInsert>)
          .where(eq(personnel.id, person.id))
          .run()
        updated++
      } catch (e) {
        errors.push(`Data.xlsx ІПН ${rec.ipn}: ${String(e)}`)
      }
    }

    db.insert(auditLog)
      .values({
        tableName: 'import',
        recordId: 0,
        action: 'import_data',
        newValues: JSON.stringify({ updated, skipped, errors: errors.length })
      })
      .run()

    db.run(sql`COMMIT`)

    return { success: true, updated, skipped, errors }
  } catch (e) {
    try {
      db.run(sql`ROLLBACK`)
    } catch {
      // Ignore rollback errors
    }
    return { success: false, updated: 0, skipped: 0, errors: [`Критична помилка: ${String(e)}`] }
  }
}
