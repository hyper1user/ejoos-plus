export const IPC = {
  // App
  APP_VERSION: 'app:version',

  // Database
  DB_HEALTH: 'db:health',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',

  // Personnel
  PERSONNEL_LIST: 'personnel:list',
  PERSONNEL_GET: 'personnel:get',
  PERSONNEL_CREATE: 'personnel:create',
  PERSONNEL_UPDATE: 'personnel:update',
  PERSONNEL_DELETE: 'personnel:delete',
  PERSONNEL_SEARCH: 'personnel:search',

  // Positions
  POSITIONS_LIST: 'positions:list',
  POSITIONS_GET: 'positions:get',
  POSITIONS_CREATE: 'positions:create',
  POSITIONS_UPDATE: 'positions:update',

  // Subdivisions
  SUBDIVISIONS_LIST: 'subdivisions:list',
  SUBDIVISIONS_TREE: 'subdivisions:tree',
  SUBDIVISIONS_UPDATE: 'subdivisions:update',

  // Movements
  MOVEMENTS_LIST: 'movements:list',
  MOVEMENTS_CREATE: 'movements:create',
  MOVEMENTS_GET_BY_PERSON: 'movements:get-by-person',

  // Statuses
  STATUS_HISTORY_LIST: 'status-history:list',
  STATUS_HISTORY_CREATE: 'status-history:create',
  STATUS_HISTORY_GET_BY_PERSON: 'status-history:get-by-person',
  STATUS_HISTORY_DELETE: 'status-history:delete',

  // Attendance
  ATTENDANCE_GET_MONTH: 'attendance:get-month',
  ATTENDANCE_SET_DAY: 'attendance:set-day',
  ATTENDANCE_SNAPSHOT: 'attendance:snapshot',
  ATTENDANCE_COPY_DAY: 'attendance:copy-day',
  ATTENDANCE_BULK_SET: 'attendance:bulk-set',

  // Documents
  TEMPLATES_LIST: 'templates:list',
  TEMPLATES_GET_TAGS: 'templates:get-tags',
  DOCUMENTS_GENERATE: 'documents:generate',
  DOCUMENTS_LIST: 'documents:list',
  DOCUMENTS_OPEN: 'documents:open',
  DOCUMENTS_DELETE: 'documents:delete',

  // Orders
  ORDERS_LIST: 'orders:list',
  ORDERS_CREATE: 'orders:create',
  ORDERS_GET: 'orders:get',
  ORDERS_DELETE: 'orders:delete',

  // Leave Types (довідник)
  LEAVE_TYPES_LIST: 'leave-types:list',
  LEAVE_TYPES_RESOLVE: 'leave-types:resolve',

  // Leave
  LEAVE_LIST: 'leave:list',
  LEAVE_CREATE: 'leave:create',
  LEAVE_GET: 'leave:get',
  LEAVE_DELETE: 'leave:delete',
  LEAVE_GENERATE_TICKET: 'leave:generate-ticket',

  // Injuries
  INJURIES_LIST: 'injuries:list',
  INJURIES_CREATE: 'injuries:create',

  // Losses
  LOSSES_LIST: 'losses:list',
  LOSSES_CREATE: 'losses:create',

  // Lookups (довідники)
  RANKS_LIST: 'ranks:list',
  STATUS_TYPES_LIST: 'status-types:list',
  BLOOD_TYPES_LIST: 'blood-types:list',
  CONTRACT_TYPES_LIST: 'contract-types:list',
  EDUCATION_LEVELS_LIST: 'education-levels:list',

  // Import/Export
  OPEN_FILE_DIALOG: 'dialog:open-file',
  IMPORT_EJOOS_PREVIEW: 'import:ejoos-preview',
  IMPORT_EJOOS_CONFIRM: 'import:ejoos-confirm',
  IMPORT_DATA: 'import:data',
  IMPORT_IMPULSE: 'import:impulse',
  EXPORT_EJOOS: 'export:ejoos',
  EXPORT_CSV: 'export:csv',

  // Staff Roster (Штатний розпис)
  STAFF_ROSTER: 'staff:roster',

  // Statistics
  STATISTICS_SUMMARY: 'statistics:summary',
  STATISTICS_BY_STATUS: 'statistics:by-status',
  STATISTICS_BY_SUBDIVISION: 'statistics:by-subdivision',

  // DGV (Грошове забезпечення)
  DGV_CODES_LIST: 'dgv:codes-list',
  DGV_GET_MONTH: 'dgv:get-month',
  DGV_SET_DAY: 'dgv:set-day',
  DGV_SET_BULK: 'dgv:set-bulk',
  DGV_META_SET: 'dgv:meta-set',
  DGV_PERSON_META_SET: 'dgv:person-meta-set',
  DGV_EXPORT_REPORT: 'dgv:export-report',
  DGV_CLEAR_DAY: 'dgv:clear-day',

  // Docs (local filesystem documents & photos)
  DOCS_GET_ROOT: 'docs:get-root',
  DOCS_SET_ROOT: 'docs:set-root',
  DOCS_BROWSE_ROOT: 'docs:browse-root',
  DOCS_SCAN_PERSON: 'docs:scan-person',
  DOCS_OPEN_FILE: 'docs:open-file',
  DOCS_MISSING_REPORT: 'docs:missing-report'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
