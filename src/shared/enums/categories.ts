export enum ServiceType {
  Mobilized = 'мобілізований',
  Contract = 'контракт',
  Volunteer = 'доброволець',
  Conscript = 'строковик',
  Civilian = 'працівник'
}

export enum PersonnelStatus {
  Active = 'active',
  Excluded = 'excluded',
  Disposed = 'disposed'
}

export enum Gender {
  Male = 'ч',
  Female = 'ж'
}

export const BLOOD_TYPES = [
  'O(I) Rh+',
  'O(I) Rh-',
  'A(II) Rh+',
  'A(II) Rh-',
  'B(III) Rh+',
  'B(III) Rh-',
  'AB(IV) Rh+',
  'AB(IV) Rh-',
  'Невідомо'
] as const

export const CONTRACT_TYPES = [
  { name: '6 місяців', months: 6, toDemob: false },
  { name: '1 рік', months: 12, toDemob: false },
  { name: '18 місяців', months: 18, toDemob: false },
  { name: '2 роки', months: 24, toDemob: false },
  { name: '3 роки', months: 36, toDemob: false },
  { name: '5 років', months: 60, toDemob: false },
  { name: 'До демобілізації', months: 0, toDemob: true },
  { name: 'До кінця ВС', months: 0, toDemob: true },
  { name: 'До кінця ОВП', months: 0, toDemob: true },
  { name: 'Без контракту', months: 0, toDemob: false }
] as const

export const EDUCATION_LEVELS = [
  'Базова середня',
  'Повна загальна середня',
  'Професійно-технічна',
  'Фахова передвища',
  'Початковий рівень (короткий цикл)',
  'Бакалавр',
  'Магістр',
  'Доктор філософії',
  'Доктор наук'
] as const

export const ORDER_ISSUERS = [
  'Командир А0501',
  'Командир А1314',
  'Командир А0000',
  'ГК ЗСУ',
  'Командувач СВ',
  'Командувач ОТУ',
  'Начальник ГШ',
  'Міноборони'
] as const

export const MOVEMENT_ORDER_TYPES = [
  'Переміщення',
  'В розпорядження',
  'Прикомандирування',
  'Переведення',
  'Зарахування',
  'Виключення',
  'Відновлення'
] as const

export const EXCLUSION_REASONS = [
  'Звільнення з військової служби',
  'Переведення до іншої в/ч',
  'Загибель',
  'Зникнення безвісти',
  'Полон',
  'Дезертирство',
  'Смерть від хвороби',
  'Виключення за рішенням суду',
  'Інше'
] as const

export const ABSENCE_REASONS = [
  'Відпустка',
  'Відрядження',
  'Лікування',
  'Навчання',
  'Командирський збір',
  'Арешт',
  'СЗЧ (самовільне залишення)',
  'Виконання бойового завдання',
  'За розпорядженням',
  'Інше'
] as const

export const LOSS_TYPES = [
  'Загинув у бою',
  'Помер від поранень',
  'Зниклий безвісти',
  'Полон',
  'Помер від хвороби'
] as const

export const SUBDIVISIONS = [
  { code: 'Г-0', name: 'Управління', fullName: 'Управління батальйону', parentCode: null, sortOrder: 0 },
  { code: 'Г-1', name: '10 ШР', fullName: '10 штурмова рота', parentCode: 'Г-0', sortOrder: 1 },
  { code: 'Г-2', name: '11 ШР', fullName: '11 штурмова рота', parentCode: 'Г-0', sortOrder: 2 },
  { code: 'Г-3', name: '12 ШР', fullName: '12 штурмова рота', parentCode: 'Г-0', sortOrder: 3 },
  { code: 'Г-4', name: '1 МБ', fullName: '1 мінометна батарея', parentCode: 'Г-0', sortOrder: 4 },
  { code: 'Г-5', name: '2 МБ', fullName: '2 мінометна батарея', parentCode: 'Г-0', sortOrder: 5 },
  { code: 'Г-6', name: 'ГРВ', fullName: 'Гранатометний розрахунково-вогневий взвод', parentCode: 'Г-0', sortOrder: 6 },
  { code: 'Г-7', name: 'ПТВ', fullName: 'Протитанковий взвод', parentCode: 'Г-0', sortOrder: 7 },
  { code: 'Г-8', name: 'ВПРК', fullName: 'Взвод протиракетних комплексів', parentCode: 'Г-0', sortOrder: 8 },
  { code: 'Г-9', name: 'КВ', fullName: 'Комунікаційний взвод', parentCode: 'Г-0', sortOrder: 9 },
  { code: 'Г-10', name: 'РБАК', fullName: 'Розвідувально-бойовий авіаційний комплекс', parentCode: 'Г-0', sortOrder: 10 },
  { code: 'Г-11', name: 'ЗРВ', fullName: 'Зенітний ракетний взвод', parentCode: 'Г-0', sortOrder: 11 },
  { code: 'Г-12', name: 'РВ', fullName: 'Розвідувальний взвод', parentCode: 'Г-0', sortOrder: 12 },
  { code: 'Г-13', name: 'ІСВ', fullName: 'Інженерно-саперний взвод', parentCode: 'Г-0', sortOrder: 13 },
  { code: 'Г-14', name: 'ВРБ', fullName: 'Взвод радіоелектронної боротьби', parentCode: 'Г-0', sortOrder: 14 },
  { code: 'Г-15', name: 'ВЗ', fullName: 'Взвод забезпечення', parentCode: 'Г-0', sortOrder: 15 },
  { code: 'Г-16', name: 'ВТЗ', fullName: 'Взвод технічного забезпечення', parentCode: 'Г-0', sortOrder: 16 },
  { code: 'Г-17', name: 'ВМЗ', fullName: 'Взвод матеріального забезпечення', parentCode: 'Г-0', sortOrder: 17 },
  { code: 'Г-18', name: 'МП', fullName: 'Медичний пункт', parentCode: 'Г-0', sortOrder: 18 },
  { code: 'К', name: 'РВП', fullName: 'Резерв військового поповнення', parentCode: null, sortOrder: 19 },
  { code: 'РОЗП', name: 'Розпорядження', fullName: 'В розпорядженні командира', parentCode: null, sortOrder: 20 }
] as const

// Seed positions: key command/staff positions for 12 ШР
export const SEED_POSITIONS = [
  // Управління
  { positionIndex: 'Г03001', subdivisionCode: 'Г-0', title: 'Командир батальйону', rankRequired: 'капітан', sortOrder: 1 },
  { positionIndex: 'Г03002', subdivisionCode: 'Г-0', title: 'Начальник штабу', rankRequired: 'капітан', sortOrder: 2 },
  { positionIndex: 'Г03003', subdivisionCode: 'Г-0', title: 'Заступник командира батальйону', rankRequired: 'старший лейтенант', sortOrder: 3 },
  { positionIndex: 'Г03004', subdivisionCode: 'Г-0', title: 'Заступник командира з озброєння', rankRequired: 'старший лейтенант', sortOrder: 4 },
  { positionIndex: 'Г03005', subdivisionCode: 'Г-0', title: 'Заступник командира з тилу', rankRequired: 'старший лейтенант', sortOrder: 5 },
  { positionIndex: 'Г03006', subdivisionCode: 'Г-0', title: 'Старшина батальйону', rankRequired: 'старший сержант', sortOrder: 6 },
  { positionIndex: 'Г03007', subdivisionCode: 'Г-0', title: 'Діловод', rankRequired: 'солдат', sortOrder: 7 },
  // 10 ШР
  { positionIndex: 'Г03101', subdivisionCode: 'Г-1', title: 'Командир роти', rankRequired: 'старший лейтенант', sortOrder: 10 },
  { positionIndex: 'Г03102', subdivisionCode: 'Г-1', title: 'Заступник командира роти', rankRequired: 'лейтенант', sortOrder: 11 },
  { positionIndex: 'Г03103', subdivisionCode: 'Г-1', title: 'Старшина роти', rankRequired: 'старший сержант', sortOrder: 12 },
  { positionIndex: 'Г03104', subdivisionCode: 'Г-1', title: 'Командир 1 взводу', rankRequired: 'лейтенант', sortOrder: 13 },
  { positionIndex: 'Г03105', subdivisionCode: 'Г-1', title: 'Командир 2 взводу', rankRequired: 'лейтенант', sortOrder: 14 },
  { positionIndex: 'Г03106', subdivisionCode: 'Г-1', title: 'Командир 3 взводу', rankRequired: 'лейтенант', sortOrder: 15 },
  // 11 ШР
  { positionIndex: 'Г03201', subdivisionCode: 'Г-2', title: 'Командир роти', rankRequired: 'старший лейтенант', sortOrder: 20 },
  { positionIndex: 'Г03202', subdivisionCode: 'Г-2', title: 'Заступник командира роти', rankRequired: 'лейтенант', sortOrder: 21 },
  { positionIndex: 'Г03203', subdivisionCode: 'Г-2', title: 'Старшина роти', rankRequired: 'старший сержант', sortOrder: 22 },
  { positionIndex: 'Г03204', subdivisionCode: 'Г-2', title: 'Командир 1 взводу', rankRequired: 'лейтенант', sortOrder: 23 },
  { positionIndex: 'Г03205', subdivisionCode: 'Г-2', title: 'Командир 2 взводу', rankRequired: 'лейтенант', sortOrder: 24 },
  { positionIndex: 'Г03206', subdivisionCode: 'Г-2', title: 'Командир 3 взводу', rankRequired: 'лейтенант', sortOrder: 25 },
  // 12 ШР
  { positionIndex: 'Г03301', subdivisionCode: 'Г-3', title: 'Командир роти', rankRequired: 'старший лейтенант', sortOrder: 30 },
  { positionIndex: 'Г03302', subdivisionCode: 'Г-3', title: 'Заступник командира роти', rankRequired: 'лейтенант', sortOrder: 31 },
  { positionIndex: 'Г03303', subdivisionCode: 'Г-3', title: 'Старшина роти', rankRequired: 'старший сержант', sortOrder: 32 },
  { positionIndex: 'Г03304', subdivisionCode: 'Г-3', title: 'Командир 1 взводу', rankRequired: 'лейтенант', sortOrder: 33 },
  { positionIndex: 'Г03305', subdivisionCode: 'Г-3', title: 'Командир 2 взводу', rankRequired: 'лейтенант', sortOrder: 34 },
  { positionIndex: 'Г03306', subdivisionCode: 'Г-3', title: 'Командир 3 взводу', rankRequired: 'лейтенант', sortOrder: 35 },
  // 1 МБ
  { positionIndex: 'Г03401', subdivisionCode: 'Г-4', title: 'Командир батареї', rankRequired: 'старший лейтенант', sortOrder: 40 },
  { positionIndex: 'Г03402', subdivisionCode: 'Г-4', title: 'Старший офіцер батареї', rankRequired: 'лейтенант', sortOrder: 41 },
  // 2 МБ
  { positionIndex: 'Г03501', subdivisionCode: 'Г-5', title: 'Командир батареї', rankRequired: 'старший лейтенант', sortOrder: 50 },
  { positionIndex: 'Г03502', subdivisionCode: 'Г-5', title: 'Старший офіцер батареї', rankRequired: 'лейтенант', sortOrder: 51 },
  // Інші підрозділи — командири
  { positionIndex: 'Г03601', subdivisionCode: 'Г-6', title: 'Командир взводу', rankRequired: 'лейтенант', sortOrder: 60 },
  { positionIndex: 'Г03701', subdivisionCode: 'Г-7', title: 'Командир взводу', rankRequired: 'лейтенант', sortOrder: 70 },
  { positionIndex: 'Г03801', subdivisionCode: 'Г-8', title: 'Командир взводу', rankRequired: 'лейтенант', sortOrder: 80 },
  { positionIndex: 'Г03901', subdivisionCode: 'Г-9', title: 'Командир взводу', rankRequired: 'лейтенант', sortOrder: 90 },
  { positionIndex: 'Г031001', subdivisionCode: 'Г-10', title: 'Командир взводу', rankRequired: 'лейтенант', sortOrder: 100 },
  { positionIndex: 'Г031101', subdivisionCode: 'Г-11', title: 'Командир взводу', rankRequired: 'лейтенант', sortOrder: 110 },
  { positionIndex: 'Г031201', subdivisionCode: 'Г-12', title: 'Командир взводу', rankRequired: 'лейтенант', sortOrder: 120 },
  { positionIndex: 'Г031301', subdivisionCode: 'Г-13', title: 'Командир взводу', rankRequired: 'лейтенант', sortOrder: 130 },
  { positionIndex: 'Г031401', subdivisionCode: 'Г-14', title: 'Командир взводу', rankRequired: 'лейтенант', sortOrder: 140 },
  { positionIndex: 'Г031501', subdivisionCode: 'Г-15', title: 'Командир взводу', rankRequired: 'прапорщик', sortOrder: 150 },
  { positionIndex: 'Г031601', subdivisionCode: 'Г-16', title: 'Командир взводу', rankRequired: 'прапорщик', sortOrder: 160 },
  { positionIndex: 'Г031701', subdivisionCode: 'Г-17', title: 'Командир взводу', rankRequired: 'прапорщик', sortOrder: 170 },
  { positionIndex: 'Г031801', subdivisionCode: 'Г-18', title: 'Начальник медичного пункту', rankRequired: 'лейтенант', sortOrder: 180 },
] as const
