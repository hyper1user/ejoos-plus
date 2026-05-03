# ЕЖООС+ — Інструкції для Claude Code

## Проєкт
Desktop-додаток для обліку особового складу 12 ШР (4 ШБ, 92 ОШБр).
Замінює Excel-файл ЕЖООС.

## Стек
- Electron 33 + React 19 + TypeScript 5
- electron-vite / Ant Design 5 + ProComponents / Tailwind CSS 4
- better-sqlite3 + Drizzle ORM / Zod / dayjs / Zustand
- SheetJS (import) + ExcelJS (export) + docxtemplater (Word)

## Команди
- `pnpm dev` — запуск у dev-режимі
- `pnpm build` — збірка
- `pnpm build:win` — збірка Windows .exe

## Структура
```
src/main/       — Electron main process (БД, сервіси, IPC)
src/renderer/   — React UI (сторінки, компоненти, store)
src/shared/     — Спільні типи, enum, валідатори
src/preload/    — contextBridge
```

## Правила
- Вся комунікація renderer↔main через IPC (Zod validated)
- Renderer НІКОЛИ не має доступу до БД
- БД файл: %APPDATA%/ejoos-plus/data/personnel.db
- Мова інтерфейсу: українська
- Мова коду/коментарів: англійська (назви змінних), українська (UI тексти)

## БД
28 таблиць (13 довідникових + 15 робочих). Schema: src/main/db/schema.ts

## Path aliases
- @shared → src/shared
- @renderer → src/renderer/src
