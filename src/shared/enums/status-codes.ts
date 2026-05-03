export interface StatusTypeEntry {
  id: number
  code: string
  name: string
  groupName: string
  onSupply: boolean
  rewardAmount: number | null
  sortOrder: number
  colorCode: string
}

// v0.8.2: значення синхронізовані з ЕЖООС.xlsx → Налаштування → колонки
// "Код Сорт / Статус / Назва повна / СтатусГрупа / На забезпеченні / Винагорода".
// onSupply (= "На забезпеченні") зараз = "на бойовому забезпеченні підрозділу"
// — тільки 6 кодів групи "Так". ДГВ табель НЕ використовує onSupply для фільтра
// (фільтрує за currentSubdivision='Г-3'), бо у табелі мають бути всі ОС роти,
// включаючи відпустки/шпиталь — для відміток ВП/ШП по днях.
export const STATUS_TYPES: StatusTypeEntry[] = [
  // Група "Так" — присутні в підрозділі / на бойовому забезпеченні
  { id: 1, code: 'РВ', name: 'Район виконання', groupName: 'Так', onSupply: true, rewardAmount: 100000, sortOrder: 1, colorCode: '#52c41a' },
  { id: 2, code: 'РЗ', name: 'Район зосередження', groupName: 'Так', onSupply: true, rewardAmount: 30000, sortOrder: 2, colorCode: '#73d13d' },
  { id: 3, code: 'РШ', name: 'Район штаб', groupName: 'Так', onSupply: true, rewardAmount: 50000, sortOrder: 3, colorCode: '#95de64' },
  { id: 4, code: 'ППД', name: 'ППД', groupName: 'Так', onSupply: true, rewardAmount: null, sortOrder: 4, colorCode: '#b7eb8f' },
  { id: 5, code: 'АДП', name: 'Адаптація', groupName: 'Так', onSupply: true, rewardAmount: null, sortOrder: 5, colorCode: '#d9f7be' },
  { id: 21, code: 'БЗВП', name: 'БЗВП', groupName: 'Так', onSupply: true, rewardAmount: null, sortOrder: 6, colorCode: '#a0d911' },

  // Група "Відпустка"
  { id: 6, code: 'ВП', name: 'Відпустка', groupName: 'Відпустка', onSupply: false, rewardAmount: null, sortOrder: 10, colorCode: '#1890ff' },
  { id: 7, code: 'ДВП', name: 'Декретна відпустка', groupName: 'Відпустка', onSupply: false, rewardAmount: null, sortOrder: 11, colorCode: '#40a9ff' },
  { id: 8, code: 'ВПХ', name: 'Відпустка за хворобою', groupName: 'Відпустка', onSupply: false, rewardAmount: null, sortOrder: 12, colorCode: '#69c0ff' },
  { id: 9, code: 'ВПС', name: 'Відпустка по сімейним обставинам', groupName: 'Відпустка', onSupply: false, rewardAmount: null, sortOrder: 13, colorCode: '#91d5ff' },
  { id: 10, code: 'ВПП', name: 'Відпустка після поранення', groupName: 'Відпустка', onSupply: false, rewardAmount: null, sortOrder: 14, colorCode: '#bae7ff' },

  // Окремі групи безповоротних/особливих станів
  { id: 11, code: 'СЗЧ', name: 'СЗЧ', groupName: 'СЗЧ', onSupply: false, rewardAmount: null, sortOrder: 20, colorCode: '#ff4d4f' },
  { id: 12, code: '200', name: 'Загиблі', groupName: 'Загиблі', onSupply: false, rewardAmount: null, sortOrder: 30, colorCode: '#000000' },
  { id: 13, code: 'ЗБ', name: 'Без вісти', groupName: 'Зниклі безвісти', onSupply: false, rewardAmount: null, sortOrder: 31, colorCode: '#434343' },
  { id: 14, code: 'ПОЛОН', name: 'Полон', groupName: 'Полон', onSupply: false, rewardAmount: null, sortOrder: 32, colorCode: '#595959' },

  // Лікування
  { id: 15, code: 'ШП', name: 'Шпиталь', groupName: 'Лікування', onSupply: false, rewardAmount: null, sortOrder: 40, colorCode: '#faad14' },

  // Відрядження
  { id: 19, code: 'ВД', name: 'Відрядження', groupName: 'Відрядження', onSupply: false, rewardAmount: null, sortOrder: 50, colorCode: '#13c2c2' },

  // Група "Ні" — позначки табелю / спецстатуси (НП, ВБВ — заглушки для днів,
  // коли в/с ще не прибув або вже вибув; ЗВ — звільнення від обов'язків
  // за станом здоров'я; АР — арешт)
  { id: 16, code: 'НП', name: 'Не прибув', groupName: 'Ні', onSupply: false, rewardAmount: null, sortOrder: 60, colorCode: '#bfbfbf' },
  { id: 17, code: 'ВБВ', name: 'Вибув', groupName: 'Ні', onSupply: false, rewardAmount: null, sortOrder: 61, colorCode: '#d9d9d9' },
  { id: 18, code: 'ЗВ', name: "Звільнення від виконання службових обов'язків", groupName: 'Ні', onSupply: false, rewardAmount: null, sortOrder: 62, colorCode: '#8c8c8c' },
  { id: 20, code: 'АР', name: 'Арешт', groupName: 'Ні', onSupply: false, rewardAmount: null, sortOrder: 63, colorCode: '#cf1322' }
]
