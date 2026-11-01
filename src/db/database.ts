import * as SQLite from 'expo-sqlite';

const LATEST_VERSION = 4;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= LATEST_VERSION) return;

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE medications (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        dosage TEXT NOT NULL DEFAULT '',
        photo_uri TEXT,
        interval_minutes INTEGER NOT NULL,
        start_at INTEGER NOT NULL,
        days INTEGER NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE doses (
        id INTEGER PRIMARY KEY NOT NULL,
        medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
        scheduled_at INTEGER NOT NULL,
        snoozed_until INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        taken_at INTEGER
      );
      CREATE INDEX idx_doses_status_time ON doses(status, scheduled_at);
      CREATE INDEX idx_doses_med ON doses(medication_id);
    `);
  }

  if (current < 2) {
    await db.execAsync(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }

  if (current < 3) {
    await db.execAsync(`
      CREATE TABLE appointments (
        id INTEGER PRIMARY KEY NOT NULL,
        doctor TEXT NOT NULL DEFAULT '',
        specialty TEXT NOT NULL DEFAULT '',
        date INTEGER NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE recipe_photos (
        id INTEGER PRIMARY KEY NOT NULL,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        photo_uri TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_recipe_photos_appt ON recipe_photos(appointment_id);
    `);
  }

  if (current < 4) {
    await db.execAsync(`
      CREATE TABLE appointment_medications (
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
        PRIMARY KEY (appointment_id, medication_id)
      );
      CREATE INDEX idx_appt_meds_med ON appointment_medications(medication_id);
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('recuerdamed.db');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}
