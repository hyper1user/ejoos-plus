import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '../shared/ipc-channels'

const api = {
  // App
  appVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_VERSION),

  // DB
  dbHealth: () => ipcRenderer.invoke(IPC.DB_HEALTH),

  // Settings
  settingsGet: (key: string) => ipcRenderer.invoke(IPC.SETTINGS_GET, key),
  settingsSet: (key: string, value: string) => ipcRenderer.invoke(IPC.SETTINGS_SET, key, value),
  settingsGetAll: () => ipcRenderer.invoke(IPC.SETTINGS_GET_ALL),

  // Personnel CRUD
  personnelList: (filters?: {
    search?: string
    subdivision?: string
    statusCode?: string
    category?: string
    status?: string
  }) => ipcRenderer.invoke(IPC.PERSONNEL_LIST, filters),
  personnelGet: (id: number) => ipcRenderer.invoke(IPC.PERSONNEL_GET, id),
  personnelCreate: (data: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.PERSONNEL_CREATE, data),
  personnelUpdate: (id: number, data: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.PERSONNEL_UPDATE, id, data),
  personnelDelete: (id: number) => ipcRenderer.invoke(IPC.PERSONNEL_DELETE, id),
  personnelSearch: (query: string) => ipcRenderer.invoke(IPC.PERSONNEL_SEARCH, query),

  // Positions CRUD
  positionsList: (filters?: {
    subdivisionId?: number
    isActive?: boolean
    search?: string
    occupancy?: string
  }) => ipcRenderer.invoke(IPC.POSITIONS_LIST, filters),
  positionsGet: (id: number) => ipcRenderer.invoke(IPC.POSITIONS_GET, id),
  positionsCreate: (data: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.POSITIONS_CREATE, data),
  positionsUpdate: (id: number, data: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.POSITIONS_UPDATE, id, data),

  // Subdivisions
  subdivisionsList: () => ipcRenderer.invoke(IPC.SUBDIVISIONS_LIST),
  subdivisionsTree: () => ipcRenderer.invoke(IPC.SUBDIVISIONS_TREE),
  subdivisionsUpdate: (id: number, data: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.SUBDIVISIONS_UPDATE, id, data),

  // Lookups
  ranksList: () => ipcRenderer.invoke(IPC.RANKS_LIST),
  statusTypesList: () => ipcRenderer.invoke(IPC.STATUS_TYPES_LIST),
  bloodTypesList: () => ipcRenderer.invoke(IPC.BLOOD_TYPES_LIST),
  contractTypesList: () => ipcRenderer.invoke(IPC.CONTRACT_TYPES_LIST),
  educationLevelsList: () => ipcRenderer.invoke(IPC.EDUCATION_LEVELS_LIST),

  // Movements
  movementsList: (filters?: {
    search?: string
    subdivision?: string
    orderType?: string
    dateFrom?: string
    dateTo?: string
    isActive?: boolean
    personnelId?: number
  }) => ipcRenderer.invoke(IPC.MOVEMENTS_LIST, filters),
  movementsCreate: (data: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.MOVEMENTS_CREATE, data),
  movementsGetByPerson: (personnelId: number) =>
    ipcRenderer.invoke(IPC.MOVEMENTS_GET_BY_PERSON, personnelId),

  // Status History
  statusHistoryList: (filters?: {
    search?: string
    statusCode?: string
    groupName?: string
    subdivision?: string
    dateFrom?: string
    dateTo?: string
    personnelId?: number
  }) => ipcRenderer.invoke(IPC.STATUS_HISTORY_LIST, filters),
  statusHistoryCreate: (data: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.STATUS_HISTORY_CREATE, data),
  statusHistoryGetByPerson: (personnelId: number) =>
    ipcRenderer.invoke(IPC.STATUS_HISTORY_GET_BY_PERSON, personnelId),
  statusHistoryDelete: (id: number): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.STATUS_HISTORY_DELETE, id),

  // Attendance
  attendanceGetMonth: (year: number, month: number, subdivisionCode?: string) =>
    ipcRenderer.invoke(IPC.ATTENDANCE_GET_MONTH, year, month, subdivisionCode),
  attendanceSetDay: (personnelId: number, date: string, statusCode: string) =>
    ipcRenderer.invoke(IPC.ATTENDANCE_SET_DAY, personnelId, date, statusCode),
  attendanceSnapshot: (date: string) => ipcRenderer.invoke(IPC.ATTENDANCE_SNAPSHOT, date),

  // Import
  openFileDialog: (filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke(IPC.OPEN_FILE_DIALOG, filters),
  importEjoosPreview: (filePath: string) => ipcRenderer.invoke(IPC.IMPORT_EJOOS_PREVIEW, filePath),
  importEjoosConfirm: (filePath: string) => ipcRenderer.invoke(IPC.IMPORT_EJOOS_CONFIRM, filePath),
  importData: (filePath: string) => ipcRenderer.invoke(IPC.IMPORT_DATA, filePath),
  importImpulse: (filePath: string) => ipcRenderer.invoke(IPC.IMPORT_IMPULSE, filePath),

  // Export
  exportEjoos: () => ipcRenderer.invoke(IPC.EXPORT_EJOOS),
  exportCsv: () => ipcRenderer.invoke(IPC.EXPORT_CSV),

  // Documents
  templatesList: () => ipcRenderer.invoke(IPC.TEMPLATES_LIST),
  templatesGetTags: (templateId: number) =>
    ipcRenderer.invoke(IPC.TEMPLATES_GET_TAGS, templateId),
  documentsGenerate: (data: {
    templateId: number
    title: string
    personnelIds?: number[]
    fields: Record<string, string>
  }) => ipcRenderer.invoke(IPC.DOCUMENTS_GENERATE, data),
  documentsList: (filters?: { documentType?: string; search?: string }) =>
    ipcRenderer.invoke(IPC.DOCUMENTS_LIST, filters),
  documentsOpen: (filePath: string) => ipcRenderer.invoke(IPC.DOCUMENTS_OPEN, filePath),
  documentsDelete: (id: number) => ipcRenderer.invoke(IPC.DOCUMENTS_DELETE, id),

  // Orders
  ordersList: (filters?: { search?: string; orderType?: string; dateFrom?: string; dateTo?: string }) =>
    ipcRenderer.invoke(IPC.ORDERS_LIST, filters),
  ordersCreate: (data: Record<string, unknown>) => ipcRenderer.invoke(IPC.ORDERS_CREATE, data),
  ordersGet: (id: number) => ipcRenderer.invoke(IPC.ORDERS_GET, id),
  ordersDelete: (id: number) => ipcRenderer.invoke(IPC.ORDERS_DELETE, id),

  // Leave Types (довідник)
  leaveTypesList: (): Promise<{ id: number; name: string; label: string; statusCode: string; colorTag: string | null; sortOrder: number }[]> =>
    ipcRenderer.invoke(IPC.LEAVE_TYPES_LIST),

  // Leave Records
  leaveList: (filters?: {
    search?: string
    leaveType?: string
    personnelId?: number
    dateFrom?: string
    dateTo?: string
  }) => ipcRenderer.invoke(IPC.LEAVE_LIST, filters),
  leaveCreate: (data: Record<string, unknown>) => ipcRenderer.invoke(IPC.LEAVE_CREATE, data),
  leaveGet: (id: number) => ipcRenderer.invoke(IPC.LEAVE_GET, id),
  leaveDelete: (id: number) => ipcRenderer.invoke(IPC.LEAVE_DELETE, id),
  leaveGenerateTicket: (id: number) => ipcRenderer.invoke(IPC.LEAVE_GENERATE_TICKET, id),

  // Staff Roster
  staffRoster: () => ipcRenderer.invoke(IPC.STAFF_ROSTER),

  // Statistics
  statisticsSummary: (subdivision?: string) => ipcRenderer.invoke(IPC.STATISTICS_SUMMARY, subdivision),
  statisticsByStatus: (subdivision?: string) => ipcRenderer.invoke(IPC.STATISTICS_BY_STATUS, subdivision),
  statisticsBySubdivision: (subdivision?: string) => ipcRenderer.invoke(IPC.STATISTICS_BY_SUBDIVISION, subdivision),

  // Updater
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterGetStatus: () => ipcRenderer.invoke('updater:get-status'),
  updaterInstall: () => ipcRenderer.invoke('updater:install'),
  updaterOnStatus: (cb: (status: unknown) => void) => {
    ipcRenderer.on('updater:status', (_e, status) => cb(status))
    return () => ipcRenderer.removeAllListeners('updater:status')
  },

  // DGV (Грошове забезпечення)
  dgvCodesList: () => ipcRenderer.invoke(IPC.DGV_CODES_LIST),
  dgvGetMonth: (year: number, month: number) =>
    ipcRenderer.invoke(IPC.DGV_GET_MONTH, year, month),
  dgvSetDay: (personnelId: number, date: string, dgvCode: string) =>
    ipcRenderer.invoke(IPC.DGV_SET_DAY, personnelId, date, dgvCode),
  dgvClearDay: (personnelId: number, date: string) =>
    ipcRenderer.invoke(IPC.DGV_CLEAR_DAY, personnelId, date),
  dgvSetBulk: (personnelId: number, dateFrom: string, dateTo: string, dgvCode: string) =>
    ipcRenderer.invoke(IPC.DGV_SET_BULK, personnelId, dateFrom, dateTo, dgvCode),
  dgvMetaSet: (yearMonth: string, metaKey: string, metaValue: string) =>
    ipcRenderer.invoke(IPC.DGV_META_SET, yearMonth, metaKey, metaValue),
  dgvPersonMetaSet: (personnelId: number, yearMonth: string, metaKey: string, metaValue: string) =>
    ipcRenderer.invoke(IPC.DGV_PERSON_META_SET, personnelId, yearMonth, metaKey, metaValue),
  dgvExportReport: (year: number, month: number) =>
    ipcRenderer.invoke(IPC.DGV_EXPORT_REPORT, year, month),

  // Docs
  docsGetRoot: (): Promise<string | null> => ipcRenderer.invoke(IPC.DOCS_GET_ROOT),
  docsSetRoot: (rootPath: string) => ipcRenderer.invoke(IPC.DOCS_SET_ROOT, rootPath),
  docsBrowseRoot: (): Promise<string | null> => ipcRenderer.invoke(IPC.DOCS_BROWSE_ROOT),
  docsScanPerson: (fullName: string): Promise<{
    files: { name: string; path: string; ext: string; category: string; isPhoto: boolean }[]
    photoPath: string | null
    folderPath: string | null
  }> => ipcRenderer.invoke(IPC.DOCS_SCAN_PERSON, fullName),
  docsOpenFile: (filePath: string) => ipcRenderer.invoke(IPC.DOCS_OPEN_FILE, filePath),
  docsMissingReport: (): Promise<{ id: number; fullName: string; subdivision: string | null; missingDocs: string[] }[]> =>
    ipcRenderer.invoke(IPC.DOCS_MISSING_REPORT)
}

export type ApiType = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
