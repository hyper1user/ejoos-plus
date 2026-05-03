import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import * as schema from './schema'
import { seedDatabase } from './seed'

let db: ReturnType<typeof drizzle> | null = null
let sqlite: InstanceType<typeof Database> | null = null

function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  return join(dbDir, 'personnel.db')
}

export function initDatabase(): ReturnType<typeof drizzle> {
  if (db) return db

  const dbPath = getDbPath()
  console.log(`[db] Шлях до БД: ${dbPath}`)

  sqlite = new Database(dbPath)

  // Оптимізації SQLite
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')

  db = drizzle(sqlite, { schema })

  // Створюємо таблиці якщо їх немає
  createTables(sqlite)

  // Seed data
  seedDatabase(db)

  console.log('[db] База даних ініціалізована')
  return db
}

export function getDatabase(): ReturnType<typeof drizzle> {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    db = null
    console.log('[db] База даних закрита')
  }
}

// ============================================================
// DDL — єдине джерело істини для структури БД.
// Drizzle-схема (schema.ts) має відповідати цьому DDL 1:1.
// Для нових БД всі колонки створюються одразу.
// Для існуючих БД (оновлення) — migratePersonnel() додає
// відсутні колонки через ALTER TABLE.
// ============================================================
function createTables(sqliteDb: InstanceType<typeof Database>): void {
  sqliteDb.exec(`
    -- ==================== ДОВІДНИКИ ====================

    CREATE TABLE IF NOT EXISTS ranks (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      nato_code TEXT
    );

    CREATE TABLE IF NOT EXISTS status_types (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      group_name TEXT NOT NULL,
      on_supply INTEGER DEFAULT 1,
      reward_amount INTEGER,
      sort_order INTEGER NOT NULL,
      color_code TEXT
    );

    CREATE TABLE IF NOT EXISTS subdivisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      full_name TEXT,
      parent_id INTEGER REFERENCES subdivisions(id),
      sort_order INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      position_index TEXT NOT NULL UNIQUE,
      subdivision_id INTEGER NOT NULL REFERENCES subdivisions(id),
      title TEXT NOT NULL,
      detail TEXT,
      full_title TEXT,
      rank_required TEXT,
      specialty_code TEXT,
      tariff_grade INTEGER,
      staff_number TEXT,
      is_active INTEGER DEFAULT 1,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS blood_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS contract_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      months INTEGER NOT NULL,
      to_demob INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS education_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS tcc_offices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      oblast TEXT NOT NULL,
      code TEXT
    );

    CREATE TABLE IF NOT EXISTS order_issuers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS movement_order_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS exclusion_reasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS absence_reasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS loss_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS leave_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      status_code TEXT NOT NULL,
      color_tag TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS leave_type_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alias TEXT NOT NULL UNIQUE,
      leave_type_id INTEGER NOT NULL REFERENCES leave_types(id)
    );

    -- ==================== РОБОЧІ ТАБЛИЦІ ====================

    CREATE TABLE IF NOT EXISTS personnel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ipn TEXT NOT NULL UNIQUE,
      rank_id INTEGER REFERENCES ranks(id),

      last_name TEXT NOT NULL,
      first_name TEXT NOT NULL,
      patronymic TEXT,
      full_name TEXT NOT NULL,
      callsign TEXT,
      date_of_birth TEXT,
      phone TEXT,

      enrollment_order_date TEXT,
      enrollment_order_info TEXT,
      arrived_from TEXT,
      arrival_position_idx TEXT,
      enrollment_date TEXT,
      enrollment_order_num TEXT,

      current_position_idx TEXT,
      current_status_code TEXT,
      current_subdivision TEXT,

      rank_order_date TEXT,
      rank_order_info TEXT,

      service_type TEXT,
      contract_date TEXT,
      contract_type_id INTEGER REFERENCES contract_types(id),
      contract_end_date TEXT,

      id_doc_series TEXT,
      id_doc_number TEXT,
      id_doc_type TEXT,
      passport_series TEXT,
      passport_number TEXT,
      passport_issued_by TEXT,
      passport_issued_date TEXT,
      military_id_series TEXT,
      military_id_number TEXT,

      ubd_series TEXT,
      ubd_number TEXT,
      ubd_date TEXT,

      gender TEXT,
      blood_type_id INTEGER REFERENCES blood_types(id),
      fitness TEXT,
      education_level_id INTEGER REFERENCES education_levels(id),
      education_institution TEXT,
      education_year TEXT,
      military_education TEXT,

      birthplace TEXT,
      address_actual TEXT,
      address_registered TEXT,
      marital_status TEXT,
      relatives_info TEXT,
      nationality TEXT,
      citizenship TEXT,

      conscription_date TEXT,
      tcc_id INTEGER REFERENCES tcc_offices(id),
      oblast TEXT,
      personal_number TEXT,
      specialty_code TEXT,
      photo_path TEXT,

      status TEXT DEFAULT 'active',
      additional_info TEXT,
      notes TEXT,

      -- Закордонний паспорт
      foreign_passport_series TEXT,
      foreign_passport_number TEXT,
      foreign_passport_issued_by TEXT,
      foreign_passport_issued_date TEXT,

      -- ВК додатково
      military_id_issued_by TEXT,
      military_id_issued_date TEXT,

      -- УБД додатково
      ubd_issued_by TEXT,

      -- Фінансові дані
      iban TEXT,
      bank_card TEXT,
      bank_name TEXT,

      -- Посвідчення водія
      driver_license_issued_by TEXT,
      driver_license_category TEXT,
      driver_license_expiry TEXT,
      driver_license_issued_date TEXT,
      driver_license_experience INTEGER,
      driver_license_series TEXT,
      driver_license_number TEXT,

      -- Посвідчення тракториста
      tractor_license_issued_by TEXT,
      tractor_license_category TEXT,
      tractor_license_expiry TEXT,
      tractor_license_issued_date TEXT,
      tractor_license_experience INTEGER,
      tractor_license_series TEXT,
      tractor_license_number TEXT,

      -- Базова загальновійськова підготовка
      basic_training_date_from TEXT,
      basic_training_date_to TEXT,
      basic_training_place TEXT,
      basic_training_commander TEXT,
      basic_training_notes TEXT,

      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL REFERENCES personnel(id),
      order_issuer TEXT,
      order_number TEXT,
      order_date TEXT,
      order_type TEXT NOT NULL,
      position_index TEXT,
      daily_order_number TEXT,
      date_from TEXT NOT NULL,
      date_to TEXT,
      previous_position TEXT,
      is_active INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL REFERENCES personnel(id),
      status_code TEXT NOT NULL,
      presence_group TEXT,
      date_from TEXT NOT NULL,
      date_to TEXT,
      comment TEXT,
      is_active INTEGER DEFAULT 1,
      is_last INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rank_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL REFERENCES personnel(id),
      rank_id INTEGER NOT NULL REFERENCES ranks(id),
      assigned_date TEXT,
      order_number TEXT,
      order_info TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL REFERENCES personnel(id),
      date TEXT NOT NULL,
      status_code TEXT NOT NULL,
      presence_group TEXT,
      UNIQUE(personnel_id, date)
    );

    CREATE TABLE IF NOT EXISTS absences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL REFERENCES personnel(id),
      reason TEXT NOT NULL,
      location TEXT,
      departure_date TEXT,
      expected_return TEXT,
      order_number TEXT,
      order_date TEXT,
      order_issuer TEXT,
      actual_return TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS temporary_arrivals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ipn TEXT,
      rank TEXT,
      full_name TEXT NOT NULL,
      from_unit TEXT,
      position TEXT,
      arrival_date TEXT,
      departure_date TEXT,
      order_number TEXT,
      reason TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dispositions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL REFERENCES personnel(id),
      reason TEXT,
      order_number TEXT,
      order_date TEXT,
      date_from TEXT,
      date_to TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS irrecoverable_losses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL REFERENCES personnel(id),
      loss_type TEXT NOT NULL,
      loss_date TEXT,
      location TEXT,
      circumstances TEXT,
      order_number TEXT,
      order_date TEXT,
      notification_sent INTEGER DEFAULT 0,
      notification_date TEXT,
      notification_recipient TEXT,
      body_identified INTEGER,
      burial_location TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leave_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL REFERENCES personnel(id),
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      travel_days INTEGER DEFAULT 2,
      destination TEXT,
      order_number TEXT,
      order_date TEXT,
      ticket_number TEXT,
      return_date TEXT,
      tcc_registration TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS injury_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL REFERENCES personnel(id),
      injury_type TEXT NOT NULL,
      date_of_injury TEXT NOT NULL,
      location TEXT,
      circumstances TEXT,
      was_intoxicated INTEGER DEFAULT 0,
      had_protective_equipment INTEGER DEFAULT 1,
      related_to_offense INTEGER DEFAULT 0,
      forma_100_number TEXT,
      forma_100_date TEXT,
      hospital_name TEXT,
      certificate_issued INTEGER DEFAULT 0,
      certificate_date TEXT,
      order_number TEXT,
      vlk_conclusion TEXT,
      return_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_type TEXT NOT NULL,
      order_number TEXT NOT NULL,
      order_date TEXT NOT NULL,
      subject TEXT,
      body_text TEXT,
      signed_by TEXT,
      file_path TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      personnel_id INTEGER REFERENCES personnel(id),
      action_type TEXT,
      description TEXT,
      sort_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS document_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      template_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      description TEXT,
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS generated_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER REFERENCES document_templates(id),
      document_type TEXT NOT NULL,
      title TEXT,
      personnel_ids TEXT,
      file_path TEXT NOT NULL,
      generated_at TEXT DEFAULT (datetime('now'))
    );

    -- ==================== DGV (Грошове забезпечення) ====================

    CREATE TABLE IF NOT EXISTS dgv_marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL REFERENCES personnel(id),
      date TEXT NOT NULL,
      dgv_code TEXT NOT NULL,
      UNIQUE(personnel_id, date)
    );

    CREATE TABLE IF NOT EXISTS dgv_month_meta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL DEFAULT 0,
      year_month TEXT NOT NULL,
      meta_key TEXT NOT NULL,
      meta_value TEXT NOT NULL,
      UNIQUE(personnel_id, year_month, meta_key)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    -- ==================== ІНДЕКСИ ====================
    CREATE INDEX IF NOT EXISTS idx_personnel_ipn ON personnel(ipn);
    CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel(status);
    CREATE INDEX IF NOT EXISTS idx_personnel_position ON personnel(current_position_idx);
    CREATE INDEX IF NOT EXISTS idx_personnel_subdivision ON personnel(current_subdivision);
    CREATE INDEX IF NOT EXISTS idx_movements_personnel ON movements(personnel_id);
    CREATE INDEX IF NOT EXISTS idx_movements_position ON movements(position_index);
    CREATE INDEX IF NOT EXISTS idx_movements_active ON movements(is_active);
    CREATE INDEX IF NOT EXISTS idx_status_history_personnel ON status_history(personnel_id);
    CREATE INDEX IF NOT EXISTS idx_status_history_active ON status_history(is_active);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_personnel_date ON attendance(personnel_id, date);
    CREATE INDEX IF NOT EXISTS idx_rank_history_personnel ON rank_history(personnel_id);
    CREATE INDEX IF NOT EXISTS idx_absences_personnel ON absences(personnel_id);
    CREATE INDEX IF NOT EXISTS idx_leave_records_personnel ON leave_records(personnel_id);
    CREATE INDEX IF NOT EXISTS idx_injury_records_personnel ON injury_records(personnel_id);
    CREATE INDEX IF NOT EXISTS idx_orders_type_date ON orders(order_type, order_date);
    CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log(table_name, record_id);
    CREATE INDEX IF NOT EXISTS idx_positions_subdivision ON positions(subdivision_id);
    CREATE INDEX IF NOT EXISTS idx_dgv_marks_date ON dgv_marks(date);
    CREATE INDEX IF NOT EXISTS idx_dgv_marks_personnel_date ON dgv_marks(personnel_id, date);
    CREATE INDEX IF NOT EXISTS idx_dgv_meta_yearmonth ON dgv_month_meta(year_month);
  `)

  console.log('[db] Таблиці та індекси створено')

  // Міграція для існуючих БД: додаємо колонки, яких може не бути
  // у БД створених до v0.4.0 (ці колонки вже включені в CREATE TABLE
  // вище, тому для нових БД ALTER TABLE не спрацює — і це нормально)
  migratePersonnel(sqliteDb)

  // v0.7.1: fix personnel whose active movement is "В розпорядження"
  // but currentSubdivision was never updated
  fixDispositionSubdivisions(sqliteDb)

  // v0.8.1: rename unit "12 ОШР" → "12 ШР" in settings (correct abbreviation
  // for "штурмова рота" — not "окрема штурмова рота")
  fixUnitNameOshrToShr(sqliteDb)
}

function migratePersonnel(sqliteDb: InstanceType<typeof Database>): void {
  const expectedColumns: [string, string][] = [
    ['foreign_passport_series', 'TEXT'],
    ['foreign_passport_number', 'TEXT'],
    ['foreign_passport_issued_by', 'TEXT'],
    ['foreign_passport_issued_date', 'TEXT'],
    ['military_id_issued_by', 'TEXT'],
    ['military_id_issued_date', 'TEXT'],
    ['ubd_issued_by', 'TEXT'],
    ['iban', 'TEXT'],
    ['bank_card', 'TEXT'],
    ['bank_name', 'TEXT'],
    ['driver_license_issued_by', 'TEXT'],
    ['driver_license_category', 'TEXT'],
    ['driver_license_expiry', 'TEXT'],
    ['driver_license_issued_date', 'TEXT'],
    ['driver_license_experience', 'INTEGER'],
    ['driver_license_series', 'TEXT'],
    ['driver_license_number', 'TEXT'],
    ['tractor_license_issued_by', 'TEXT'],
    ['tractor_license_category', 'TEXT'],
    ['tractor_license_expiry', 'TEXT'],
    ['tractor_license_issued_date', 'TEXT'],
    ['tractor_license_experience', 'INTEGER'],
    ['tractor_license_series', 'TEXT'],
    ['tractor_license_number', 'TEXT'],
    ['basic_training_date_from', 'TEXT'],
    ['basic_training_date_to', 'TEXT'],
    ['basic_training_place', 'TEXT'],
    ['basic_training_commander', 'TEXT'],
    ['basic_training_notes', 'TEXT']
  ]

  const existingCols = sqliteDb
    .prepare('PRAGMA table_info(personnel)')
    .all() as { name: string }[]
  const existingColNames = new Set(existingCols.map((c) => c.name))

  let migrated = 0
  for (const [col, type] of expectedColumns) {
    if (!existingColNames.has(col)) {
      sqliteDb.exec(`ALTER TABLE personnel ADD COLUMN ${col} ${type}`)
      migrated++
    }
  }
  if (migrated > 0) {
    console.log(`[db] Міграція personnel: додано ${migrated} колонок`)
  }
}

function fixDispositionSubdivisions(sqliteDb: InstanceType<typeof Database>): void {
  const fixed = sqliteDb.exec(`
    UPDATE personnel SET
      current_subdivision = 'розпорядження',
      current_position_idx = 'розпоряджен'
    WHERE id IN (
      SELECT m.personnel_id FROM movements m
      WHERE m.is_active = 1
        AND m.order_type LIKE 'В розпорядження%'
    )
    AND current_subdivision != 'розпорядження'
  `)
  const changes = sqliteDb.prepare('SELECT changes() as cnt').get() as { cnt: number }
  if (changes.cnt > 0) {
    console.log(`[db] fixDispositionSubdivisions: виправлено ${changes.cnt} записів`)
  }
}

function fixUnitNameOshrToShr(sqliteDb: InstanceType<typeof Database>): void {
  sqliteDb.exec(`
    UPDATE settings
    SET value = '12 ШР "Хижаки"'
    WHERE key = 'unit_name' AND value = '12 ОШР "Хижаки"'
  `)
  const changes = sqliteDb.prepare('SELECT changes() as cnt').get() as { cnt: number }
  if (changes.cnt > 0) {
    console.log(`[db] fixUnitNameOshrToShr: оновлено settings.unit_name на "12 ШР"`)
  }
}
