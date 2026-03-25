import type { DgvCode } from '../types/dgv'

export const DGV_CODES: DgvCode[] = [
  { code: '100', name: 'Участь у бойових діях', category: 'pay_100', colorCode: '#52c41a', sortOrder: 1 },
  { code: '30', name: 'Участь (30 тис.)', category: 'pay_30', colorCode: '#1677ff', sortOrder: 2 },
  { code: 'н/п', name: 'Не підлягає виплаті', category: 'no_pay', colorCode: '#ff4d4f', sortOrder: 3 },
  { code: 'шп', name: 'Штатна позиція', category: 'absent', colorCode: '#faad14', sortOrder: 4 },
  { code: 'ВПХ', name: 'Відрядження', category: 'absent', colorCode: '#fa8c16', sortOrder: 5 },
  { code: 'вд', name: 'Відпустка додаткова', category: 'absent', colorCode: '#eb2f96', sortOrder: 6 },
  { code: 'вп', name: 'Відпустка після поранення', category: 'absent', colorCode: '#722ed1', sortOrder: 7 },
  { code: 'СЗЧ', name: 'Самовільне залишення частини', category: 'no_pay', colorCode: '#f5222d', sortOrder: 8 },
  { code: 'ВЛК', name: 'Військово-лікарська комісія', category: 'absent', colorCode: '#13c2c2', sortOrder: 9 },
  { code: 'ЗБ', name: 'Зник безвісті', category: 'no_pay', colorCode: '#8c8c8c', sortOrder: 10 },
  { code: 'заг', name: 'Загинув', category: 'no_pay', colorCode: '#434343', sortOrder: 11 },
  { code: 'Бух', name: 'Бухгалтерія', category: 'other', colorCode: '#597ef7', sortOrder: 12 },
  { code: 'нар', name: 'Наряд', category: 'other', colorCode: '#9254de', sortOrder: 13 },
  { code: 'п.сзч', name: 'Повернення після СЗЧ', category: 'other', colorCode: '#ff7a45', sortOrder: 14 }
]

// Quick lookup map
export const DGV_CODE_MAP = new Map(DGV_CODES.map((c) => [c.code, c]))

// Group labels for UI selects
export const DGV_CATEGORY_LABELS: Record<string, string> = {
  pay_100: 'Виплата 100 тис.',
  pay_30: 'Виплата 30 тис.',
  no_pay: 'Без виплати',
  absent: 'Відсутність',
  other: 'Інше'
}
