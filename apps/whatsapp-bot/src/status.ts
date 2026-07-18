import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");
const STATUS_FILE = path.join(DATA_DIR, "status.json");

export type BotStatus = {
  connected: boolean;
  qrPending: boolean;
  lastSeen?: string;
  phone?: string;
};

export async function writeStatus(partial: Partial<BotStatus>) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  let current: BotStatus = { connected: false, qrPending: false };
  try {
    current = JSON.parse(await fs.readFile(STATUS_FILE, "utf8")) as BotStatus;
  } catch {
    /* first write */
  }
  const next = { ...current, ...partial, lastSeen: new Date().toISOString() };
  await fs.writeFile(STATUS_FILE, JSON.stringify(next, null, 2));
}
