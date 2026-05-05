import { dialog, BrowserWindow, app, shell } from 'electron'
import { promises as fsp } from 'fs'
import { join, extname, basename } from 'path'
import { getDatabase } from '../db/connection'
import { IPC } from '@shared/ipc-channels'
import { safeHandle } from './safe-handle'
import {
  ranks,
  statusTypes,
  subdivisions,
  bloodTypes,
  contractTypes,
  educationLevels,
  tccOffices,
  settings,
  personnel,
  positions,
  movements,
  statusHistory,
  attendance,
  orders,
  orderItems,
  leaveRecords,
  leaveTypes,
  leaveTypeAliases,
  documentTemplates,
  auditLog,
  dgvMarks,
  dgvMonthMeta
} from '../db/schema'
import { eq, and, like, or, asc, desc, sql, gte, lte } from 'drizzle-orm'
import { personnelCreateSchema, personnelUpdateSchema, positionCreateSchema, positionUpdateSchema, movementCreateSchema, statusHistoryCreateSchema, orderCreateSchema, leaveRecordCreateSchema } from '@shared/validators'
import { parseEjoosFile } from '../import/ejoos-parser'
import { parseDataFile } from '../import/data-parser'
import { importEjoos, importData, importImpulse } from '../import/import-service'
import { parseImpulseFile } from '../import/impulse-parser'
import { exportEjoos, exportCsv } from '../export/export-service'
import {
  seedDefaultTemplates,
  listTemplates,
  getTemplateTagsById,
  generateDocument,
  listGeneratedDocuments,
  openDocument,
  deleteGeneratedDocument
} from '../documents/document-service'

export function registerIpcHandlers(): void {
  // App version
  safeHandle(IPC.APP_VERSION, () => app.getVersion())

  // DB Health Check
  safeHandle(IPC.DB_HEALTH, () => {
    try {
      const db = getDatabase()
      const result = db.select().from(ranks).limit(1).all()
      return { ok: true, message: `БД працює. Звань: ${result.length > 0 ? 'є' : 'немає'}` }
    } catch (error) {
      return { ok: false, message: String(error) }
    }
  })

  // Settings
  safeHandle(IPC.SETTINGS_GET, (_event, key: string) => {
    const db = getDatabase()
    const result = db.select().from(settings).where(eq(settings.key, key)).get()
    return result?.value ?? null
  })

  safeHandle(IPC.SETTINGS_SET, (_event, key: string, value: string) => {
    const db = getDatabase()
    db.insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run()
    return { ok: true }
  })

  safeHandle(IPC.SETTINGS_GET_ALL, () => {
    const db = getDatabase()
    const rows = db.select().from(settings).all()
    const result: Record<string, string> = {}
    for (const row of rows) {
      result[row.key] = row.value
    }
    return result
  })

  // ==================== PERSONNEL CRUD ====================

  // Personnel list with filters
  safeHandle(
    IPC.PERSONNEL_LIST,
    (
      _event,
      filters?: {
        search?: string
        subdivision?: string
        statusCode?: string
        category?: string
        status?: string
      }
    ) => {
      const db = getDatabase()
      const conditions: ReturnType<typeof eq>[] = []

      // Default: only active
      const statusFilter = filters?.status || 'active'
      conditions.push(eq(personnel.status, statusFilter))

      if (filters?.subdivision) {
        conditions.push(eq(personnel.currentSubdivision, filters.subdivision))
      }

      if (filters?.statusCode) {
        conditions.push(eq(personnel.currentStatusCode, filters.statusCode))
      }

      if (filters?.search) {
        const pattern = `%${filters.search}%`
        conditions.push(
          or(
            like(personnel.fullName, pattern),
            like(personnel.ipn, pattern),
            like(personnel.callsign, pattern)
          )!
        )
      }

      // v0.8.8: для вкладки «Виключені» сортуємо за датою виключення
      // (новіші вгорі). v0.9.3: перейшли з desc(updatedAt) на desc(excludedAt) —
      // окреме поле, що НЕ змінюється при правці картки виключеного
      // (фото, телефон тощо). Решта запитів — штатне сортування з v0.8.4
      // (за currentPositionIdx).
      const primarySort = statusFilter === 'excluded'
        ? desc(personnel.excludedAt)
        : asc(personnel.currentPositionIdx)

      const result = db
        .select({
          id: personnel.id,
          ipn: personnel.ipn,
          fullName: personnel.fullName,
          rankName: ranks.name,
          rankCategory: ranks.category,
          callsign: personnel.callsign,
          currentPositionIdx: personnel.currentPositionIdx,
          currentStatusCode: personnel.currentStatusCode,
          currentSubdivision: personnel.currentSubdivision,
          phone: personnel.phone,
          status: personnel.status,
          excludedAt: personnel.excludedAt
        })
        .from(personnel)
        .leftJoin(ranks, eq(personnel.rankId, ranks.id))
        .where(and(...conditions))
        .orderBy(primarySort, asc(personnel.fullName))
        .all()

      // Enrich with position title if position index exists
      const positionRows = db.select().from(positions).all()
      const posMap = new Map(positionRows.map((p) => [p.positionIndex, p.title]))

      // Enrich with status name
      const statusRows = db.select().from(statusTypes).all()
      const statusMap = new Map(statusRows.map((s) => [s.code, s.name]))

      // Filter by rank category if needed
      let enriched = result.map((row) => ({
        ...row,
        positionTitle: row.currentPositionIdx ? (posMap.get(row.currentPositionIdx) ?? null) : null,
        statusName: row.currentStatusCode
          ? (statusMap.get(row.currentStatusCode) ?? null)
          : null
      }))

      if (filters?.category) {
        enriched = enriched.filter((r) => r.rankCategory === filters!.category)
      }

      return enriched
    }
  )

  // Personnel get by id
  safeHandle(IPC.PERSONNEL_GET, (_event, id: number) => {
    const db = getDatabase()

    const row = db
      .select()
      .from(personnel)
      .where(eq(personnel.id, id))
      .get()

    if (!row) return null

    // Enrich with rank name and position title
    let rankName: string | null = null
    let rankCategory: string | null = null
    if (row.rankId) {
      const rank = db.select().from(ranks).where(eq(ranks.id, row.rankId)).get()
      if (rank) {
        rankName = rank.name
        rankCategory = rank.category
      }
    }

    let positionTitle: string | null = null
    if (row.currentPositionIdx) {
      const pos = db
        .select()
        .from(positions)
        .where(eq(positions.positionIndex, row.currentPositionIdx))
        .get()
      if (pos) positionTitle = pos.title
    }

    let statusName: string | null = null
    let statusColorCode: string | null = null
    if (row.currentStatusCode) {
      const st = db
        .select()
        .from(statusTypes)
        .where(eq(statusTypes.code, row.currentStatusCode))
        .get()
      if (st) {
        statusName = st.name
        statusColorCode = st.colorCode ?? null
      }
    }

    let educationLevelName: string | null = null
    if (row.educationLevelId) {
      const el = db.select().from(educationLevels).where(eq(educationLevels.id, row.educationLevelId)).get()
      if (el) educationLevelName = el.name
    }

    let tccName: string | null = null
    if (row.tccId) {
      const tcc = db.select().from(tccOffices).where(eq(tccOffices.id, row.tccId)).get()
      if (tcc) tccName = tcc.name
    }

    return { ...row, rankName, rankCategory, positionTitle, statusName, statusColorCode, educationLevelName, tccName }
  })

  // Personnel create
  safeHandle(IPC.PERSONNEL_CREATE, (_event, data: Record<string, unknown>) => {
    const parsed = personnelCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { error: true, issues: parsed.error.issues }
    }

    const db = getDatabase()
    const input = parsed.data

    // Build fullName
    const fullName = [input.lastName, input.firstName, input.patronymic].filter(Boolean).join(' ')

    // Clean empty strings to null
    const cleaned: Record<string, unknown> = { fullName }
    for (const [key, value] of Object.entries(input)) {
      cleaned[key] = value === '' ? null : value
    }

    const result = db
      .insert(personnel)
      .values(cleaned as typeof personnel.$inferInsert)
      .returning()
      .get()

    // Audit log
    db.insert(auditLog)
      .values({
        tableName: 'personnel',
        recordId: result.id,
        action: 'create',
        newValues: JSON.stringify(cleaned)
      })
      .run()

    return result
  })

  // Personnel update
  safeHandle(
    IPC.PERSONNEL_UPDATE,
    (_event, id: number, data: Record<string, unknown>) => {
      const parsed = personnelUpdateSchema.safeParse(data)
      if (!parsed.success) {
        return { error: true, issues: parsed.error.issues }
      }

      const db = getDatabase()
      const input = parsed.data

      // Rebuild fullName if name fields changed
      const updates: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(input)) {
        updates[key] = value === '' ? null : value
      }

      if (input.lastName || input.firstName || input.patronymic) {
        const existing = db.select().from(personnel).where(eq(personnel.id, id)).get()
        if (existing) {
          const lastName = input.lastName || existing.lastName
          const firstName = input.firstName || existing.firstName
          const patronymic =
            input.patronymic !== undefined ? input.patronymic : existing.patronymic
          updates.fullName = [lastName, firstName, patronymic].filter(Boolean).join(' ')
        }
      }

      updates.updatedAt = sql`datetime('now')`

      // Get old values for audit
      const oldRow = db.select().from(personnel).where(eq(personnel.id, id)).get()

      // v0.9.3: підтримуємо інваріант excluded_at IS NOT NULL ⇔ status='excluded'.
      // Restore (status: excluded → active, напр. ExcludedPersonnel handleRestore) —
      // занулюємо excludedAt, інакше при повторному виключенні відображалась би
      // стара дата. Зворотний перехід (active → excluded) тут не обробляємо:
      // виключення йде через PERSONNEL_DELETE або MOVEMENTS_CREATE, які
      // ставлять excludedAt напряму.
      if (input.status === 'active' && oldRow?.status === 'excluded') {
        updates.excludedAt = null
      }

      db.update(personnel)
        .set(updates as Partial<typeof personnel.$inferInsert>)
        .where(eq(personnel.id, id))
        .run()

      // Audit log
      db.insert(auditLog)
        .values({
          tableName: 'personnel',
          recordId: id,
          action: 'update',
          oldValues: JSON.stringify(oldRow),
          newValues: JSON.stringify(updates)
        })
        .run()

      return db.select().from(personnel).where(eq(personnel.id, id)).get()
    }
  )

  // Personnel delete (soft — set status to 'excluded')
  safeHandle(IPC.PERSONNEL_DELETE, (_event, id: number) => {
    const db = getDatabase()

    // v0.9.3: окреме поле excludedAt для стабільного сортування виключених
    // (раніше desc(updatedAt), яке «дрейфувало» при правці картки).
    db.update(personnel)
      .set({
        status: 'excluded',
        excludedAt: sql`datetime('now')`,
        updatedAt: sql`datetime('now')`
      })
      .where(eq(personnel.id, id))
      .run()

    db.insert(auditLog)
      .values({
        tableName: 'personnel',
        recordId: id,
        action: 'soft_delete',
        newValues: JSON.stringify({ status: 'excluded' })
      })
      .run()

    return { ok: true }
  })

  // Personnel search (alias — uses same logic as list with search filter)
  safeHandle(IPC.PERSONNEL_SEARCH, (_event, query: string) => {
    const db = getDatabase()
    const q = (query ?? '').toLowerCase().trim()
    if (!q) return []

    // Тягнемо всіх активних і фільтруємо в JS — SQLite default-зборка без ICU
    // має ASCII-only LOWER()/LIKE, тож для української `LIKE '%бачурін%'` не
    // знайде 'Бачурін'. JS toLowerCase коректно обробляє кирилицю.
    // 140 рядків — мить навіть на найслабшій машині.
    const allActive = db
      .select({
        id: personnel.id,
        ipn: personnel.ipn,
        fullName: personnel.fullName,
        rankName: ranks.name,
        rankCategory: ranks.category,
        callsign: personnel.callsign,
        currentPositionIdx: personnel.currentPositionIdx,
        currentStatusCode: personnel.currentStatusCode,
        currentSubdivision: personnel.currentSubdivision,
        phone: personnel.phone,
        status: personnel.status
      })
      .from(personnel)
      .leftJoin(ranks, eq(personnel.rankId, ranks.id))
      .where(eq(personnel.status, 'active'))
      .orderBy(asc(personnel.currentPositionIdx), asc(personnel.fullName))
      .all()

    return allActive.filter((p) => {
      const fullName = (p.fullName ?? '').toLowerCase()
      const ipn = (p.ipn ?? '').toLowerCase()
      const callsign = (p.callsign ?? '').toLowerCase()
      return fullName.includes(q) || ipn.includes(q) || callsign.includes(q)
    })
  })

  // ==================== POSITIONS CRUD ====================

  // Positions list with filters + occupant enrichment
  safeHandle(
    IPC.POSITIONS_LIST,
    (
      _event,
      filters?: {
        subdivisionId?: number
        isActive?: boolean
        search?: string
        occupancy?: 'all' | 'occupied' | 'vacant' | 'deactivated'
      }
    ) => {
      const db = getDatabase()

      // Get all positions with subdivision info
      const allPos = db
        .select({
          id: positions.id,
          positionIndex: positions.positionIndex,
          subdivisionId: positions.subdivisionId,
          title: positions.title,
          detail: positions.detail,
          fullTitle: positions.fullTitle,
          rankRequired: positions.rankRequired,
          specialtyCode: positions.specialtyCode,
          tariffGrade: positions.tariffGrade,
          staffNumber: positions.staffNumber,
          isActive: positions.isActive,
          notes: positions.notes,
          subdivisionCode: subdivisions.code,
          subdivisionName: subdivisions.name
        })
        .from(positions)
        .leftJoin(subdivisions, eq(positions.subdivisionId, subdivisions.id))
        .orderBy(asc(positions.positionIndex))
        .all()

      // Get active personnel mapped to position indices
      const activePersonnel = db
        .select({
          id: personnel.id,
          fullName: personnel.fullName,
          rankName: ranks.name,
          currentPositionIdx: personnel.currentPositionIdx
        })
        .from(personnel)
        .leftJoin(ranks, eq(personnel.rankId, ranks.id))
        .where(eq(personnel.status, 'active'))
        .all()

      const personnelByPos = new Map<string, { id: number; fullName: string; rankName: string | null }>()
      for (const p of activePersonnel) {
        if (p.currentPositionIdx) {
          personnelByPos.set(p.currentPositionIdx, {
            id: p.id,
            fullName: p.fullName,
            rankName: p.rankName
          })
        }
      }

      // Enrich positions with occupant info
      let result = allPos.map((pos) => {
        const occupant = personnelByPos.get(pos.positionIndex)
        return {
          ...pos,
          occupantId: occupant?.id ?? null,
          occupantName: occupant?.fullName ?? null,
          occupantRank: occupant?.rankName ?? null
        }
      })

      // Apply filters
      if (filters?.subdivisionId) {
        result = result.filter((p) => p.subdivisionId === filters.subdivisionId)
      }

      if (filters?.search) {
        const q = filters.search.toLowerCase()
        result = result.filter(
          (p) =>
            p.positionIndex.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q) ||
            (p.occupantName && p.occupantName.toLowerCase().includes(q))
        )
      }

      if (filters?.occupancy === 'occupied') {
        result = result.filter((p) => p.isActive && p.occupantId !== null)
      } else if (filters?.occupancy === 'vacant') {
        result = result.filter((p) => p.isActive && p.occupantId === null)
      } else if (filters?.occupancy === 'deactivated') {
        result = result.filter((p) => !p.isActive)
      } else if (filters?.isActive !== undefined) {
        result = result.filter((p) => p.isActive === filters.isActive)
      }

      return result
    }
  )

  // Position get by id
  safeHandle(IPC.POSITIONS_GET, (_event, id: number) => {
    const db = getDatabase()

    const pos = db
      .select({
        id: positions.id,
        positionIndex: positions.positionIndex,
        subdivisionId: positions.subdivisionId,
        title: positions.title,
        detail: positions.detail,
        fullTitle: positions.fullTitle,
        rankRequired: positions.rankRequired,
        specialtyCode: positions.specialtyCode,
        tariffGrade: positions.tariffGrade,
        staffNumber: positions.staffNumber,
        isActive: positions.isActive,
        notes: positions.notes,
        subdivisionCode: subdivisions.code,
        subdivisionName: subdivisions.name
      })
      .from(positions)
      .leftJoin(subdivisions, eq(positions.subdivisionId, subdivisions.id))
      .where(eq(positions.id, id))
      .get()

    if (!pos) return null

    // Find occupant
    const occupant = db
      .select({
        id: personnel.id,
        fullName: personnel.fullName,
        rankName: ranks.name
      })
      .from(personnel)
      .leftJoin(ranks, eq(personnel.rankId, ranks.id))
      .where(and(eq(personnel.currentPositionIdx, pos.positionIndex), eq(personnel.status, 'active')))
      .get()

    return {
      ...pos,
      occupantId: occupant?.id ?? null,
      occupantName: occupant?.fullName ?? null,
      occupantRank: occupant?.rankName ?? null
    }
  })

  // Position create
  safeHandle(IPC.POSITIONS_CREATE, (_event, data: Record<string, unknown>) => {
    const parsed = positionCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { error: true, issues: parsed.error.issues }
    }

    const db = getDatabase()
    const input = parsed.data

    // Clean empty strings to null
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      cleaned[key] = value === '' ? null : value
    }

    const result = db
      .insert(positions)
      .values(cleaned as typeof positions.$inferInsert)
      .returning()
      .get()

    db.insert(auditLog)
      .values({
        tableName: 'positions',
        recordId: result.id,
        action: 'create',
        newValues: JSON.stringify(cleaned)
      })
      .run()

    return result
  })

  // Position update
  safeHandle(
    IPC.POSITIONS_UPDATE,
    (_event, id: number, data: Record<string, unknown>) => {
      const parsed = positionUpdateSchema.safeParse(data)
      if (!parsed.success) {
        return { error: true, issues: parsed.error.issues }
      }

      const db = getDatabase()
      const input = parsed.data

      const updates: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(input)) {
        updates[key] = value === '' ? null : value
      }

      const oldRow = db.select().from(positions).where(eq(positions.id, id)).get()

      db.update(positions)
        .set(updates as Partial<typeof positions.$inferInsert>)
        .where(eq(positions.id, id))
        .run()

      db.insert(auditLog)
        .values({
          tableName: 'positions',
          recordId: id,
          action: 'update',
          oldValues: JSON.stringify(oldRow),
          newValues: JSON.stringify(updates)
        })
        .run()

      return db.select().from(positions).where(eq(positions.id, id)).get()
    }
  )

  // ==================== SUBDIVISIONS TREE ====================

  safeHandle(IPC.SUBDIVISIONS_TREE, () => {
    const db = getDatabase()

    const allSubs = db.select().from(subdivisions).orderBy(asc(subdivisions.sortOrder)).all()
    const allPositions = db.select().from(positions).where(eq(positions.isActive, true)).all()
    const activePersonnel = db
      .select({
        id: personnel.id,
        currentSubdivision: personnel.currentSubdivision,
        currentPositionIdx: personnel.currentPositionIdx
      })
      .from(personnel)
      .where(eq(personnel.status, 'active'))
      .all()

    // Count positions per subdivision
    const posCountBySubId = new Map<number, number>()
    for (const p of allPositions) {
      posCountBySubId.set(p.subdivisionId, (posCountBySubId.get(p.subdivisionId) || 0) + 1)
    }

    // Count personnel per subdivision (by code)
    const persCountByCode = new Map<string, number>()
    for (const p of activePersonnel) {
      if (p.currentSubdivision) {
        persCountByCode.set(p.currentSubdivision, (persCountByCode.get(p.currentSubdivision) || 0) + 1)
      }
    }

    // Count occupied positions per subdivision
    const occupiedPosIdx = new Set(activePersonnel.map((p) => p.currentPositionIdx).filter(Boolean))
    const occupiedBySubId = new Map<number, number>()
    for (const p of allPositions) {
      if (occupiedPosIdx.has(p.positionIndex)) {
        occupiedBySubId.set(p.subdivisionId, (occupiedBySubId.get(p.subdivisionId) || 0) + 1)
      }
    }

    // Build tree nodes
    type TreeNode = typeof allSubs[0] & {
      children: TreeNode[]
      personnelCount: number
      positionCount: number
      vacantCount: number
    }

    const nodes: TreeNode[] = allSubs.map((s) => {
      const posCount = posCountBySubId.get(s.id) || 0
      const persCount = persCountByCode.get(s.code) || 0
      const occupiedCount = occupiedBySubId.get(s.id) || 0
      return {
        ...s,
        children: [],
        personnelCount: persCount,
        positionCount: posCount,
        vacantCount: posCount - occupiedCount
      }
    })

    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const roots: TreeNode[] = []

    for (const node of nodes) {
      if (node.parentId && nodeById.has(node.parentId)) {
        nodeById.get(node.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return roots
  })

  // Subdivision update
  safeHandle(
    IPC.SUBDIVISIONS_UPDATE,
    (_event, id: number, data: Record<string, unknown>) => {
      const db = getDatabase()

      const updates: Record<string, unknown> = {}
      if (data.name !== undefined) updates.name = data.name
      if (data.fullName !== undefined) updates.fullName = data.fullName
      if (data.isActive !== undefined) updates.isActive = data.isActive

      db.update(subdivisions)
        .set(updates as Partial<typeof subdivisions.$inferInsert>)
        .where(eq(subdivisions.id, id))
        .run()

      return db.select().from(subdivisions).where(eq(subdivisions.id, id)).get()
    }
  )

  // ==================== LOOKUPS ====================

  safeHandle(IPC.RANKS_LIST, () => {
    const db = getDatabase()
    return db.select().from(ranks).all()
  })

  safeHandle(IPC.STATUS_TYPES_LIST, () => {
    const db = getDatabase()
    return db.select().from(statusTypes).all()
  })

  safeHandle(IPC.SUBDIVISIONS_LIST, () => {
    const db = getDatabase()
    return db.select().from(subdivisions).all()
  })

  safeHandle(IPC.BLOOD_TYPES_LIST, () => {
    const db = getDatabase()
    return db.select().from(bloodTypes).all()
  })

  safeHandle(IPC.CONTRACT_TYPES_LIST, () => {
    const db = getDatabase()
    return db.select().from(contractTypes).all()
  })

  safeHandle(IPC.EDUCATION_LEVELS_LIST, () => {
    const db = getDatabase()
    return db.select().from(educationLevels).all()
  })

  // ==================== IMPORT ====================

  // Open file dialog
  safeHandle(
    IPC.OPEN_FILE_DIALOG,
    async (_event, filters?: { name: string; extensions: string[] }[]) => {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openFile'],
        filters: filters || [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }
  )

  // EJOOS preview (parse only, no DB writes)
  safeHandle(IPC.IMPORT_EJOOS_PREVIEW, (_event, filePath: string) => {
    try {
      return parseEjoosFile(filePath)
    } catch (error) {
      return { error: true, message: String(error) }
    }
  })

  // EJOOS confirm (parse + write to DB)
  safeHandle(IPC.IMPORT_EJOOS_CONFIRM, (_event, filePath: string) => {
    try {
      const parsed = parseEjoosFile(filePath)
      return importEjoos(parsed)
    } catch (error) {
      return {
        success: false,
        imported: { positions: 0, personnel: 0, movements: 0, statuses: 0 },
        errors: [String(error)]
      }
    }
  })

  // Data.xlsx import (parse + enrich personnel)
  safeHandle(IPC.IMPORT_DATA, (_event, filePath: string) => {
    try {
      // Get existing IPNs for matching
      const db = getDatabase()
      const existingPersonnel = db
        .select({ ipn: personnel.ipn })
        .from(personnel)
        .all()
      const existingIpns = new Set(existingPersonnel.map((p) => p.ipn))

      const parsed = parseDataFile(filePath, existingIpns)

      // If called with just filePath, return preview first
      return {
        preview: {
          records: parsed.records,
          errors: parsed.errors,
          stats: parsed.stats
        },
        // Also run import immediately
        result: importData(parsed.records)
      }
    } catch (error) {
      return {
        preview: null,
        result: { success: false, updated: 0, skipped: 0, errors: [String(error)] }
      }
    }
  })

  // Impulse Toolkit import
  safeHandle(IPC.IMPORT_IMPULSE, (_event, filePath: string) => {
    try {
      const parsed = parseImpulseFile(filePath)
      const result = importImpulse(parsed.records)
      return {
        preview: { total: parsed.total, parseErrors: parsed.errors },
        result
      }
    } catch (error) {
      return {
        preview: null,
        result: { success: false, updated: 0, skipped: 0, errors: [String(error)] }
      }
    }
  })

  // ==================== MOVEMENTS ====================

  // Movements list with filters
  safeHandle(
    IPC.MOVEMENTS_LIST,
    (
      _event,
      filters?: {
        search?: string
        subdivision?: string
        orderType?: string
        dateFrom?: string
        dateTo?: string
        isActive?: boolean
        personnelId?: number
      }
    ) => {
      const db = getDatabase()

      // Get all movements with personnel info
      const allMovements = db
        .select({
          id: movements.id,
          personnelId: movements.personnelId,
          orderIssuer: movements.orderIssuer,
          orderNumber: movements.orderNumber,
          orderDate: movements.orderDate,
          orderType: movements.orderType,
          positionIndex: movements.positionIndex,
          dailyOrderNumber: movements.dailyOrderNumber,
          dateFrom: movements.dateFrom,
          dateTo: movements.dateTo,
          previousPosition: movements.previousPosition,
          isActive: movements.isActive,
          notes: movements.notes,
          createdAt: movements.createdAt,
          fullName: personnel.fullName,
          rankName: ranks.name,
          ipn: personnel.ipn,
          currentSubdivision: personnel.currentSubdivision
        })
        .from(movements)
        .innerJoin(personnel, eq(movements.personnelId, personnel.id))
        .leftJoin(ranks, eq(personnel.rankId, ranks.id))
        .orderBy(sql`${movements.dateFrom} DESC`)
        .all()

      // Build position/subdivision maps for enrichment
      const positionRows = db.select().from(positions).all()
      const posMap = new Map(positionRows.map((p) => [p.positionIndex, p.title]))

      const subRows = db.select().from(subdivisions).all()
      const subCodeMap = new Map(subRows.map((s) => [s.code, s.name]))

      // Enrich and filter
      let result = allMovements.map((row) => ({
        ...row,
        positionTitle: row.positionIndex ? (posMap.get(row.positionIndex) ?? null) : null,
        previousPositionTitle: row.previousPosition ? (posMap.get(row.previousPosition) ?? null) : null,
        subdivisionCode: row.currentSubdivision ?? null,
        subdivisionName: row.currentSubdivision ? (subCodeMap.get(row.currentSubdivision) ?? null) : null
      }))

      // Apply filters
      if (filters?.personnelId) {
        result = result.filter((m) => m.personnelId === filters.personnelId)
      }

      if (filters?.orderType) {
        result = result.filter((m) => m.orderType === filters.orderType)
      }

      if (filters?.subdivision) {
        result = result.filter((m) => m.subdivisionCode === filters.subdivision)
      }

      if (filters?.dateFrom) {
        result = result.filter((m) => m.dateFrom >= filters.dateFrom!)
      }

      if (filters?.dateTo) {
        result = result.filter((m) => m.dateFrom <= filters.dateTo!)
      }

      if (filters?.isActive !== undefined) {
        result = result.filter((m) => m.isActive === filters.isActive)
      }

      if (filters?.search) {
        const q = filters.search.toLowerCase()
        result = result.filter(
          (m) =>
            m.fullName.toLowerCase().includes(q) ||
            m.ipn.includes(q) ||
            (m.orderNumber && m.orderNumber.toLowerCase().includes(q)) ||
            (m.positionTitle && m.positionTitle.toLowerCase().includes(q))
        )
      }

      return result
    }
  )

  // Movements create
  safeHandle(IPC.MOVEMENTS_CREATE, (_event, data: Record<string, unknown>) => {
    console.log('[ipc] MOVEMENTS_CREATE data:', JSON.stringify(data))

    const parsed = movementCreateSchema.safeParse(data)
    if (!parsed.success) {
      console.log('[ipc] MOVEMENTS_CREATE validation failed:', parsed.error.issues)
      return { error: true, issues: parsed.error.issues }
    }

    try {
      const db = getDatabase()
      const input = parsed.data

      // Clean empty strings to null
      const cleaned: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(input)) {
        cleaned[key] = value === '' ? null : value
      }

      // Transaction: deactivate old movements → insert new → update personnel
      const result = db.transaction(() => {
        // Deactivate previous active movements for this person
        db.update(movements)
          .set({ isActive: false })
          .where(and(eq(movements.personnelId, input.personnelId), eq(movements.isActive, true)))
          .run()

        // Insert new movement
        const newMovement = db
          .insert(movements)
          .values(cleaned as typeof movements.$inferInsert)
          .returning()
          .get()

        // Update personnel current position and subdivision
        const personnelUpdates: Record<string, unknown> = {
          updatedAt: sql`datetime('now')`
        }

        // v0.9.7: 'Відновлення' — повернення з виключення. Status має змінитися
        // незалежно від наявності positionIndex (бо сценарій може бути «повернути
        // в розпорядження» БЕЗ конкретної посади). Виносимо тут, а гілки нижче
        // лише доуточнюють current_position_idx/Subdivision.
        if (input.orderType === 'Відновлення') {
          personnelUpdates.status = 'active'
          personnelUpdates.excludedAt = null
        }

        if (input.positionIndex) {
          personnelUpdates.currentPositionIdx = input.positionIndex

          // Find subdivision for this position
          const pos = db
            .select()
            .from(positions)
            .where(eq(positions.positionIndex, input.positionIndex))
            .get()
          if (pos) {
            const sub = db
              .select()
              .from(subdivisions)
              .where(eq(subdivisions.id, pos.subdivisionId))
              .get()
            if (sub) {
              personnelUpdates.currentSubdivision = sub.code
            }
          }
        } else if (input.orderType.startsWith('В розпорядження')) {
          // No specific position — mark as "розпорядження"
          personnelUpdates.currentPositionIdx = 'розпоряджен'
          personnelUpdates.currentSubdivision = 'розпорядження'
        } else if (input.orderType === 'Виключення') {
          // v0.8.7: виключення через wizard — `status='excluded'` достатньо
          // (консистентно з PERSONNEL_DELETE soft-delete).
          //  - Реєстр / Канбан / Орг-структура: фільтрують status='active' → не покажуть
          //  - POSITIONS_LIST: personnelByPos з фільтром status='active' →
          //    посада автоматично йде як вакантна
          //  - ExcludedPersonnel: фільтрує status='excluded' AND subdivision='Г-3'
          //    → знаходить виключеного (тому НЕ обнуляємо currentSubdivision)
          //  - currentPositionIdx/Subdivision/StatusCode залишаємо як «останній
          //    відомий стан» — для аудиту та довідки на картці виключеного
          // v0.9.3: проставляємо excludedAt для стабільного сортування у вкладці.
          personnelUpdates.status = 'excluded'
          personnelUpdates.excludedAt = sql`datetime('now')`
        } else if (input.orderType === 'Відновлення') {
          // v0.9.7: positionIndex не вказано → повертаємо в роту без штатної
          // посади (як після «В розпорядження»). Status='active' уже виставлено
          // вище, тут лише налаштовуємо позицію/підрозділ.
          personnelUpdates.currentPositionIdx = 'розпоряджен'
          personnelUpdates.currentSubdivision = 'розпорядження'
        }

        db.update(personnel)
          .set(personnelUpdates as Partial<typeof personnel.$inferInsert>)
          .where(eq(personnel.id, input.personnelId))
          .run()

        // Audit log
        db.insert(auditLog)
          .values({
            tableName: 'movements',
            recordId: newMovement.id,
            action: 'create',
            newValues: JSON.stringify(cleaned)
          })
          .run()

        return newMovement
      })

      console.log('[ipc] MOVEMENTS_CREATE success:', result.id)
      return result
    } catch (err) {
      console.error('[ipc] MOVEMENTS_CREATE error:', err)
      return { error: true, issues: [{ message: String(err) }] }
    }
  })

  // Movements get by person
  safeHandle(IPC.MOVEMENTS_GET_BY_PERSON, (_event, personnelId: number) => {
    const db = getDatabase()

    const rows = db
      .select()
      .from(movements)
      .where(eq(movements.personnelId, personnelId))
      .orderBy(sql`${movements.dateFrom} DESC`)
      .all()

    // Enrich with position titles
    const positionRows = db.select().from(positions).all()
    const posMap = new Map(positionRows.map((p) => [p.positionIndex, p.title]))

    return rows.map((row) => ({
      ...row,
      positionTitle: row.positionIndex ? (posMap.get(row.positionIndex) ?? null) : null,
      previousPositionTitle: row.previousPosition ? (posMap.get(row.previousPosition) ?? null) : null
    }))
  })

  // ==================== STATUS HISTORY ====================

  // Status history list with filters
  safeHandle(
    IPC.STATUS_HISTORY_LIST,
    (
      _event,
      filters?: {
        search?: string
        statusCode?: string
        groupName?: string
        subdivision?: string
        dateFrom?: string
        dateTo?: string
        personnelId?: number
      }
    ) => {
      const db = getDatabase()

      // Build WHERE conditions
      const conditions: ReturnType<typeof eq>[] = []
      if (filters?.subdivision) {
        conditions.push(eq(personnel.currentSubdivision, filters.subdivision))
      }

      // Get all status history with personnel info
      const allRows = db
        .select({
          id: statusHistory.id,
          personnelId: statusHistory.personnelId,
          statusCode: statusHistory.statusCode,
          presenceGroup: statusHistory.presenceGroup,
          dateFrom: statusHistory.dateFrom,
          dateTo: statusHistory.dateTo,
          comment: statusHistory.comment,
          isActive: statusHistory.isActive,
          isLast: statusHistory.isLast,
          createdAt: statusHistory.createdAt,
          fullName: personnel.fullName,
          rankName: ranks.name,
          ipn: personnel.ipn
        })
        .from(statusHistory)
        .innerJoin(personnel, eq(statusHistory.personnelId, personnel.id))
        .leftJoin(ranks, eq(personnel.rankId, ranks.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sql`${statusHistory.dateFrom} DESC`)
        .all()

      // Build status_types lookup
      const stRows = db.select().from(statusTypes).all()
      const stMap = new Map(stRows.map((s) => [s.code, s]))

      // Enrich with status name/color/group
      let result = allRows.map((row) => {
        const st = stMap.get(row.statusCode)
        return {
          ...row,
          statusName: st?.name ?? row.statusCode,
          statusColor: st?.colorCode ?? null,
          groupName: st?.groupName ?? ''
        }
      })

      // Apply filters
      if (filters?.personnelId) {
        result = result.filter((r) => r.personnelId === filters.personnelId)
      }

      if (filters?.statusCode) {
        result = result.filter((r) => r.statusCode === filters.statusCode)
      }

      if (filters?.groupName) {
        result = result.filter((r) => r.groupName === filters.groupName)
      }

      if (filters?.dateFrom) {
        result = result.filter((r) => r.dateFrom >= filters.dateFrom!)
      }

      if (filters?.dateTo) {
        result = result.filter((r) => r.dateFrom <= filters.dateTo!)
      }

      if (filters?.search) {
        const q = filters.search.toLowerCase()
        result = result.filter(
          (r) =>
            r.fullName.toLowerCase().includes(q) ||
            r.ipn.includes(q) ||
            r.statusName.toLowerCase().includes(q) ||
            (r.comment && r.comment.toLowerCase().includes(q))
        )
      }

      return result
    }
  )

  // Status history create
  safeHandle(IPC.STATUS_HISTORY_CREATE, (_event, data: Record<string, unknown>) => {
    console.log('[ipc] STATUS_HISTORY_CREATE data:', JSON.stringify(data))

    const parsed = statusHistoryCreateSchema.safeParse(data)
    if (!parsed.success) {
      console.log('[ipc] STATUS_HISTORY_CREATE validation failed:', parsed.error.issues)
      return { error: true, issues: parsed.error.issues }
    }

    try {
      const db = getDatabase()
      const input = parsed.data

      // v0.8.5: статуси можна призначати тільки тим, хто перебуває в штаті
      // (currentSubdivision='Г-3'). Виключені та ті, хто в розпорядженні —
      // не отримують жодних статусів (РВ/РЗ/ВП тощо), бо фактично не
      // виконують службових обов'язків у роті.
      // v0.10.x: для розпорядженни жорстку заборону замінено на whitelist
      // через `statusTypes.onSupply`. Бойові коди (РВ/РЗ/РШ/ППД/АДП/БЗВП —
      // onSupply=true) і далі недоступні, бо вони фіксують перебування на
      // бойовому забезпеченні підрозділу. Термінальні (СЗЧ/200/ЗБ/ПОЛОН) і
      // решта (ШП/ВД/ВП/ВПП тощо) — навпаки актуальні саме для розпорядженни.
      const target = db
        .select({
          status: personnel.status,
          currentSubdivision: personnel.currentSubdivision
        })
        .from(personnel)
        .where(eq(personnel.id, input.personnelId))
        .get()

      if (!target) {
        return { error: true, issues: [{ message: 'Військовослужбовця не знайдено' }] }
      }
      if (target.status === 'excluded') {
        return {
          error: true,
          issues: [{ message: 'Не можна призначити статус виключеному військовослужбовцю' }]
        }
      }
      if (target.currentSubdivision === 'розпорядження') {
        const statusType = db
          .select({ onSupply: statusTypes.onSupply })
          .from(statusTypes)
          .where(eq(statusTypes.code, input.statusCode))
          .get()
        if (statusType?.onSupply) {
          return {
            error: true,
            issues: [
              { message: 'Бойові статуси (РВ/РЗ/РШ/ППД/АДП/БЗВП) можна призначати лише на штатній посаді — спочатку поверніть особу на посаду через переміщення' }
            ]
          }
        }
      }

      // Clean empty strings to null
      const cleaned: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(input)) {
        cleaned[key] = value === '' ? null : value
      }

      // Transaction: set isLast=false on old → insert new isLast=true → update personnel.currentStatusCode
      const result = db.transaction(() => {
        // Set isLast=false on previous "last" status records for this person
        db.update(statusHistory)
          .set({ isLast: false })
          .where(and(eq(statusHistory.personnelId, input.personnelId), eq(statusHistory.isLast, true)))
          .run()

        // Insert new status history record
        const newRecord = db
          .insert(statusHistory)
          .values(cleaned as typeof statusHistory.$inferInsert)
          .returning()
          .get()

        // Update personnel.currentStatusCode
        db.update(personnel)
          .set({
            currentStatusCode: input.statusCode,
            updatedAt: sql`datetime('now')`
          })
          .where(eq(personnel.id, input.personnelId))
          .run()

        // Audit log
        db.insert(auditLog)
          .values({
            tableName: 'status_history',
            recordId: newRecord.id,
            action: 'create',
            newValues: JSON.stringify(cleaned)
          })
          .run()

        return newRecord
      })

      console.log('[ipc] STATUS_HISTORY_CREATE success:', result.id)
      return result
    } catch (err) {
      console.error('[ipc] STATUS_HISTORY_CREATE error:', err)
      return { error: true, issues: [{ message: String(err) }] }
    }
  })

  // Status history get by person
  safeHandle(IPC.STATUS_HISTORY_GET_BY_PERSON, (_event, personnelId: number) => {
    const db = getDatabase()

    const rows = db
      .select()
      .from(statusHistory)
      .where(eq(statusHistory.personnelId, personnelId))
      .orderBy(sql`${statusHistory.dateFrom} DESC`)
      .all()

    // Enrich with status name/color/group
    const stRows = db.select().from(statusTypes).all()
    const stMap = new Map(stRows.map((s) => [s.code, s]))

    return rows.map((row) => {
      const st = stMap.get(row.statusCode)
      return {
        ...row,
        statusName: st?.name ?? row.statusCode,
        statusColor: st?.colorCode ?? null,
        groupName: st?.groupName ?? ''
      }
    })
  })

  safeHandle(IPC.STATUS_HISTORY_DELETE, (_event, id: number) => {
    try {
      const db = getDatabase()
      const row = db.select().from(statusHistory).where(eq(statusHistory.id, id)).get()
      if (!row) return { success: false, error: 'Запис не знайдено' }

      db.delete(statusHistory).where(eq(statusHistory.id, id)).run()

      // If deleted was isLast, promote the next most recent record
      if (row.isLast) {
        const latest = db
          .select()
          .from(statusHistory)
          .where(eq(statusHistory.personnelId, row.personnelId))
          .orderBy(sql`${statusHistory.dateFrom} DESC`)
          .limit(1)
          .get()

        if (latest) {
          db.update(statusHistory)
            .set({ isLast: true })
            .where(eq(statusHistory.id, latest.id))
            .run()
          db.update(personnel)
            .set({ currentStatusCode: latest.statusCode })
            .where(eq(personnel.id, row.personnelId))
            .run()
        } else {
          // No more statuses — clear currentStatusCode
          db.update(personnel)
            .set({ currentStatusCode: null })
            .where(eq(personnel.id, row.personnelId))
            .run()
        }
      }

      return { success: true }
    } catch (err) {
      console.error('[ipc] STATUS_HISTORY_DELETE error:', err)
      return { success: false, error: String(err) }
    }
  })

  // ==================== ATTENDANCE ====================

  // Локальна сьогоднішня дата у форматі YYYY-MM-DD (без UTC-зсуву)
  const todayLocalIso = (): string => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // Якщо date === today — синхронізувати personnel.currentStatusCode з табелю.
  // Минулі/майбутні дати не зачіпають поточний статус ОС.
  const syncCurrentStatusIfToday = (
    db: ReturnType<typeof getDatabase>,
    personnelId: number,
    date: string,
    statusCode: string
  ): void => {
    if (date !== todayLocalIso()) return
    db.update(personnel)
      .set({ currentStatusCode: statusCode, updatedAt: sql`(strftime('%Y-%m-%d %H:%M:%f','now'))` })
      .where(eq(personnel.id, personnelId))
      .run()
  }

  // Get month attendance grid
  safeHandle(
    IPC.ATTENDANCE_GET_MONTH,
    (_event, year: number, month: number, subdivisionCode?: string) => {
      const db = getDatabase()

      // Build conditions for active personnel
      const conditions: ReturnType<typeof eq>[] = [eq(personnel.status, 'active')]
      if (subdivisionCode) {
        conditions.push(eq(personnel.currentSubdivision, subdivisionCode))
      }

      // Get active personnel with rank
      const personnelRows = db
        .select({
          id: personnel.id,
          fullName: personnel.fullName,
          rankName: ranks.name,
          currentSubdivision: personnel.currentSubdivision
        })
        .from(personnel)
        .leftJoin(ranks, eq(personnel.rankId, ranks.id))
        .where(and(...conditions))
        .orderBy(asc(personnel.currentPositionIdx), asc(personnel.fullName))
        .all()

      // Date range for the month
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

      // Get attendance records for the month
      const attendanceRows = db
        .select()
        .from(attendance)
        .where(
          and(
            sql`${attendance.date} >= ${firstDay}`,
            sql`${attendance.date} <= ${lastDay}`
          )
        )
        .all()

      // Build lookup: personnelId → { date → statusCode }
      const attMap = new Map<number, Record<string, string>>()
      for (const a of attendanceRows) {
        if (!attMap.has(a.personnelId)) {
          attMap.set(a.personnelId, {})
        }
        attMap.get(a.personnelId)![a.date] = a.statusCode
      }

      // Build rows
      const rows = personnelRows.map((p) => ({
        personnelId: p.id,
        fullName: p.fullName,
        rankName: p.rankName,
        subdivisionCode: p.currentSubdivision,
        days: attMap.get(p.id) ?? {}
      }))

      return { year, month, rows }
    }
  )

  // Set single day attendance
  safeHandle(
    IPC.ATTENDANCE_SET_DAY,
    (_event, personnelId: number, date: string, statusCode: string) => {
      const db = getDatabase()

      // Get presenceGroup from status_types
      const st = db
        .select({ groupName: statusTypes.groupName })
        .from(statusTypes)
        .where(eq(statusTypes.code, statusCode))
        .get()

      const presenceGroup = st?.groupName ?? null

      // Check if record exists
      const existing = db
        .select()
        .from(attendance)
        .where(and(eq(attendance.personnelId, personnelId), eq(attendance.date, date)))
        .get()

      if (existing) {
        db.update(attendance)
          .set({ statusCode, presenceGroup })
          .where(eq(attendance.id, existing.id))
          .run()
      } else {
        db.insert(attendance)
          .values({ personnelId, date, statusCode, presenceGroup })
          .run()
      }

      // Sync personnel.currentStatusCode якщо це сьогоднішня дата
      syncCurrentStatusIfToday(db, personnelId, date, statusCode)

      // Audit log
      db.insert(auditLog)
        .values({
          tableName: 'attendance',
          recordId: personnelId,
          action: existing ? 'update' : 'create',
          newValues: JSON.stringify({ personnelId, date, statusCode, presenceGroup })
        })
        .run()

      return { ok: true }
    }
  )

  // Clear single day attendance — DELETE рядка
  safeHandle(
    IPC.ATTENDANCE_CLEAR_DAY,
    (_event, personnelId: number, date: string) => {
      const db = getDatabase()

      const existing = db
        .select({ id: attendance.id, statusCode: attendance.statusCode })
        .from(attendance)
        .where(and(eq(attendance.personnelId, personnelId), eq(attendance.date, date)))
        .get()

      if (!existing) {
        return { ok: true, deleted: 0 }
      }

      db.delete(attendance).where(eq(attendance.id, existing.id)).run()

      // Якщо чистили сьогоднішню дату — currentStatusCode особи теж скидаємо.
      // Інваріант: currentStatusCode має відображати поточний (на сьогодні) стан;
      // якщо запису більше нема — стан не визначено.
      if (date === todayLocalIso()) {
        db.update(personnel)
          .set({
            currentStatusCode: null,
            updatedAt: sql`(strftime('%Y-%m-%d %H:%M:%f','now'))`
          })
          .where(eq(personnel.id, personnelId))
          .run()
      }

      // Audit log
      db.insert(auditLog)
        .values({
          tableName: 'attendance',
          recordId: personnelId,
          action: 'delete',
          oldValues: JSON.stringify({ personnelId, date, statusCode: existing.statusCode })
        })
        .run()

      return { ok: true, deleted: 1 }
    }
  )

  // Bulk-clear: видалити attendance-рядки для діапазону клітинок одною транзакцією.
  // Симетрично до ATTENDANCE_BULK_SET. Один audit-запис на batch.
  safeHandle(
    IPC.ATTENDANCE_BULK_CLEAR,
    (
      _event,
      items: Array<{ personnelId: number; date: string }>
    ) => {
      const db = getDatabase()

      if (items.length === 0) return { ok: true, deleted: 0 }

      const today = todayLocalIso()

      const result = db.transaction(() => {
        let deleted = 0
        // Якщо за один bulk зачищають кілька рядків today для тієї самої особи —
        // currentStatusCode достатньо скинути один раз. Збираємо унікальні pid.
        const todayPids = new Set<number>()

        for (const it of items) {
          const existing = db
            .select({ id: attendance.id })
            .from(attendance)
            .where(
              and(
                eq(attendance.personnelId, it.personnelId),
                eq(attendance.date, it.date)
              )
            )
            .get()
          if (existing) {
            db.delete(attendance).where(eq(attendance.id, existing.id)).run()
            deleted++
          }
          if (it.date === today) {
            todayPids.add(it.personnelId)
          }
        }

        // Скидаємо currentStatusCode для тих, кому очистили today
        for (const pid of todayPids) {
          db.update(personnel)
            .set({
              currentStatusCode: null,
              updatedAt: sql`(strftime('%Y-%m-%d %H:%M:%f','now'))`
            })
            .where(eq(personnel.id, pid))
            .run()
        }

        return { deleted, syncedCurrentStatus: todayPids.size }
      })

      // Audit log — один запис на batch
      db.insert(auditLog)
        .values({
          tableName: 'attendance',
          recordId: 0,
          action: 'bulk-clear',
          oldValues: JSON.stringify({
            count: result.deleted,
            requested: items.length,
            sample: items.slice(0, 3)
          })
        })
        .run()

      return { ok: true, deleted: result.deleted }
    }
  )

  // Snapshot: fill attendance for all active personnel from their currentStatusCode
  safeHandle(IPC.ATTENDANCE_SNAPSHOT, (_event, date: string) => {
    const db = getDatabase()

    // Get all status_types for presenceGroup mapping
    const stRows = db.select().from(statusTypes).all()
    const stMap = new Map(stRows.map((s) => [s.code, s.groupName]))

    const result = db.transaction(() => {
      // Get all active personnel with currentStatusCode
      const activePersonnel = db
        .select({
          id: personnel.id,
          currentStatusCode: personnel.currentStatusCode
        })
        .from(personnel)
        .where(eq(personnel.status, 'active'))
        .all()

      let created = 0

      for (const p of activePersonnel) {
        if (!p.currentStatusCode) continue

        // Check if already exists — skip if so (INSERT OR IGNORE logic)
        const existing = db
          .select({ id: attendance.id })
          .from(attendance)
          .where(and(eq(attendance.personnelId, p.id), eq(attendance.date, date)))
          .get()

        if (existing) continue

        const presenceGroup = stMap.get(p.currentStatusCode) ?? null

        db.insert(attendance)
          .values({
            personnelId: p.id,
            date,
            statusCode: p.currentStatusCode,
            presenceGroup
          })
          .run()

        created++
      }

      return { created }
    })

    // Audit log
    db.insert(auditLog)
      .values({
        tableName: 'attendance',
        recordId: 0,
        action: 'snapshot',
        newValues: JSON.stringify({ date, created: result.created })
      })
      .run()

    return result
  })

  // Bulk-set many attendance cells in one transaction (для drag-fill, paint-mode)
  safeHandle(
    IPC.ATTENDANCE_BULK_SET,
    (
      _event,
      items: Array<{ personnelId: number; date: string; statusCode: string }>
    ) => {
      const db = getDatabase()

      if (items.length === 0) return { ok: true, written: 0 }

      // Pre-fetch presenceGroup для всіх унікальних statusCode
      const uniqueCodes = Array.from(new Set(items.map((i) => i.statusCode)))
      const stRows = db
        .select({ code: statusTypes.code, groupName: statusTypes.groupName })
        .from(statusTypes)
        .all()
      const stMap = new Map(stRows.map((s) => [s.code, s.groupName]))

      // Validate: всі statusCode мають існувати
      const unknown = uniqueCodes.filter((c) => !stMap.has(c))
      if (unknown.length > 0) {
        throw new Error(`Невідомі статуси: ${unknown.join(', ')}`)
      }

      const today = todayLocalIso()

      const result = db.transaction(() => {
        let written = 0
        // Збираємо унікальні (personnelId, statusCode) пари для today —
        // якщо користувач за один drag поставив кілька днів сьогодні,
        // currentStatusCode достатньо оновити останнім значенням (з останнього item на today)
        const todaySync = new Map<number, string>()

        for (const it of items) {
          const presenceGroup = stMap.get(it.statusCode) ?? null
          const existing = db
            .select({ id: attendance.id })
            .from(attendance)
            .where(
              and(
                eq(attendance.personnelId, it.personnelId),
                eq(attendance.date, it.date)
              )
            )
            .get()
          if (existing) {
            db.update(attendance)
              .set({ statusCode: it.statusCode, presenceGroup })
              .where(eq(attendance.id, existing.id))
              .run()
          } else {
            db.insert(attendance)
              .values({
                personnelId: it.personnelId,
                date: it.date,
                statusCode: it.statusCode,
                presenceGroup
              })
              .run()
          }
          written++
          if (it.date === today) {
            todaySync.set(it.personnelId, it.statusCode)
          }
        }

        // Sync personnel.currentStatusCode для тих, кому сьогодні поставили
        for (const [pid, code] of todaySync) {
          db.update(personnel)
            .set({
              currentStatusCode: code,
              updatedAt: sql`(strftime('%Y-%m-%d %H:%M:%f','now'))`
            })
            .where(eq(personnel.id, pid))
            .run()
        }

        return { written, syncedCurrentStatus: todaySync.size }
      })

      // Audit log — один запис на batch
      db.insert(auditLog)
        .values({
          tableName: 'attendance',
          recordId: 0,
          action: 'bulk-set',
          newValues: JSON.stringify({
            count: result.written,
            uniqueCodes,
            sample: items.slice(0, 3)
          })
        })
        .run()

      return { ok: true, written: result.written }
    }
  )

  // Copy attendance from one date to another (within Г-3 active personnel)
  safeHandle(
    IPC.ATTENDANCE_COPY_DAY,
    (_event, srcDate: string, dstDate: string, overwrite: boolean) => {
      const db = getDatabase()

      const result = db.transaction(() => {
        // Source: позначки за srcDate тільки для active Г-3 ОС
        const srcRows = db
          .select({
            personnelId: attendance.personnelId,
            statusCode: attendance.statusCode,
            presenceGroup: attendance.presenceGroup
          })
          .from(attendance)
          .innerJoin(personnel, eq(attendance.personnelId, personnel.id))
          .where(
            and(
              eq(attendance.date, srcDate),
              eq(personnel.status, 'active'),
              eq(personnel.currentSubdivision, 'Г-3')
            )
          )
          .all()

        if (srcRows.length === 0) {
          return { copied: 0, skipped: 0, srcCount: 0 }
        }

        // Destination: існуючі позначки за dstDate (для рішення overwrite/skip)
        const dstRows = db
          .select({
            id: attendance.id,
            personnelId: attendance.personnelId
          })
          .from(attendance)
          .where(eq(attendance.date, dstDate))
          .all()
        const dstByPerson = new Map(dstRows.map((r) => [r.personnelId, r.id]))

        let copied = 0
        let skipped = 0
        const isDstToday = dstDate === todayLocalIso()
        const todaySync = new Map<number, string>()

        for (const src of srcRows) {
          const existingId = dstByPerson.get(src.personnelId)
          if (existingId !== undefined) {
            if (!overwrite) {
              skipped++
              continue
            }
            db.update(attendance)
              .set({ statusCode: src.statusCode, presenceGroup: src.presenceGroup })
              .where(eq(attendance.id, existingId))
              .run()
          } else {
            db.insert(attendance)
              .values({
                personnelId: src.personnelId,
                date: dstDate,
                statusCode: src.statusCode,
                presenceGroup: src.presenceGroup
              })
              .run()
          }
          copied++
          if (isDstToday) todaySync.set(src.personnelId, src.statusCode)
        }

        // Sync personnel.currentStatusCode якщо копіюємо саме НА сьогодні
        for (const [pid, code] of todaySync) {
          db.update(personnel)
            .set({
              currentStatusCode: code,
              updatedAt: sql`(strftime('%Y-%m-%d %H:%M:%f','now'))`
            })
            .where(eq(personnel.id, pid))
            .run()
        }

        return { copied, skipped, srcCount: srcRows.length, syncedCurrentStatus: todaySync.size }
      })

      // Audit log — один запис на всю операцію
      db.insert(auditLog)
        .values({
          tableName: 'attendance',
          recordId: 0,
          action: 'copy-day',
          newValues: JSON.stringify({
            srcDate,
            dstDate,
            overwrite,
            ...result
          })
        })
        .run()

      return { ok: true, ...result }
    }
  )

  // ==================== EXPORT ====================

  safeHandle(IPC.EXPORT_EJOOS, async () => {
    try {
      return await exportEjoos()
    } catch (err) {
      console.error('[ipc] EXPORT_EJOOS error:', err)
      return { success: false, filePath: '', stats: { positionsCount: 0, personnelCount: 0, excludedCount: 0, movementsCount: 0, statusesCount: 0 }, errors: [String(err)] }
    }
  })

  safeHandle(IPC.EXPORT_CSV, async () => {
    try {
      return await exportCsv()
    } catch (err) {
      console.error('[ipc] EXPORT_CSV error:', err)
      return { success: false, filePath: '', recordsCount: 0, errors: [String(err)] }
    }
  })

  // ==================== DOCUMENTS ====================

  // Seed default templates on first run
  try {
    seedDefaultTemplates()
  } catch (err) {
    console.error('[ipc] seedDefaultTemplates error:', err)
  }

  safeHandle(IPC.TEMPLATES_LIST, () => {
    try {
      return listTemplates()
    } catch (err) {
      console.error('[ipc] TEMPLATES_LIST error:', err)
      return []
    }
  })

  safeHandle(IPC.TEMPLATES_GET_TAGS, (_event, templateId: number) => {
    try {
      return getTemplateTagsById(templateId)
    } catch (err) {
      console.error('[ipc] TEMPLATES_GET_TAGS error:', err)
      return []
    }
  })

  safeHandle(IPC.DOCUMENTS_GENERATE, (_event, request) => {
    try {
      return generateDocument(request)
    } catch (err) {
      console.error('[ipc] DOCUMENTS_GENERATE error:', err)
      return { error: true, message: String(err) }
    }
  })

  safeHandle(IPC.DOCUMENTS_LIST, (_event, filters?) => {
    try {
      return listGeneratedDocuments(filters)
    } catch (err) {
      console.error('[ipc] DOCUMENTS_LIST error:', err)
      return []
    }
  })

  safeHandle(IPC.DOCUMENTS_OPEN, async (_event, filePath: string) => {
    try {
      await openDocument(filePath)
      return { success: true }
    } catch (err) {
      console.error('[ipc] DOCUMENTS_OPEN error:', err)
      return { success: false, message: String(err) }
    }
  })

  safeHandle(IPC.DOCUMENTS_DELETE, (_event, id: number) => {
    try {
      return deleteGeneratedDocument(id)
    } catch (err) {
      console.error('[ipc] DOCUMENTS_DELETE error:', err)
      return { success: false }
    }
  })

  // ==================== ORDERS ====================

  safeHandle(IPC.ORDERS_LIST, (_event, filters?: {
    search?: string
    orderType?: string
    dateFrom?: string
    dateTo?: string
  }) => {
    try {
      const db = getDatabase()
      const conditions = [sql`1=1`]

      if (filters?.orderType) {
        conditions.push(eq(orders.orderType, filters.orderType))
      }
      if (filters?.dateFrom) {
        conditions.push(gte(orders.orderDate, filters.dateFrom))
      }
      if (filters?.dateTo) {
        conditions.push(lte(orders.orderDate, filters.dateTo))
      }

      const rows = db
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(desc(orders.orderDate))
        .all()

      // Filter by search text in JS (search across multiple fields)
      let result = rows
      if (filters?.search) {
        const q = filters.search.toLowerCase()
        result = rows.filter(
          (r) =>
            r.orderNumber.toLowerCase().includes(q) ||
            (r.subject ?? '').toLowerCase().includes(q) ||
            (r.signedBy ?? '').toLowerCase().includes(q)
        )
      }

      // Count items for each order
      return result.map((row) => {
        const items = db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, row.id))
          .all()
        return { ...row, itemsCount: items.length }
      })
    } catch (err) {
      console.error('[ipc] ORDERS_LIST error:', err)
      return []
    }
  })

  safeHandle(IPC.ORDERS_CREATE, (_event, data: Record<string, unknown>) => {
    try {
      const validated = orderCreateSchema.parse(data)
      const db = getDatabase()

      // Transaction: create order + items
      const result = db.transaction(() => {
        const orderResult = db
          .insert(orders)
          .values({
            orderType: validated.orderType,
            orderNumber: validated.orderNumber,
            orderDate: validated.orderDate,
            subject: validated.subject || null,
            bodyText: validated.bodyText || null,
            signedBy: validated.signedBy || null
          })
          .run()

        const orderId = Number(orderResult.lastInsertRowid)

        // Insert items
        if (validated.items && validated.items.length > 0) {
          for (let i = 0; i < validated.items.length; i++) {
            const item = validated.items[i]
            db.insert(orderItems)
              .values({
                orderId,
                personnelId: item.personnelId ?? null,
                actionType: item.actionType || null,
                description: item.description || null,
                sortOrder: item.sortOrder ?? i
              })
              .run()
          }
        }

        // Audit
        db.insert(auditLog)
          .values({
            tableName: 'orders',
            recordId: orderId,
            action: 'create',
            newValues: JSON.stringify(validated)
          })
          .run()

        return orderId
      })

      return { success: true, id: result }
    } catch (err) {
      console.error('[ipc] ORDERS_CREATE error:', err)
      return { success: false, error: String(err) }
    }
  })

  safeHandle(IPC.ORDERS_GET, (_event, id: number) => {
    try {
      const db = getDatabase()
      const order = db.select().from(orders).where(eq(orders.id, id)).get()
      if (!order) return null

      const items = db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, id))
        .orderBy(asc(orderItems.sortOrder))
        .all()

      return { ...order, items }
    } catch (err) {
      console.error('[ipc] ORDERS_GET error:', err)
      return null
    }
  })

  safeHandle(IPC.ORDERS_DELETE, (_event, id: number) => {
    try {
      const db = getDatabase()

      db.transaction(() => {
        // Delete items first
        db.delete(orderItems).where(eq(orderItems.orderId, id)).run()
        // Delete order
        db.delete(orders).where(eq(orders.id, id)).run()

        db.insert(auditLog)
          .values({
            tableName: 'orders',
            recordId: id,
            action: 'delete',
            oldValues: JSON.stringify({ id })
          })
          .run()
      })

      return { success: true }
    } catch (err) {
      console.error('[ipc] ORDERS_DELETE error:', err)
      return { success: false }
    }
  })

  // ==================== LEAVE TYPES (довідник) ====================

  safeHandle(IPC.LEAVE_TYPES_LIST, () => {
    try {
      const db = getDatabase()
      return db.select().from(leaveTypes).orderBy(asc(leaveTypes.sortOrder)).all()
    } catch (err) {
      console.error('[ipc] LEAVE_TYPES_LIST error:', err)
      return []
    }
  })

  // Resolve leaveType name (or alias) → { statusCode, leaveTypeName }
  safeHandle(IPC.LEAVE_TYPES_RESOLVE, (_event, input: string) => {
    try {
      const db = getDatabase()
      const normalized = input.trim().toLowerCase()

      // 1. Direct match by name
      const direct = db.select().from(leaveTypes)
        .where(sql`lower(${leaveTypes.name}) = ${normalized}`)
        .get()
      if (direct) return { found: true, statusCode: direct.statusCode, leaveTypeName: direct.name }

      // 2. Alias match
      const aliasRow = db.select({
        alias: leaveTypeAliases.alias,
        leaveTypeId: leaveTypeAliases.leaveTypeId
      }).from(leaveTypeAliases)
        .where(sql`lower(${leaveTypeAliases.alias}) = ${normalized}`)
        .get()

      if (aliasRow) {
        const lt = db.select().from(leaveTypes).where(eq(leaveTypes.id, aliasRow.leaveTypeId)).get()
        if (lt) return { found: true, statusCode: lt.statusCode, leaveTypeName: lt.name }
      }

      return { found: false, statusCode: null, leaveTypeName: null }
    } catch (err) {
      console.error('[ipc] LEAVE_TYPES_RESOLVE error:', err)
      return { found: false, statusCode: null, leaveTypeName: null }
    }
  })

  // ==================== LEAVE RECORDS ====================

  safeHandle(IPC.LEAVE_LIST, (_event, filters?: {
    search?: string
    leaveType?: string
    personnelId?: number
    dateFrom?: string
    dateTo?: string
  }) => {
    try {
      const db = getDatabase()
      const conditions = [sql`1=1`]

      if (filters?.leaveType) {
        conditions.push(eq(leaveRecords.leaveType, filters.leaveType))
      }
      if (filters?.personnelId) {
        conditions.push(eq(leaveRecords.personnelId, filters.personnelId))
      }
      if (filters?.dateFrom) {
        conditions.push(gte(leaveRecords.startDate, filters.dateFrom))
      }
      if (filters?.dateTo) {
        conditions.push(lte(leaveRecords.endDate, filters.dateTo))
      }

      const rows = db
        .select({
          id: leaveRecords.id,
          personnelId: leaveRecords.personnelId,
          leaveType: leaveRecords.leaveType,
          startDate: leaveRecords.startDate,
          endDate: leaveRecords.endDate,
          travelDays: leaveRecords.travelDays,
          destination: leaveRecords.destination,
          orderNumber: leaveRecords.orderNumber,
          orderDate: leaveRecords.orderDate,
          ticketNumber: leaveRecords.ticketNumber,
          returnDate: leaveRecords.returnDate,
          tccRegistration: leaveRecords.tccRegistration,
          notes: leaveRecords.notes,
          createdAt: leaveRecords.createdAt,
          fullName: personnel.fullName,
          rankId: personnel.rankId
        })
        .from(leaveRecords)
        .innerJoin(personnel, eq(leaveRecords.personnelId, personnel.id))
        .where(and(...conditions))
        .orderBy(desc(leaveRecords.startDate))
        .all()

      // Resolve rank names
      const rankRows = db.select().from(ranks).all()
      const rankMap = new Map(rankRows.map((r) => [r.id, r.name]))

      let result = rows.map((r) => ({
        ...r,
        rankName: r.rankId ? rankMap.get(r.rankId) ?? null : null
      }))

      // Search filter
      if (filters?.search) {
        const q = filters.search.toLowerCase()
        result = result.filter(
          (r) =>
            r.fullName.toLowerCase().includes(q) ||
            (r.destination ?? '').toLowerCase().includes(q) ||
            (r.orderNumber ?? '').toLowerCase().includes(q)
        )
      }

      return result
    } catch (err) {
      console.error('[ipc] LEAVE_LIST error:', err)
      return []
    }
  })

  safeHandle(IPC.LEAVE_CREATE, (_event, data: Record<string, unknown>) => {
    try {
      const validated = leaveRecordCreateSchema.parse(data)
      const db = getDatabase()

      const result = db
        .insert(leaveRecords)
        .values({
          personnelId: validated.personnelId,
          leaveType: validated.leaveType,
          startDate: validated.startDate,
          endDate: validated.endDate,
          travelDays: validated.travelDays ?? 2,
          destination: validated.destination || null,
          orderNumber: validated.orderNumber || null,
          orderDate: validated.orderDate || null,
          ticketNumber: validated.ticketNumber || null,
          notes: validated.notes || null
        })
        .run()

      const leaveId = Number(result.lastInsertRowid)

      // Resolve leaveType → statusCode via leave_types + leave_type_aliases
      const normalized = validated.leaveType.trim().toLowerCase()
      let statusCode: string | null = null
      let warning: string | undefined

      // 1. Direct match by leave_types.name
      const directMatch = db.select().from(leaveTypes)
        .where(sql`lower(${leaveTypes.name}) = ${normalized}`)
        .get()

      if (directMatch) {
        statusCode = directMatch.statusCode
      } else {
        // 2. Alias match
        const aliasMatch = db.select({
          leaveTypeId: leaveTypeAliases.leaveTypeId
        }).from(leaveTypeAliases)
          .where(sql`lower(${leaveTypeAliases.alias}) = ${normalized}`)
          .get()

        if (aliasMatch) {
          const lt = db.select().from(leaveTypes).where(eq(leaveTypes.id, aliasMatch.leaveTypeId)).get()
          if (lt) statusCode = lt.statusCode
        }
      }

      if (!statusCode) {
        console.warn(`[ipc] LEAVE_CREATE: невідомий тип відпустки "${validated.leaveType}", статус не встановлено`)
        warning = `Невідомий тип відпустки "${validated.leaveType}". Статус особи не змінено. Перевірте довідник типів відпусток.`
      }

      const person = db.select().from(personnel).where(eq(personnel.id, validated.personnelId)).get()
      if (statusCode && person && person.status === 'active') {
        db.update(personnel)
          .set({ currentStatusCode: statusCode })
          .where(eq(personnel.id, validated.personnelId))
          .run()

        db.insert(statusHistory)
          .values({
            personnelId: validated.personnelId,
            statusCode,
            dateFrom: validated.startDate,
            dateTo: validated.endDate,
            comment: `Відпустка: ${validated.leaveType}`
          })
          .run()
      }

      db.insert(auditLog)
        .values({
          tableName: 'leave_records',
          recordId: leaveId,
          action: 'create',
          newValues: JSON.stringify(validated)
        })
        .run()

      return { success: true, id: leaveId, warning }
    } catch (err) {
      console.error('[ipc] LEAVE_CREATE error:', err)
      return { success: false, error: String(err) }
    }
  })

  safeHandle(IPC.LEAVE_GET, (_event, id: number) => {
    try {
      const db = getDatabase()
      const record = db.select().from(leaveRecords).where(eq(leaveRecords.id, id)).get()
      if (!record) return null

      const person = db.select().from(personnel).where(eq(personnel.id, record.personnelId)).get()
      const rankRow = person?.rankId
        ? db.select().from(ranks).where(eq(ranks.id, person.rankId)).get()
        : null

      return {
        ...record,
        fullName: person?.fullName ?? '',
        rankName: rankRow?.name ?? null
      }
    } catch (err) {
      console.error('[ipc] LEAVE_GET error:', err)
      return null
    }
  })

  safeHandle(IPC.LEAVE_DELETE, (_event, id: number) => {
    try {
      const db = getDatabase()
      db.delete(leaveRecords).where(eq(leaveRecords.id, id)).run()

      db.insert(auditLog)
        .values({
          tableName: 'leave_records',
          recordId: id,
          action: 'delete',
          oldValues: JSON.stringify({ id })
        })
        .run()

      return { success: true }
    } catch (err) {
      console.error('[ipc] LEAVE_DELETE error:', err)
      return { success: false }
    }
  })

  safeHandle(IPC.LEAVE_GENERATE_TICKET, (_event, leaveId: number) => {
    try {
      const db = getDatabase()
      const record = db.select().from(leaveRecords).where(eq(leaveRecords.id, leaveId)).get()
      if (!record) return { success: false, error: 'Leave record not found' }

      const person = db.select().from(personnel).where(eq(personnel.id, record.personnelId)).get()
      if (!person) return { success: false, error: 'Personnel not found' }

      const rankRow = person.rankId
        ? db.select().from(ranks).where(eq(ranks.id, person.rankId)).get()
        : null

      // Find position
      const pos = person.currentPositionIdx
        ? db.select().from(positions).where(eq(positions.positionIndex, person.currentPositionIdx)).get()
        : null

      const subRow = person.currentSubdivision
        ? db.select().from(subdivisions).where(eq(subdivisions.code, person.currentSubdivision)).get()
        : null

      // Find leave_ticket template
      const tmpl = db
        .select()
        .from(documentTemplates)
        .where(eq(documentTemplates.templateType, 'leave_ticket'))
        .get()

      if (!tmpl) return { success: false, error: 'Leave ticket template not found' }

      // Generate document
      const genResult = generateDocument({
        templateId: tmpl.id,
        title: `Відпускний квиток — ${person.fullName}`,
        personnelIds: [person.id],
        fields: {
          ticketNumber: record.ticketNumber ?? '',
          rankName: rankRow?.name ?? '',
          fullName: person.fullName,
          ipn: person.ipn,
          positionTitle: pos?.title ?? '',
          subdivisionName: subRow?.name ?? '',
          leaveType: record.leaveType,
          startDate: record.startDate,
          endDate: record.endDate,
          travelDays: String(record.travelDays ?? 2),
          destination: record.destination ?? '',
          orderNumber: record.orderNumber ?? '',
          orderDate: record.orderDate ?? ''
        }
      })

      return { success: true, document: genResult }
    } catch (err) {
      console.error('[ipc] LEAVE_GENERATE_TICKET error:', err)
      return { success: false, error: String(err) }
    }
  })

  // ==================== STATISTICS ====================

  safeHandle(IPC.STATISTICS_SUMMARY, (_event, subdivision?: string) => {
    try {
      const db = getDatabase()

      // All personnel by status
      const conditions = [sql`1=1`]
      if (subdivision) {
        conditions.push(eq(personnel.currentSubdivision, subdivision))
      }

      const allPersonnel = db
        .select({
          id: personnel.id,
          status: personnel.status,
          currentStatusCode: personnel.currentStatusCode,
          currentPositionIdx: personnel.currentPositionIdx,
          rankId: personnel.rankId
        })
        .from(personnel)
        .where(and(...conditions))
        .all()

      const active = allPersonnel.filter((p) => p.status === 'active')
      const excluded = allPersonnel.filter((p) => p.status !== 'active')

      // Status types lookup
      const stRows = db.select().from(statusTypes).all()
      const stMap = new Map(stRows.map((s) => [s.code, s]))

      // Ranks lookup
      const rankRows = db.select().from(ranks).all()
      const rankMap = new Map(rankRows.map((r) => [r.id, r]))

      // On/off supply
      let onSupplyCount = 0
      let offSupplyCount = 0
      const groupCounts = new Map<string, { count: number; color: string | null }>()
      const categoryCounts = new Map<string, number>()

      for (const p of active) {
        const st = p.currentStatusCode ? stMap.get(p.currentStatusCode) : null
        if (st?.onSupply) {
          onSupplyCount++
        } else {
          offSupplyCount++
        }

        // By group
        const groupName = st?.groupName ?? 'Невизначено'
        const existing = groupCounts.get(groupName)
        if (existing) {
          existing.count++
        } else {
          groupCounts.set(groupName, { count: 1, color: st?.colorCode ?? '#999' })
        }

        // By rank category
        const rank = p.rankId ? rankMap.get(p.rankId) : null
        const category = rank?.category ?? 'Невизначено'
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
      }

      const byGroup = Array.from(groupCounts.entries()).map(([groupName, v]) => ({
        groupName,
        count: v.count,
        color: v.color
      }))

      const byCategory = Array.from(categoryCounts.entries()).map(([category, count]) => ({
        category,
        count
      }))

      // Positions stats
      const posConditions = [eq(positions.isActive, true)]
      if (subdivision) {
        // Resolve subdivision code → id
        const subRow = db.select().from(subdivisions).where(eq(subdivisions.code, subdivision)).get()
        if (subRow) {
          posConditions.push(eq(positions.subdivisionId, subRow.id))
        }
      }
      const allPositions = db
        .select({
          id: positions.id,
          isActive: positions.isActive,
          positionIndex: positions.positionIndex
        })
        .from(positions)
        .where(and(...posConditions))
        .all()

      const totalPositions = allPositions.length
      const vacantPositions = totalPositions - active.filter((p) => p.currentPositionIdx).length

      return {
        totalPersonnel: active.length,
        excludedPersonnel: excluded.length,
        onSupplyCount,
        offSupplyCount,
        byGroup,
        byCategory,
        totalPositions,
        vacantPositions
      }
    } catch (err) {
      console.error('[ipc] STATISTICS_SUMMARY error:', err)
      return {
        totalPersonnel: 0,
        excludedPersonnel: 0,
        onSupplyCount: 0,
        offSupplyCount: 0,
        byGroup: [],
        byCategory: [],
        totalPositions: 0,
        vacantPositions: 0
      }
    }
  })

  safeHandle(IPC.STATISTICS_BY_STATUS, (_event, subdivision?: string) => {
    try {
      const db = getDatabase()

      const conditions = [eq(personnel.status, 'active')]
      if (subdivision) {
        conditions.push(eq(personnel.currentSubdivision, subdivision))
      }
      const active = db
        .select({ currentStatusCode: personnel.currentStatusCode })
        .from(personnel)
        .where(and(...conditions))
        .all()

      const stRows = db.select().from(statusTypes).all()
      const stMap = new Map(stRows.map((s) => [s.code, s]))

      const counts = new Map<string, number>()
      for (const p of active) {
        const code = p.currentStatusCode ?? 'UNKNOWN'
        counts.set(code, (counts.get(code) ?? 0) + 1)
      }

      return Array.from(counts.entries()).map(([statusCode, count]) => {
        const st = stMap.get(statusCode)
        return {
          statusCode,
          statusName: st?.name ?? statusCode,
          groupName: st?.groupName ?? '',
          color: st?.colorCode ?? '#999',
          count
        }
      }).sort((a, b) => b.count - a.count)
    } catch (err) {
      console.error('[ipc] STATISTICS_BY_STATUS error:', err)
      return []
    }
  })

  safeHandle(IPC.STATISTICS_BY_SUBDIVISION, (_event, subdivision?: string) => {
    try {
      const db = getDatabase()

      const conditions = [eq(personnel.status, 'active')]
      if (subdivision) {
        conditions.push(eq(personnel.currentSubdivision, subdivision))
      }
      const active = db
        .select({
          currentSubdivision: personnel.currentSubdivision,
          currentStatusCode: personnel.currentStatusCode
        })
        .from(personnel)
        .where(and(...conditions))
        .all()

      const stRows = db.select().from(statusTypes).all()
      const stMap = new Map(stRows.map((s) => [s.code, s]))

      const subRows = db.select().from(subdivisions).all()
      const subMap = new Map(subRows.map((s) => [s.code, s.name]))

      const grouped = new Map<string, { total: number; onSupply: number; offSupply: number }>()

      for (const p of active) {
        const code = p.currentSubdivision ?? 'UNKNOWN'
        if (!grouped.has(code)) {
          grouped.set(code, { total: 0, onSupply: 0, offSupply: 0 })
        }
        const g = grouped.get(code)!
        g.total++

        const st = p.currentStatusCode ? stMap.get(p.currentStatusCode) : null
        if (st?.onSupply) {
          g.onSupply++
        } else {
          g.offSupply++
        }
      }

      return Array.from(grouped.entries()).map(([subdivisionCode, v]) => ({
        subdivisionCode,
        subdivisionName: subMap.get(subdivisionCode) ?? subdivisionCode,
        total: v.total,
        onSupply: v.onSupply,
        offSupply: v.offSupply
      })).sort((a, b) => b.total - a.total)
    } catch (err) {
      console.error('[ipc] STATISTICS_BY_SUBDIVISION error:', err)
      return []
    }
  })

  // ==================== DOCS ====================

  // Get configured docs root path
  safeHandle(IPC.DOCS_GET_ROOT, () => {
    const db = getDatabase()
    const row = db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'docsRootPath')).get()
    return row?.value ?? null
  })

  // Save docs root path
  safeHandle(IPC.DOCS_SET_ROOT, (_event, rootPath: string) => {
    const db = getDatabase()
    db.insert(settings).values({ key: 'docsRootPath', value: rootPath })
      .onConflictDoUpdate({ target: settings.key, set: { value: rootPath } })
      .run()
    return { ok: true }
  })

  // Open folder picker dialog
  safeHandle(IPC.DOCS_BROWSE_ROOT, async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Оберіть папку документів ОС'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Scan files for a person by fullName (async to avoid blocking main process)
  safeHandle(IPC.DOCS_SCAN_PERSON, async (_event, fullName: string) => {
    const db = getDatabase()
    const row = db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'docsRootPath')).get()
    const rootPath = row?.value
    if (!rootPath) return { files: [], photoPath: null, folderPath: null }

    const normalize = (s: string) => s.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    const targetName = normalize(fullName)

    // Scan 2 levels: rootPath/GROUP/PERSON_FOLDER
    let personFolder: string | null = null
    try {
      const groups = await fsp.readdir(rootPath)
      for (const group of groups) {
        if (group === 'desktop.ini') continue
        const groupPath = join(rootPath, group)
        try {
          if (!(await fsp.stat(groupPath)).isDirectory()) continue
          const folders = await fsp.readdir(groupPath)
          for (const folder of folders) {
            if (folder === 'desktop.ini') continue
            if (normalize(folder) === targetName) {
              personFolder = join(groupPath, folder)
              break
            }
          }
        } catch { /* skip unreadable */ }
        if (personFolder) break
      }
    } catch { /* rootPath unreadable */ }

    if (!personFolder) return { files: [], photoPath: null, folderPath: null }

    const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
    const DOC_KEYWORDS = ['паспорт', 'квиток', 'убд', 'іпн', 'автобіог', 'контракт', 'наказ', 'id карт', 'id-карт']

    interface DocFile {
      name: string
      path: string
      ext: string
      category: string
      isPhoto: boolean
    }

    const files: DocFile[] = []
    let photoPath: string | null = null

    try {
      const entries = await fsp.readdir(personFolder)
      for (const file of entries) {
        if (file === 'desktop.ini') continue
        const filePath = join(personFolder, file)
        try {
          if (!(await fsp.stat(filePath)).isFile()) continue
        } catch { continue }

        const ext = extname(file).toLowerCase()
        const nameLower = basename(file, ext).toLowerCase()
        const isImage = IMAGE_EXTS.has(ext)

        let isPhoto = false
        let category = 'Інше'

        if (isImage) {
          const isDocScan = DOC_KEYWORDS.some(kw => nameLower.includes(kw)) || nameLower.includes(' - ')
          if (!isDocScan) {
            isPhoto = true
            category = 'Фото'
            if (!photoPath) photoPath = filePath
          } else {
            category = categorizeDoc(nameLower)
          }
        } else {
          category = categorizeDoc(nameLower)
        }

        files.push({ name: file, path: filePath, ext, category, isPhoto })
      }
    } catch { /* unreadable */ }

    // Sort: photos first, then by category
    files.sort((a, b) => {
      if (a.isPhoto && !b.isPhoto) return -1
      if (!a.isPhoto && b.isPhoto) return 1
      return a.category.localeCompare(b.category, 'uk')
    })

    return { files, photoPath, folderPath: personFolder }
  })

  // Open file with system default app
  safeHandle(IPC.DOCS_OPEN_FILE, (_event, filePath: string) => {
    shell.openPath(filePath)
  })

  // Missing documents report: scan all active personnel folders and return who is missing required docs
  safeHandle(IPC.DOCS_MISSING_REPORT, async () => {
    const db = getDatabase()
    const row = db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'docsRootPath')).get()
    const rootPath = row?.value
    if (!rootPath) return null

    const allPersonnel = db
      .select({ id: personnel.id, fullName: personnel.fullName, currentSubdivision: personnel.currentSubdivision })
      .from(personnel)
      .where(sql`${personnel.status} != 'excluded'`)
      .orderBy(asc(personnel.currentPositionIdx), asc(personnel.fullName))
      .all()

    const normalize = (s: string) => s.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
    const DOC_KEYWORDS = ['паспорт', 'квиток', 'убд', 'іпн', 'автобіог', 'контракт', 'наказ', 'id карт', 'id-карт']

    // Build index: normalized folder name → folder path (async)
    const folderIndex = new Map<string, string>()
    try {
      const groups = await fsp.readdir(rootPath)
      for (const group of groups) {
        if (group === 'desktop.ini') continue
        const groupPath = join(rootPath, group)
        try {
          if (!(await fsp.stat(groupPath)).isDirectory()) continue
          const folders = await fsp.readdir(groupPath)
          for (const folder of folders) {
            if (folder === 'desktop.ini') continue
            try { if (!(await fsp.stat(join(groupPath, folder))).isDirectory()) continue } catch { continue }
            folderIndex.set(normalize(folder), join(groupPath, folder))
          }
        } catch { /* skip */ }
      }
    } catch { /* rootPath unreadable */ }

    const results: { id: number; fullName: string; subdivision: string | null; missingDocs: string[] }[] = []

    for (const person of allPersonnel) {
      const personFolder = folderIndex.get(normalize(person.fullName)) ?? null

      const categories = new Set<string>()
      if (personFolder) {
        try {
          const entries = await fsp.readdir(personFolder)
          for (const file of entries) {
            if (file === 'desktop.ini') continue
            const filePath = join(personFolder, file)
            try { if (!(await fsp.stat(filePath)).isFile()) continue } catch { continue }
            const ext = extname(file).toLowerCase()
            const nameLower = basename(file, ext).toLowerCase()
            const isImage = IMAGE_EXTS.has(ext)
            if (isImage) {
              const isDocScan = DOC_KEYWORDS.some(kw => nameLower.includes(kw)) || nameLower.includes(' - ')
              if (isDocScan) categories.add(categorizeDoc(nameLower))
            } else {
              categories.add(categorizeDoc(nameLower))
            }
          }
        } catch { /* skip */ }
      }

      const hasPassport = categories.has('Паспорт')
      const hasIdCard = categories.has('ID-картка')
      const hasVK = categories.has('Військовий квиток')
      const hasIPN = categories.has('ІПН')

      const missingDocs: string[] = []
      if (!hasVK) missingDocs.push('Військовий квиток')
      if (!hasPassport && !hasIdCard) missingDocs.push('Паспорт або ID-картка')
      if (hasPassport && !hasIdCard && !hasIPN) missingDocs.push('ІПН')

      if (missingDocs.length > 0) {
        results.push({ id: person.id, fullName: person.fullName, subdivision: person.currentSubdivision, missingDocs })
      }
    }

    return results
  })

  // ==================== STAFF ROSTER ====================
  safeHandle(IPC.STAFF_ROSTER, () => {
    const db = getDatabase()

    // All active positions with subdivision info, ordered by positionIndex
    const allPos = db
      .select({
        id: positions.id,
        positionIndex: positions.positionIndex,
        subdivisionId: positions.subdivisionId,
        title: positions.title,
        detail: positions.detail,
        rankRequired: positions.rankRequired,
        isActive: positions.isActive,
        subdivisionCode: subdivisions.code,
        subdivisionName: subdivisions.name,
        subdivisionSortOrder: subdivisions.sortOrder,
        subdivisionParentId: subdivisions.parentId
      })
      .from(positions)
      .leftJoin(subdivisions, eq(positions.subdivisionId, subdivisions.id))
      .where(eq(positions.isActive, true))
      .orderBy(asc(positions.positionIndex))
      .all()

    // All active personnel with full details
    const activePersonnel = db
      .select({
        id: personnel.id,
        lastName: personnel.lastName,
        firstName: personnel.firstName,
        patronymic: personnel.patronymic,
        fullName: personnel.fullName,
        callsign: personnel.callsign,
        ipn: personnel.ipn,
        dateOfBirth: personnel.dateOfBirth,
        currentPositionIdx: personnel.currentPositionIdx,
        currentStatusCode: personnel.currentStatusCode,
        currentSubdivision: personnel.currentSubdivision,
        rankName: ranks.name,
        rankCategory: ranks.category,
        fitness: personnel.fitness,
        notes: personnel.notes
      })
      .from(personnel)
      .leftJoin(ranks, eq(personnel.rankId, ranks.id))
      .where(eq(personnel.status, 'active'))
      .all()

    // Get latest status history for each person (isLast = true)
    const lastStatuses = db
      .select({
        personnelId: statusHistory.personnelId,
        statusCode: statusHistory.statusCode,
        presenceGroup: statusHistory.presenceGroup,
        dateFrom: statusHistory.dateFrom,
        dateTo: statusHistory.dateTo,
        comment: statusHistory.comment
      })
      .from(statusHistory)
      .where(and(eq(statusHistory.isLast, true), eq(statusHistory.isActive, true)))
      .all()

    const statusMap = new Map<number, typeof lastStatuses[0]>()
    for (const s of lastStatuses) {
      statusMap.set(s.personnelId, s)
    }

    // Get status types for name mapping
    const stTypes = db.select().from(statusTypes).all()
    const stNameMap = new Map(stTypes.map((s) => [s.code, s]))

    // Map personnel to positions
    const personnelByPos = new Map<string, typeof activePersonnel[0]>()
    for (const p of activePersonnel) {
      if (p.currentPositionIdx) {
        personnelByPos.set(p.currentPositionIdx, p)
      }
    }

    // Enrich positions with personnel data
    const rows = allPos.map((pos) => {
      const person = personnelByPos.get(pos.positionIndex)
      const lastStatus = person ? statusMap.get(person.id) : null
      const stType = person?.currentStatusCode ? stNameMap.get(person.currentStatusCode) : null

      return {
        positionIndex: pos.positionIndex,
        positionTitle: pos.title,
        positionDetail: pos.detail,
        subdivisionId: pos.subdivisionId,
        subdivisionCode: pos.subdivisionCode,
        subdivisionName: pos.subdivisionName,
        subdivisionSortOrder: pos.subdivisionSortOrder ?? 0,
        subdivisionParentId: pos.subdivisionParentId,
        // Person data
        personnelId: person?.id ?? null,
        lastName: person?.lastName ?? null,
        firstName: person?.firstName ?? null,
        patronymic: person?.patronymic ?? null,
        callsign: person?.callsign ?? null,
        rankName: person?.rankName ?? null,
        ipn: person?.ipn ?? null,
        dateOfBirth: person?.dateOfBirth ?? null,
        currentStatusCode: person?.currentStatusCode ?? null,
        statusName: stType?.name ?? null,
        statusGroupName: stType?.groupName ?? null,
        fitness: person?.fitness ?? null,
        // Status history for remarks
        statusDateFrom: lastStatus?.dateFrom ?? null,
        statusDateTo: lastStatus?.dateTo ?? null,
        statusComment: lastStatus?.comment ?? null,
        statusPresenceGroup: lastStatus?.presenceGroup ?? null
      }
    })

    // Summary stats
    const totalPositions = allPos.length
    const totalPersonnel = activePersonnel.length
    const onPositions = activePersonnel.filter((p) => p.currentPositionIdx).length

    // Count by status
    const statusCounts: Record<string, number> = {}
    for (const p of activePersonnel) {
      if (p.currentStatusCode) {
        statusCounts[p.currentStatusCode] = (statusCounts[p.currentStatusCode] ?? 0) + 1
      }
    }

    // Count by presence group
    const presentGroup = stTypes.filter((s) => s.groupName === 'Так').map((s) => s.code)
    const present = activePersonnel.filter(
      (p) => p.currentStatusCode && presentGroup.includes(p.currentStatusCode)
    ).length

    // Count limited fitness
    const limitedFitness = activePersonnel.filter(
      (p) => p.fitness && p.fitness.toLowerCase().includes('обмежено')
    ).length

    return {
      rows,
      summary: {
        totalPositions,
        totalPersonnel,
        onPositions,
        present,
        statusCounts,
        limitedFitness
      },
      statusTypes: stTypes.map((s) => ({ code: s.code, name: s.name, groupName: s.groupName }))
    }
  })

  // ==================== DGV (Грошове забезпечення) ====================

  // List DGV codes (from shared constants)
  safeHandle(IPC.DGV_CODES_LIST, () => {
    const { DGV_CODES } = require('@shared/enums/dgv-codes')
    return DGV_CODES
  })

  // Get monthly DGV grid
  safeHandle(
    IPC.DGV_GET_MONTH,
    (_event, year: number, month: number) => {
      const db = getDatabase()
      const HOME_SUB = 'Г-3'

      // Date range
      const mm = String(month).padStart(2, '0')
      const firstDay = `${year}-${mm}-01`
      const lastDay = `${year}-${mm}-${new Date(year, month, 0).getDate()}`

      // 1) Active personnel currently in our subdivision
      const currentRows = db
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
        .where(and(
          eq(personnel.status, 'active'),
          eq(personnel.currentSubdivision, HOME_SUB)
        ))
        .orderBy(asc(personnel.currentPositionIdx), asc(personnel.fullName))
        .all()

      const currentIds = new Set(currentRows.map((p) => p.id))

      // 2) Personnel transferred OUT of our subdivision during this month
      // Find positions that belong to our subdivision
      const homePositionIndexes = new Set(
        db.select({ positionIndex: positions.positionIndex })
          .from(positions)
          .innerJoin(subdivisions, eq(positions.subdivisionId, subdivisions.id))
          .where(eq(subdivisions.code, HOME_SUB))
          .all()
          .map((p) => p.positionIndex)
      )

      // Find movements this month where previousPosition was in our subdivision
      const transferredOutMovements = db
        .select({
          personnelId: movements.personnelId,
          previousPosition: movements.previousPosition
        })
        .from(movements)
        .where(and(
          eq(movements.isActive, true),
          sql`${movements.dateFrom} >= ${firstDay}`,
          sql`${movements.dateFrom} <= ${lastDay}`
        ))
        .all()
        .filter((m) =>
          m.previousPosition &&
          homePositionIndexes.has(m.previousPosition) &&
          !currentIds.has(m.personnelId)
        )

      const transferredOutIds = new Set(transferredOutMovements.map((m) => m.personnelId))

      // Fetch transferred-out personnel data
      const transferredRows = transferredOutIds.size > 0
        ? db
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
            .where(sql`${personnel.id} IN (${sql.raw([...transferredOutIds].join(','))})`)
            .orderBy(asc(personnel.currentPositionIdx), asc(personnel.fullName))
            .all()
        : []

      // Combined: current personnel first, then transferred-out
      const personnelRows = [...currentRows, ...transferredRows]

      // DGV marks for the month
      const marksRows = db
        .select()
        .from(dgvMarks)
        .where(and(
          sql`${dgvMarks.date} >= ${firstDay}`,
          sql`${dgvMarks.date} <= ${lastDay}`
        ))
        .all()

      // Build lookup: personnelId → { date → dgvCode }
      const marksMap = new Map<number, Record<string, string>>()
      for (const m of marksRows) {
        if (!marksMap.has(m.personnelId)) marksMap.set(m.personnelId, {})
        marksMap.get(m.personnelId)![m.date] = m.dgvCode
      }

      // Month metadata
      const yearMonth = `${year}-${mm}`
      const metaRows = db
        .select()
        .from(dgvMonthMeta)
        .where(eq(dgvMonthMeta.yearMonth, yearMonth))
        .all()

      // Global meta
      let grounds100 = ''
      let grounds30 = ''
      // Per-person meta: personnelId → { metaKey → metaValue }
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

      const rows = personnelRows.map((p) => {
        const pm = personMeta.get(p.id) ?? {}
        return {
          personnelId: p.id,
          fullName: p.fullName,
          rankName: p.rankName,
          positionTitle: p.positionTitle,
          ipn: p.ipn,
          days: marksMap.get(p.id) ?? {},
          isTransferredOut: transferredOutIds.has(p.id),
          notes: pm['notes'] ?? '',
          additionalGrounds: pm['additional_grounds'] ?? '',
          punishmentReason: pm['punishment_reason'] ?? '',
          punishmentOrder: pm['punishment_order'] ?? ''
        }
      })

      return { year, month, grounds100, grounds30, rows }
    }
  )

  // Set single day DGV mark
  safeHandle(
    IPC.DGV_SET_DAY,
    (_event, personnelId: number, date: string, dgvCode: string) => {
      const db = getDatabase()

      const existing = db
        .select({ id: dgvMarks.id })
        .from(dgvMarks)
        .where(and(eq(dgvMarks.personnelId, personnelId), eq(dgvMarks.date, date)))
        .get()

      if (existing) {
        db.update(dgvMarks)
          .set({ dgvCode })
          .where(eq(dgvMarks.id, existing.id))
          .run()
      } else {
        db.insert(dgvMarks)
          .values({ personnelId, date, dgvCode })
          .run()
      }

      db.insert(auditLog)
        .values({
          tableName: 'dgv_marks',
          recordId: personnelId,
          action: existing ? 'update' : 'create',
          newValues: JSON.stringify({ personnelId, date, dgvCode })
        })
        .run()

      return { ok: true }
    }
  )

  // Clear single day DGV mark
  safeHandle(
    IPC.DGV_CLEAR_DAY,
    (_event, personnelId: number, date: string) => {
      const db = getDatabase()

      db.delete(dgvMarks)
        .where(and(eq(dgvMarks.personnelId, personnelId), eq(dgvMarks.date, date)))
        .run()

      return { ok: true }
    }
  )

  // Bulk set DGV marks (range of days for one person)
  safeHandle(
    IPC.DGV_SET_BULK,
    (_event, personnelId: number, dateFrom: string, dateTo: string, dgvCode: string) => {
      const db = getDatabase()
      const dayjs = require('dayjs')

      const result = db.transaction(() => {
        let current = dayjs(dateFrom)
        const end = dayjs(dateTo)
        let count = 0

        while (current.isBefore(end) || current.isSame(end, 'day')) {
          const dateStr = current.format('YYYY-MM-DD')

          const existing = db
            .select({ id: dgvMarks.id })
            .from(dgvMarks)
            .where(and(eq(dgvMarks.personnelId, personnelId), eq(dgvMarks.date, dateStr)))
            .get()

          if (existing) {
            db.update(dgvMarks)
              .set({ dgvCode })
              .where(eq(dgvMarks.id, existing.id))
              .run()
          } else {
            db.insert(dgvMarks)
              .values({ personnelId, date: dateStr, dgvCode })
              .run()
          }

          count++
          current = current.add(1, 'day')
        }

        return { count }
      })

      db.insert(auditLog)
        .values({
          tableName: 'dgv_marks',
          recordId: personnelId,
          action: 'bulk_set',
          newValues: JSON.stringify({ personnelId, dateFrom, dateTo, dgvCode, count: result.count })
        })
        .run()

      return result
    }
  )

  // Set global month metadata (grounds_100, grounds_30)
  safeHandle(
    IPC.DGV_META_SET,
    (_event, yearMonth: string, metaKey: string, metaValue: string) => {
      const db = getDatabase()

      // personnelId = 0 for global meta
      const existing = db
        .select({ id: dgvMonthMeta.id })
        .from(dgvMonthMeta)
        .where(and(
          eq(dgvMonthMeta.personnelId, 0),
          eq(dgvMonthMeta.yearMonth, yearMonth),
          eq(dgvMonthMeta.metaKey, metaKey)
        ))
        .get()

      if (existing) {
        db.update(dgvMonthMeta)
          .set({ metaValue })
          .where(eq(dgvMonthMeta.id, existing.id))
          .run()
      } else {
        db.insert(dgvMonthMeta)
          .values({ personnelId: 0, yearMonth, metaKey, metaValue })
          .run()
      }

      return { ok: true }
    }
  )

  // Set per-person month metadata (notes, punishment_reason, etc.)
  safeHandle(
    IPC.DGV_PERSON_META_SET,
    (_event, personnelId: number, yearMonth: string, metaKey: string, metaValue: string) => {
      const db = getDatabase()

      const existing = db
        .select({ id: dgvMonthMeta.id })
        .from(dgvMonthMeta)
        .where(and(
          eq(dgvMonthMeta.personnelId, personnelId),
          eq(dgvMonthMeta.yearMonth, yearMonth),
          eq(dgvMonthMeta.metaKey, metaKey)
        ))
        .get()

      if (existing) {
        db.update(dgvMonthMeta)
          .set({ metaValue })
          .where(eq(dgvMonthMeta.id, existing.id))
          .run()
      } else {
        db.insert(dgvMonthMeta)
          .values({ personnelId, yearMonth, metaKey, metaValue })
          .run()
      }

      return { ok: true }
    }
  )

  // Export DGV report as .xlsx
  safeHandle(IPC.DGV_EXPORT_REPORT, async (_event, year: number, month: number) => {
    try {
      const { buildDgvReport } = require('../export/dgv-report-builder')
      return await buildDgvReport(year, month)
    } catch (err) {
      console.error('[ipc] DGV_EXPORT_REPORT error:', err)
      return { success: false, filePath: '', error: String(err) }
    }
  })

  console.log('[ipc] Обробники зареєстровано')
}

function categorizeDoc(nameLower: string): string {
  if (nameLower.includes('паспорт')) return 'Паспорт'
  if (nameLower.includes('квиток')) return 'Військовий квиток'
  if (nameLower.includes('убд')) return 'УБД'
  if (nameLower.includes('іпн') || nameLower.includes('ipn')) return 'ІПН'
  if (nameLower.includes('автобіог')) return 'Автобіографія'
  if (nameLower.includes('контракт')) return 'Контракт'
  if (nameLower.includes('id карт') || nameLower.includes('id-карт')) return 'ID-картка'
  if (nameLower.includes('наказ')) return 'Наказ'
  return 'Інше'
}
