import * as SQLite from "expo-sqlite";
import { api } from "./api";

type PendingChecklist = {
  id: number;
  payload: string;
  createdAt: string;
};

let db: SQLite.SQLiteDatabase | null = null;

async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync("kars_offline.db");
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS checklist_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
  }
  return db;
}

export async function enqueueChecklist(payload: unknown) {
  const database = await getDb();
  await database.runAsync(
    "INSERT INTO checklist_queue (payload, createdAt) VALUES (?, ?)",
    JSON.stringify(payload),
    new Date().toISOString(),
  );
}

export async function flushChecklistQueue(): Promise<number> {
  const database = await getDb();
  const rows = await database.getAllAsync<PendingChecklist>(
    "SELECT * FROM checklist_queue ORDER BY id ASC",
  );
  let synced = 0;
  for (const row of rows) {
    try {
      await api.syncChecklist(JSON.parse(row.payload));
      await database.runAsync("DELETE FROM checklist_queue WHERE id = ?", row.id);
      synced += 1;
    } catch {
      break;
    }
  }
  return synced;
}

export async function pendingCount(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM checklist_queue",
  );
  return row?.c ?? 0;
}
