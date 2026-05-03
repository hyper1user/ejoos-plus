import { create } from 'zustand'
import dayjs from 'dayjs'

// Додаток працює лише для 12 ШР (код підрозділу у БД)
export const HOME_SUBDIVISION = 'Г-3'

interface AppState {
  currentMonth: string // YYYY-MM
  unitName: string
  dbConnected: boolean
  sidebarCollapsed: boolean
  globalSubdivision: string // завжди 'Г-3'

  setCurrentMonth: (month: string) => void
  setUnitName: (name: string) => void
  setDbConnected: (connected: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentMonth: dayjs().format('YYYY-MM'),
  unitName: '12 ШР "Хижаки"',
  dbConnected: false,
  sidebarCollapsed: false,
  globalSubdivision: HOME_SUBDIVISION,

  setCurrentMonth: (month) => set({ currentMonth: month }),
  setUnitName: (name) => set({ unitName: name }),
  setDbConnected: (connected) => set({ dbConnected: connected }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed })
}))
