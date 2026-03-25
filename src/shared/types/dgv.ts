// DGV — Додаткова грошова винагорода

export interface DgvCode {
  code: string
  name: string
  category: 'pay_100' | 'pay_30' | 'no_pay' | 'absent' | 'other'
  colorCode: string
  sortOrder: number
}

// Monthly grid row per person
export interface DgvPersonRow {
  personnelId: number
  fullName: string
  rankName: string | null
  positionTitle: string | null
  ipn: string
  days: Record<string, string | null> // YYYY-MM-DD → dgv code | null
  isTransferredOut?: boolean // transferred out of subdivision this month
  // Per-person metadata
  notes: string
  additionalGrounds: string
  punishmentReason: string
  punishmentOrder: string
}

export interface DgvMonthData {
  year: number
  month: number
  grounds100: string
  grounds30: string
  rows: DgvPersonRow[]
}

// Calculated period (consecutive days with same code)
export interface DgvPeriod {
  code: string
  dateFrom: string // DD.MM.YYYY
  dateTo: string
  dayCount: number
}

// For report generation
export interface DgvReportPerson {
  num: number
  rankNameFull: string
  fullName: string
  positionTitle: string
  ipn: string
  periods: DgvPeriod[]
  grounds: string
  notes: string
}

export interface DgvReportSection6Person {
  num: number
  rankNameFull: string
  fullName: string
  positionTitle: string
  punishmentReason: string
  punishmentOrder: string
}

export interface DgvReportSection7Person {
  num: number
  rankNameFull: string
  fullName: string
  positionTitle: string
  absenceReasons: string[]
  periods: DgvPeriod[]
}
