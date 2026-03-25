import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ==================== ДОВІДНИКОВІ ТАБЛИЦІ ====================

export const ranks = sqliteTable('ranks', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().unique(),
  category: text('category').notNull(),
  sortOrder: integer('sort_order').notNull(),
  natoCode: text('nato_code')
})

export const statusTypes = sqliteTable('status_types', {
  id: integer('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  groupName: text('group_name').notNull(),
  onSupply: integer('on_supply', { mode: 'boolean' }).default(true),
  rewardAmount: integer('reward_amount'),
  sortOrder: integer('sort_order').notNull(),
  colorCode: text('color_code')
})

export const subdivisions = sqliteTable('subdivisions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  fullName: text('full_name'),
  parentId: integer('parent_id').references((): ReturnType<typeof integer> => subdivisions.id),
  sortOrder: integer('sort_order').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true)
})

export const positions = sqliteTable(
  'positions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    positionIndex: text('position_index').notNull().unique(),
    subdivisionId: integer('subdivision_id')
      .notNull()
      .references(() => subdivisions.id),
    title: text('title').notNull(),
    detail: text('detail'),
    fullTitle: text('full_title'),
    rankRequired: text('rank_required'),
    specialtyCode: text('specialty_code'),
    tariffGrade: integer('tariff_grade'),
    staffNumber: text('staff_number'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    notes: text('notes')
  },
  (table) => [index('idx_positions_subdivision').on(table.subdivisionId)]
)

export const bloodTypes = sqliteTable('blood_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique()
})

export const contractTypes = sqliteTable('contract_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  months: integer('months').notNull(),
  toDemob: integer('to_demob', { mode: 'boolean' }).default(false)
})

export const educationLevels = sqliteTable('education_levels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique()
})

export const tccOffices = sqliteTable('tcc_offices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  oblast: text('oblast').notNull(),
  code: text('code')
})

export const orderIssuers = sqliteTable('order_issuers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique()
})

export const movementOrderTypes = sqliteTable('movement_order_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique()
})

export const exclusionReasons = sqliteTable('exclusion_reasons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique()
})

export const absenceReasons = sqliteTable('absence_reasons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique()
})

export const lossTypes = sqliteTable('loss_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique()
})

// ==================== РОБОЧІ ТАБЛИЦІ ====================

export const personnel = sqliteTable(
  'personnel',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ipn: text('ipn').notNull().unique(),
    rankId: integer('rank_id').references(() => ranks.id),
    lastName: text('last_name').notNull(),
    firstName: text('first_name').notNull(),
    patronymic: text('patronymic'),
    fullName: text('full_name').notNull(),
    callsign: text('callsign'),
    dateOfBirth: text('date_of_birth'),
    phone: text('phone'),

    enrollmentOrderDate: text('enrollment_order_date'),
    enrollmentOrderInfo: text('enrollment_order_info'),
    arrivedFrom: text('arrived_from'),
    arrivalPositionIdx: text('arrival_position_idx'),
    enrollmentDate: text('enrollment_date'),
    enrollmentOrderNum: text('enrollment_order_num'),

    currentPositionIdx: text('current_position_idx'),
    currentStatusCode: text('current_status_code'),
    currentSubdivision: text('current_subdivision'),

    rankOrderDate: text('rank_order_date'),
    rankOrderInfo: text('rank_order_info'),

    serviceType: text('service_type'),
    contractDate: text('contract_date'),
    contractTypeId: integer('contract_type_id').references(() => contractTypes.id),
    contractEndDate: text('contract_end_date'),

    idDocSeries: text('id_doc_series'),
    idDocNumber: text('id_doc_number'),
    idDocType: text('id_doc_type'),
    passportSeries: text('passport_series'),
    passportNumber: text('passport_number'),
    passportIssuedBy: text('passport_issued_by'),
    passportIssuedDate: text('passport_issued_date'),
    militaryIdSeries: text('military_id_series'),
    militaryIdNumber: text('military_id_number'),
    ubdSeries: text('ubd_series'),
    ubdNumber: text('ubd_number'),
    ubdDate: text('ubd_date'),

    gender: text('gender'),
    bloodTypeId: integer('blood_type_id').references(() => bloodTypes.id),
    fitness: text('fitness'),
    educationLevelId: integer('education_level_id').references(() => educationLevels.id),
    educationInstitution: text('education_institution'),
    educationYear: text('education_year'),
    militaryEducation: text('military_education'),
    birthplace: text('birthplace'),
    addressActual: text('address_actual'),
    addressRegistered: text('address_registered'),
    maritalStatus: text('marital_status'),
    relativesInfo: text('relatives_info'),
    nationality: text('nationality'),
    citizenship: text('citizenship'),

    conscriptionDate: text('conscription_date'),
    tccId: integer('tcc_id').references(() => tccOffices.id),
    oblast: text('oblast'),

    personalNumber: text('personal_number'),
    specialtyCode: text('specialty_code'),
    photoPath: text('photo_path'),

    status: text('status').default('active'),
    additionalInfo: text('additional_info'),
    notes: text('notes'),

    // === Закордонний паспорт ===
    foreignPassportSeries: text('foreign_passport_series'),
    foreignPassportNumber: text('foreign_passport_number'),
    foreignPassportIssuedBy: text('foreign_passport_issued_by'),
    foreignPassportIssuedDate: text('foreign_passport_issued_date'),

    // === ВК додатково ===
    militaryIdIssuedBy: text('military_id_issued_by'),
    militaryIdIssuedDate: text('military_id_issued_date'),

    // === УБД додатково ===
    ubdIssuedBy: text('ubd_issued_by'),

    // === Фінансові дані ===
    iban: text('iban'),
    bankCard: text('bank_card'),
    bankName: text('bank_name'),

    // === Посвідчення водія ===
    driverLicenseIssuedBy: text('driver_license_issued_by'),
    driverLicenseCategory: text('driver_license_category'),
    driverLicenseExpiry: text('driver_license_expiry'),
    driverLicenseIssuedDate: text('driver_license_issued_date'),
    driverLicenseExperience: integer('driver_license_experience'),
    driverLicenseSeries: text('driver_license_series'),
    driverLicenseNumber: text('driver_license_number'),

    // === Посвідчення тракториста ===
    tractorLicenseIssuedBy: text('tractor_license_issued_by'),
    tractorLicenseCategory: text('tractor_license_category'),
    tractorLicenseExpiry: text('tractor_license_expiry'),
    tractorLicenseIssuedDate: text('tractor_license_issued_date'),
    tractorLicenseExperience: integer('tractor_license_experience'),
    tractorLicenseSeries: text('tractor_license_series'),
    tractorLicenseNumber: text('tractor_license_number'),

    // === Базова загальновійськова підготовка ===
    basicTrainingDateFrom: text('basic_training_date_from'),
    basicTrainingDateTo: text('basic_training_date_to'),
    basicTrainingPlace: text('basic_training_place'),
    basicTrainingCommander: text('basic_training_commander'),
    basicTrainingNotes: text('basic_training_notes'),

    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`)
  },
  (table) => [
    uniqueIndex('idx_personnel_ipn').on(table.ipn),
    index('idx_personnel_status').on(table.status),
    index('idx_personnel_position').on(table.currentPositionIdx),
    index('idx_personnel_subdivision').on(table.currentSubdivision)
  ]
)

export const movements = sqliteTable(
  'movements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    personnelId: integer('personnel_id')
      .notNull()
      .references(() => personnel.id),
    orderIssuer: text('order_issuer'),
    orderNumber: text('order_number'),
    orderDate: text('order_date'),
    orderType: text('order_type').notNull(),
    positionIndex: text('position_index'),
    dailyOrderNumber: text('daily_order_number'),
    dateFrom: text('date_from').notNull(),
    dateTo: text('date_to'),
    previousPosition: text('previous_position'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    notes: text('notes'),
    createdAt: text('created_at').default(sql`(datetime('now'))`)
  },
  (table) => [
    index('idx_movements_personnel').on(table.personnelId),
    index('idx_movements_position').on(table.positionIndex),
    index('idx_movements_active').on(table.isActive)
  ]
)

export const statusHistory = sqliteTable(
  'status_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    personnelId: integer('personnel_id')
      .notNull()
      .references(() => personnel.id),
    statusCode: text('status_code').notNull(),
    presenceGroup: text('presence_group'),
    dateFrom: text('date_from').notNull(),
    dateTo: text('date_to'),
    comment: text('comment'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    isLast: integer('is_last', { mode: 'boolean' }).default(true),
    createdAt: text('created_at').default(sql`(datetime('now'))`)
  },
  (table) => [
    index('idx_status_history_personnel').on(table.personnelId),
    index('idx_status_history_active').on(table.isActive)
  ]
)

export const rankHistory = sqliteTable(
  'rank_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    personnelId: integer('personnel_id')
      .notNull()
      .references(() => personnel.id),
    rankId: integer('rank_id')
      .notNull()
      .references(() => ranks.id),
    assignedDate: text('assigned_date'),
    orderNumber: text('order_number'),
    orderInfo: text('order_info'),
    notes: text('notes'),
    createdAt: text('created_at').default(sql`(datetime('now'))`)
  },
  (table) => [index('idx_rank_history_personnel').on(table.personnelId)]
)

export const attendance = sqliteTable(
  'attendance',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    personnelId: integer('personnel_id')
      .notNull()
      .references(() => personnel.id),
    date: text('date').notNull(),
    statusCode: text('status_code').notNull(),
    presenceGroup: text('presence_group')
  },
  (table) => [
    index('idx_attendance_date').on(table.date),
    index('idx_attendance_personnel_date').on(table.personnelId, table.date)
  ]
)

export const absences = sqliteTable(
  'absences',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    personnelId: integer('personnel_id')
      .notNull()
      .references(() => personnel.id),
    reason: text('reason').notNull(),
    location: text('location'),
    departureDate: text('departure_date'),
    expectedReturn: text('expected_return'),
    orderNumber: text('order_number'),
    orderDate: text('order_date'),
    orderIssuer: text('order_issuer'),
    actualReturn: text('actual_return'),
    notes: text('notes'),
    createdAt: text('created_at').default(sql`(datetime('now'))`)
  },
  (table) => [index('idx_absences_personnel').on(table.personnelId)]
)

export const temporaryArrivals = sqliteTable('temporary_arrivals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ipn: text('ipn'),
  rank: text('rank'),
  fullName: text('full_name').notNull(),
  fromUnit: text('from_unit'),
  position: text('position'),
  arrivalDate: text('arrival_date'),
  departureDate: text('departure_date'),
  orderNumber: text('order_number'),
  reason: text('reason'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`)
})

export const dispositions = sqliteTable('dispositions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  personnelId: integer('personnel_id')
    .notNull()
    .references(() => personnel.id),
  reason: text('reason'),
  orderNumber: text('order_number'),
  orderDate: text('order_date'),
  dateFrom: text('date_from'),
  dateTo: text('date_to'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`)
})

export const irrecoverableLosses = sqliteTable('irrecoverable_losses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  personnelId: integer('personnel_id')
    .notNull()
    .references(() => personnel.id),
  lossType: text('loss_type').notNull(),
  lossDate: text('loss_date'),
  location: text('location'),
  circumstances: text('circumstances'),
  orderNumber: text('order_number'),
  orderDate: text('order_date'),
  notificationSent: integer('notification_sent', { mode: 'boolean' }).default(false),
  notificationDate: text('notification_date'),
  notificationRecipient: text('notification_recipient'),
  bodyIdentified: integer('body_identified', { mode: 'boolean' }),
  burialLocation: text('burial_location'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`)
})

// Довідник типів відпусток з прив'язкою до коду статусу
export const leaveTypes = sqliteTable('leave_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  label: text('label').notNull(),
  statusCode: text('status_code').notNull(),
  colorTag: text('color_tag'),
  sortOrder: integer('sort_order').notNull().default(0)
})

// Синоніми/аліаси типів відпусток (для вільного вводу/імпорту)
export const leaveTypeAliases = sqliteTable('leave_type_aliases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  alias: text('alias').notNull().unique(),
  leaveTypeId: integer('leave_type_id')
    .notNull()
    .references(() => leaveTypes.id)
})

export const leaveRecords = sqliteTable(
  'leave_records',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    personnelId: integer('personnel_id')
      .notNull()
      .references(() => personnel.id),
    leaveType: text('leave_type').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    travelDays: integer('travel_days').default(2),
    destination: text('destination'),
    orderNumber: text('order_number'),
    orderDate: text('order_date'),
    ticketNumber: text('ticket_number'),
    returnDate: text('return_date'),
    tccRegistration: text('tcc_registration'),
    notes: text('notes'),
    createdAt: text('created_at').default(sql`(datetime('now'))`)
  },
  (table) => [index('idx_leave_records_personnel').on(table.personnelId)]
)

export const injuryRecords = sqliteTable(
  'injury_records',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    personnelId: integer('personnel_id')
      .notNull()
      .references(() => personnel.id),
    injuryType: text('injury_type').notNull(),
    dateOfInjury: text('date_of_injury').notNull(),
    location: text('location'),
    circumstances: text('circumstances'),
    wasIntoxicated: integer('was_intoxicated', { mode: 'boolean' }).default(false),
    hadProtectiveEquipment: integer('had_protective_equipment', { mode: 'boolean' }).default(true),
    relatedToOffense: integer('related_to_offense', { mode: 'boolean' }).default(false),
    forma100Number: text('forma_100_number'),
    forma100Date: text('forma_100_date'),
    hospitalName: text('hospital_name'),
    certificateIssued: integer('certificate_issued', { mode: 'boolean' }).default(false),
    certificateDate: text('certificate_date'),
    orderNumber: text('order_number'),
    vlkConclusion: text('vlk_conclusion'),
    returnDate: text('return_date'),
    notes: text('notes'),
    createdAt: text('created_at').default(sql`(datetime('now'))`)
  },
  (table) => [index('idx_injury_records_personnel').on(table.personnelId)]
)

export const orders = sqliteTable(
  'orders',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderType: text('order_type').notNull(),
    orderNumber: text('order_number').notNull(),
    orderDate: text('order_date').notNull(),
    subject: text('subject'),
    bodyText: text('body_text'),
    signedBy: text('signed_by'),
    filePath: text('file_path'),
    createdAt: text('created_at').default(sql`(datetime('now'))`)
  },
  (table) => [index('idx_orders_type_date').on(table.orderType, table.orderDate)]
)

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id),
  personnelId: integer('personnel_id').references(() => personnel.id),
  actionType: text('action_type'),
  description: text('description'),
  sortOrder: integer('sort_order')
})

export const documentTemplates = sqliteTable('document_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  templateType: text('template_type').notNull(),
  filePath: text('file_path').notNull(),
  description: text('description'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false)
})

export const generatedDocuments = sqliteTable('generated_documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateId: integer('template_id').references(() => documentTemplates.id),
  documentType: text('document_type').notNull(),
  title: text('title'),
  personnelIds: text('personnel_ids'),
  filePath: text('file_path').notNull(),
  generatedAt: text('generated_at').default(sql`(datetime('now'))`)
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

// ==================== DGV (Грошове забезпечення) ====================

export const dgvMarks = sqliteTable(
  'dgv_marks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    personnelId: integer('personnel_id')
      .notNull()
      .references(() => personnel.id),
    date: text('date').notNull(),
    dgvCode: text('dgv_code').notNull()
  },
  (table) => [
    index('idx_dgv_marks_date').on(table.date),
    index('idx_dgv_marks_personnel_date').on(table.personnelId, table.date),
    uniqueIndex('idx_dgv_marks_unique').on(table.personnelId, table.date)
  ]
)

export const dgvMonthMeta = sqliteTable(
  'dgv_month_meta',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    personnelId: integer('personnel_id').notNull().default(0),
    yearMonth: text('year_month').notNull(),
    metaKey: text('meta_key').notNull(),
    metaValue: text('meta_value').notNull()
  },
  (table) => [
    index('idx_dgv_meta_yearmonth').on(table.yearMonth),
    uniqueIndex('idx_dgv_meta_unique').on(table.personnelId, table.yearMonth, table.metaKey)
  ]
)

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tableName: text('table_name').notNull(),
    recordId: integer('record_id').notNull(),
    action: text('action').notNull(),
    oldValues: text('old_values'),
    newValues: text('new_values'),
    timestamp: text('timestamp').default(sql`(datetime('now'))`)
  },
  (table) => [index('idx_audit_table_record').on(table.tableName, table.recordId)]
)
