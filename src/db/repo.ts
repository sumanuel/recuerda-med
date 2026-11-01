import { getDb } from './database';
import { DAY, MINUTE, SNOOZE_MINUTES, buildSchedule } from '../lib/time';

export type Medication = {
  id: number;
  name: string;
  dosage: string;
  photo_uri: string | null;
  interval_minutes: number;
  start_at: number;
  days: number;
  active: number;
  created_at: number;
};

export type MedicationSummary = Medication & {
  total: number;
  taken: number;
  /** Tomas pendientes cuya hora ya pasó. */
  overdue: number;
  next_at: number | null;
};

export type TakenDose = {
  id: number;
  medication_id: number;
  scheduled_at: number;
  taken_at: number;
};

export type DoseWithMed = {
  id: number;
  medication_id: number;
  scheduled_at: number;
  snoozed_until: number | null;
  status: 'pending' | 'taken';
  taken_at: number | null;
  name: string;
  dosage: string;
  photo_uri: string | null;
  interval_minutes: number;
  /** Hora efectiva de la alarma: la posposición si existe, si no la programada. */
  fire_at: number;
};

export type MedicationInput = {
  name: string;
  dosage: string;
  photoUri: string | null;
  intervalMinutes: number;
  startAt: number;
  days: number;
};

const DOSE_SELECT = `
  SELECT d.*, m.name, m.dosage, m.photo_uri, m.interval_minutes,
         COALESCE(d.snoozed_until, d.scheduled_at) AS fire_at
  FROM doses d JOIN medications m ON m.id = d.medication_id
`;

export async function listMedications(now = Date.now()): Promise<MedicationSummary[]> {
  const db = await getDb();
  return db.getAllAsync<MedicationSummary>(
    `SELECT m.*,
      (SELECT COUNT(*) FROM doses WHERE medication_id = m.id) AS total,
      (SELECT COUNT(*) FROM doses WHERE medication_id = m.id AND status = 'taken') AS taken,
      (SELECT COUNT(*) FROM doses WHERE medication_id = m.id AND status = 'pending'
         AND COALESCE(snoozed_until, scheduled_at) <= ?) AS overdue,
      (SELECT MIN(COALESCE(snoozed_until, scheduled_at)) FROM doses
         WHERE medication_id = m.id AND status = 'pending'
           AND COALESCE(snoozed_until, scheduled_at) > ?) AS next_at
    FROM medications m
    ORDER BY m.created_at DESC`,
    now, now,
  );
}

/** Tomas registradas, más recientes primero. */
export async function listTakenDoses(): Promise<TakenDose[]> {
  const db = await getDb();
  return db.getAllAsync<TakenDose>(
    `SELECT id, medication_id, scheduled_at, taken_at FROM doses
     WHERE status = 'taken' ORDER BY taken_at DESC`,
  );
}

/** Tomas programadas para hoy y cuántas ya se registraron. */
export async function getTodayStats(): Promise<{ total: number; taken: number }> {
  const db = await getDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const row = await db.getFirstAsync<{ total: number; taken: number }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(status = 'taken'), 0) AS taken FROM doses
     WHERE scheduled_at >= ? AND scheduled_at < ?`,
    start.getTime(), start.getTime() + DAY,
  );
  return row ?? { total: 0, taken: 0 };
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}

export async function getMedication(id: number): Promise<Medication | null> {
  const db = await getDb();
  return db.getFirstAsync<Medication>('SELECT * FROM medications WHERE id = ?', id);
}

export async function createMedication(input: MedicationInput): Promise<number> {
  const db = await getDb();
  let id = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const res = await txn.runAsync(
      `INSERT INTO medications (name, dosage, photo_uri, interval_minutes, start_at, days, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      input.name, input.dosage, input.photoUri, input.intervalMinutes, input.startAt, input.days, Date.now(),
    );
    id = res.lastInsertRowId;
    for (const t of buildSchedule(input.startAt, input.intervalMinutes, input.days)) {
      await txn.runAsync('INSERT INTO doses (medication_id, scheduled_at) VALUES (?, ?)', id, t);
    }
  });
  return id;
}

/** Actualiza el medicamento y regenera las tomas futuras pendientes (las ya tomadas se conservan). */
export async function updateMedication(id: number, input: MedicationInput): Promise<void> {
  const db = await getDb();
  const prev = await getMedication(id);
  const scheduleChanged =
    !prev ||
    prev.interval_minutes !== input.intervalMinutes ||
    prev.start_at !== input.startAt ||
    prev.days !== input.days;
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE medications SET name = ?, dosage = ?, photo_uri = ?, interval_minutes = ?, start_at = ?, days = ?
       WHERE id = ?`,
      input.name, input.dosage, input.photoUri, input.intervalMinutes, input.startAt, input.days, id,
    );
    // Solo nombre/dosis/foto: se conservan los horarios (incluidos los redefinidos).
    if (!scheduleChanged) return;
    await txn.runAsync("DELETE FROM doses WHERE medication_id = ? AND status = 'pending'", id);
    const now = Date.now();
    for (const t of buildSchedule(input.startAt, input.intervalMinutes, input.days)) {
      if (t >= now) await txn.runAsync('INSERT INTO doses (medication_id, scheduled_at) VALUES (?, ?)', id, t);
    }
  });
}

export async function deleteMedication(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM medications WHERE id = ?', id);
}

export async function getDose(id: number): Promise<DoseWithMed | null> {
  const db = await getDb();
  return db.getFirstAsync<DoseWithMed>(`${DOSE_SELECT} WHERE d.id = ?`, id);
}

/** Tomas pendientes cuya hora ya llegó (alarmas que sonaron y siguen sin atender). */
export async function listDueDoses(now = Date.now()): Promise<DoseWithMed[]> {
  const db = await getDb();
  return db.getAllAsync<DoseWithMed>(
    `${DOSE_SELECT} WHERE d.status = 'pending' AND COALESCE(d.snoozed_until, d.scheduled_at) <= ?
     ORDER BY fire_at`,
    now,
  );
}

export async function listUpcomingDoses(limit: number, now = Date.now()): Promise<DoseWithMed[]> {
  const db = await getDb();
  return db.getAllAsync<DoseWithMed>(
    `${DOSE_SELECT} WHERE d.status = 'pending' AND m.active = 1
       AND COALESCE(d.snoozed_until, d.scheduled_at) > ?
     ORDER BY fire_at LIMIT ?`,
    now, limit,
  );
}

/** Siguiente toma pendiente del mismo medicamento, posterior a `dose`. */
export async function getNextDose(dose: DoseWithMed): Promise<DoseWithMed | null> {
  const db = await getDb();
  return db.getFirstAsync<DoseWithMed>(
    `${DOSE_SELECT} WHERE d.medication_id = ? AND d.status = 'pending' AND d.scheduled_at > ?
     ORDER BY d.scheduled_at LIMIT 1`,
    dose.medication_id, dose.scheduled_at,
  );
}

export async function snoozeDose(id: number): Promise<number> {
  const db = await getDb();
  const until = Date.now() + SNOOZE_MINUTES * MINUTE;
  await db.runAsync('UPDATE doses SET snoozed_until = ? WHERE id = ? AND status = ?', until, id, 'pending');
  return until;
}

/**
 * Marca la toma como realizada. Con `redefine`, las tomas siguientes se desplazan
 * por la diferencia entre la hora real y la programada, de modo que la próxima
 * quede a un intervalo completo desde ahora; si no, se mantienen los horarios originales.
 */
export async function markTaken(id: number, redefine: boolean): Promise<void> {
  const db = await getDb();
  const dose = await getDose(id);
  if (!dose || dose.status === 'taken') return;
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      "UPDATE doses SET status = 'taken', taken_at = ?, snoozed_until = NULL WHERE id = ?",
      now, id,
    );
    if (redefine) {
      await txn.runAsync(
        `UPDATE doses SET scheduled_at = scheduled_at + ?, snoozed_until = NULL
         WHERE medication_id = ? AND status = 'pending' AND scheduled_at > ?`,
        now - dose.scheduled_at, dose.medication_id, dose.scheduled_at,
      );
    }
  });
}

// ---- Recetas: citas médicas y sus fotos ----

export type Appointment = {
  id: number;
  doctor: string;
  specialty: string;
  date: number;
  notes: string;
  created_at: number;
};

export type RecipePhoto = {
  id: number;
  appointment_id: number;
  photo_uri: string;
  created_at: number;
};

export type LinkedMedication = { id: number; name: string };

export type AppointmentWithPhotos = Appointment & {
  photos: RecipePhoto[];
  medications: LinkedMedication[];
};

export type AppointmentInput = {
  doctor: string;
  specialty: string;
  date: number;
  notes: string;
};

export async function listAppointments(): Promise<AppointmentWithPhotos[]> {
  const db = await getDb();
  const [appointments, photos, links] = await Promise.all([
    db.getAllAsync<Appointment>('SELECT * FROM appointments ORDER BY date DESC, id DESC'),
    db.getAllAsync<RecipePhoto>('SELECT * FROM recipe_photos ORDER BY id'),
    db.getAllAsync<LinkedMedication & { appointment_id: number }>(
      `SELECT am.appointment_id, m.id, m.name FROM appointment_medications am
       JOIN medications m ON m.id = am.medication_id ORDER BY m.name`,
    ),
  ]);
  const photosBy = new Map<number, RecipePhoto[]>();
  for (const p of photos) {
    const list = photosBy.get(p.appointment_id);
    if (list) list.push(p);
    else photosBy.set(p.appointment_id, [p]);
  }
  const medsBy = new Map<number, LinkedMedication[]>();
  for (const l of links) {
    const med = { id: l.id, name: l.name };
    const list = medsBy.get(l.appointment_id);
    if (list) list.push(med);
    else medsBy.set(l.appointment_id, [med]);
  }
  return appointments.map((a) => ({
    ...a,
    photos: photosBy.get(a.id) ?? [],
    medications: medsBy.get(a.id) ?? [],
  }));
}

/** Citas (sin fotos) vinculadas a un medicamento, más recientes primero. */
export async function listAppointmentsForMedication(medicationId: number): Promise<Appointment[]> {
  const db = await getDb();
  return db.getAllAsync<Appointment>(
    `SELECT a.* FROM appointments a
     JOIN appointment_medications am ON am.appointment_id = a.id
     WHERE am.medication_id = ? ORDER BY a.date DESC, a.id DESC`,
    medicationId,
  );
}

export async function getAppointment(id: number): Promise<AppointmentWithPhotos | null> {
  const db = await getDb();
  const appointment = await db.getFirstAsync<Appointment>('SELECT * FROM appointments WHERE id = ?', id);
  if (!appointment) return null;
  const photos = await db.getAllAsync<RecipePhoto>(
    'SELECT * FROM recipe_photos WHERE appointment_id = ? ORDER BY id',
    id,
  );
  const medications = await db.getAllAsync<LinkedMedication>(
    `SELECT m.id, m.name FROM appointment_medications am
     JOIN medications m ON m.id = am.medication_id WHERE am.appointment_id = ? ORDER BY m.name`,
    id,
  );
  return { ...appointment, photos, medications };
}

export async function createAppointment(
  input: AppointmentInput,
  photoUris: string[],
  medicationIds: number[],
): Promise<number> {
  const db = await getDb();
  let id = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const res = await txn.runAsync(
      'INSERT INTO appointments (doctor, specialty, date, notes, created_at) VALUES (?, ?, ?, ?, ?)',
      input.doctor, input.specialty, input.date, input.notes, Date.now(),
    );
    id = res.lastInsertRowId;
    for (const uri of photoUris) {
      await txn.runAsync(
        'INSERT INTO recipe_photos (appointment_id, photo_uri, created_at) VALUES (?, ?, ?)',
        id, uri, Date.now(),
      );
    }
    for (const medId of medicationIds) {
      await txn.runAsync(
        'INSERT INTO appointment_medications (appointment_id, medication_id) VALUES (?, ?)',
        id, medId,
      );
    }
  });
  return id;
}

export async function updateAppointment(
  id: number,
  input: AppointmentInput,
  addUris: string[],
  removeIds: number[],
  medicationIds: number[],
): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'UPDATE appointments SET doctor = ?, specialty = ?, date = ?, notes = ? WHERE id = ?',
      input.doctor, input.specialty, input.date, input.notes, id,
    );
    await txn.runAsync('DELETE FROM appointment_medications WHERE appointment_id = ?', id);
    for (const medId of medicationIds) {
      await txn.runAsync(
        'INSERT INTO appointment_medications (appointment_id, medication_id) VALUES (?, ?)',
        id, medId,
      );
    }
    for (const photoId of removeIds) {
      await txn.runAsync('DELETE FROM recipe_photos WHERE id = ? AND appointment_id = ?', photoId, id);
    }
    for (const uri of addUris) {
      await txn.runAsync(
        'INSERT INTO recipe_photos (appointment_id, photo_uri, created_at) VALUES (?, ?, ?)',
        id, uri, Date.now(),
      );
    }
  });
}

export async function deleteAppointment(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM appointments WHERE id = ?', id);
}
