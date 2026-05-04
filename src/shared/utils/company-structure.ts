import type { SubdivisionTreeNode } from '../types/position'

// v0.8.3: внутрішня структура 12 ШР для віджетів орг-структури.
//
// У `subdivisions` таблиці БД 12 ШР представлена єдиним рядком (Г-3) —
// без розбиття на взводи. Розбиття відбувається лише на рівні
// `positions.position_index` (Г03NNN), за діапазонами з ЕЖООС.xlsx → ШПО.
//
// Тому дерево 12 ШР рахується на льоту за `currentPositionIdx` людини,
// а не з БД. Це достатньо для відображення (Dashboard widget, OrgStructure
// page). Для майбутніх фільтрів реєстру / експортів по взводах знадобиться
// або додавання Г-3.1..Г-3.5 до `subdivisions` + переприв'язка posіtions,
// або проштовхування `getPlatoonCodeForPerson` у бекенд-фільтри.

export type PlatoonCode = 'Г-3.1' | 'Г-3.2' | 'Г-3.3' | 'Г-3.4' | 'Г-3.5' | 'Г-3.6'

export interface PlatoonInfo {
  code: PlatoonCode
  name: string
  fullName: string
  sortOrder: number
  /** Чи приналежність визначається діапазоном positionIndex (true) або через `currentSubdivision='розпорядження'` (false) */
  rangeBased: boolean
  range?: { from: number; to: number }
  positionCount: number
}

// Розбиття 113 штатних посад 12 ШР за ЕЖООС.xlsx → ШПО:
// - Управління:    Г03001..Г03011 (11 посад)
// - 1 штурм. взвод: Г03012..Г03045 (34 — взводне управління + 3 штурмові відділення по 10)
// - 2 штурм. взвод: Г03046..Г03079 (34)
// - 3 штурм. взвод: Г03080..Г03113 (34)
export const PLATOONS: PlatoonInfo[] = [
  { code: 'Г-3.1', name: 'Управління',         fullName: 'Управління 12 ШР',          sortOrder: 1, rangeBased: true,  range: { from: 1,  to: 11  }, positionCount: 11 },
  { code: 'Г-3.2', name: '1 штурмовий взвод',   fullName: '1 штурмовий взвод 12 ШР',   sortOrder: 2, rangeBased: true,  range: { from: 12, to: 45  }, positionCount: 34 },
  { code: 'Г-3.3', name: '2 штурмовий взвод',   fullName: '2 штурмовий взвод 12 ШР',   sortOrder: 3, rangeBased: true,  range: { from: 46, to: 79  }, positionCount: 34 },
  { code: 'Г-3.4', name: '3 штурмовий взвод',   fullName: '3 штурмовий взвод 12 ШР',   sortOrder: 4, rangeBased: true,  range: { from: 80, to: 113 }, positionCount: 34 },
  { code: 'Г-3.5', name: 'Розпорядження',       fullName: 'У розпорядженні командира', sortOrder: 5, rangeBased: false, positionCount: 0 },
  { code: 'Г-3.6', name: 'Виключені',           fullName: 'Виключені зі списків',      sortOrder: 6, rangeBased: false, positionCount: 0 }
]

const COMPANY_TOTAL_POSITIONS = 113

export function getPlatoonCodeForPosition(positionIndex: string | null | undefined): PlatoonCode | null {
  if (!positionIndex) return null
  const m = String(positionIndex).match(/^Г03(\d+)$/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  for (const p of PLATOONS) {
    if (p.rangeBased && p.range && n >= p.range.from && n <= p.range.to) {
      return p.code
    }
  }
  return null
}

interface PersonForTree {
  status?: string | null
  currentSubdivision?: string | null
  currentPositionIdx?: string | null
}

// Пріоритет правил: excluded > розпорядження > range-based positionIdx.
// Excluded мають окремий 6-й вузол, незалежно від того, що залишилось у current_*
// (бо при виключенні current_* поля зберігаються як «останній відомий стан»).
export function getPlatoonCodeForPerson(person: PersonForTree): PlatoonCode | null {
  if (person.status === 'excluded') return 'Г-3.6'
  if (person.currentSubdivision === 'розпорядження') return 'Г-3.5'
  return getPlatoonCodeForPosition(person.currentPositionIdx)
}

export function buildCompanyTree(personnel: PersonForTree[]): SubdivisionTreeNode {
  const counts: Record<PlatoonCode, number> = {
    'Г-3.1': 0,
    'Г-3.2': 0,
    'Г-3.3': 0,
    'Г-3.4': 0,
    'Г-3.5': 0,
    'Г-3.6': 0
  }
  for (const p of personnel) {
    const platoon = getPlatoonCodeForPerson(p)
    if (platoon) counts[platoon]++
  }

  const children: SubdivisionTreeNode[] = PLATOONS.map((p, i) => ({
    id: 1000 + i,
    code: p.code,
    name: p.name,
    fullName: p.fullName,
    parentId: 0,
    sortOrder: p.sortOrder,
    isActive: true,
    children: [],
    personnelCount: counts[p.code],
    positionCount: p.positionCount,
    vacantCount: Math.max(0, p.positionCount - counts[p.code])
  }))

  // Root «12 ШР» — лічильник у штаті (active в роті + розпорядження),
  // БЕЗ виключених. Виключені рахуються тільки у власному 6-му вузлі.
  const inStaffCount =
    counts['Г-3.1'] + counts['Г-3.2'] + counts['Г-3.3'] + counts['Г-3.4'] + counts['Г-3.5']

  return {
    id: 0,
    code: 'Г-3',
    name: '12 ШР',
    fullName: '12 штурмова рота',
    parentId: null,
    sortOrder: 3,
    isActive: true,
    children,
    personnelCount: inStaffCount,
    positionCount: COMPANY_TOTAL_POSITIONS,
    vacantCount: Math.max(0, COMPANY_TOTAL_POSITIONS - inStaffCount)
  }
}
