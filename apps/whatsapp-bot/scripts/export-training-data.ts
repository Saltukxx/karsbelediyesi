/**
 * Gold + DB (WhatsApp onaylı) → train.jsonl / val.jsonl
 * Kullanım: npm run export:training
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { prisma } from "@kars/db";
import type { Classification } from "../src/classification-types.js";
import {
  GOLD_PATH,
  TRAINING_DIR,
  exampleUserText,
  makeTuningExample,
  readJsonl,
  type TuningExample,
} from "../src/training-format.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../../.env") });
dotenv.config();

function textHash(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function writeJsonl(filePath: string, rows: TuningExample[]) {
  writeFileSync(filePath, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
}

async function fromDb(): Promise<TuningExample[]> {
  const messages = await prisma.whatsAppMessage.findMany({
    where: {
      onayDurumu: { in: ["ONAYLANDI", "OTOMATIK"] },
      icerik: { not: null },
    },
    include: {
      complaint: {
        include: {
          neighborhood: true,
          complaintType: true,
        },
      },
    },
    take: 5000,
  });

  const out: TuningExample[] = [];
  for (const m of messages) {
    const text = (m.icerik ?? "").trim();
    if (!text || text === "(medya)") continue;

    const ai = (m.aiSonuc ?? {}) as Partial<Classification>;
    const c = m.complaint;
    const label: Classification = {
      intent: (ai.intent as Classification["intent"]) ?? "sikayet",
      sikayet_turu: c?.complaintType?.name ?? ai.sikayet_turu ?? null,
      mahalle: c?.neighborhood?.name ?? ai.mahalle ?? null,
      adres: c?.acikAdres ?? ai.adres ?? null,
      aciklama_ozeti: c?.aciklama ?? ai.aciklama_ozeti ?? text.slice(0, 300),
      oncelik: c?.oncelik ?? ai.oncelik ?? "NORMAL",
      guven: typeof ai.guven === "number" ? ai.guven : 0.9,
    };
    out.push(makeTuningExample(text, label));
  }
  return out;
}

function dedupe(examples: TuningExample[]): TuningExample[] {
  const seen = new Set<string>();
  const out: TuningExample[] = [];
  for (const ex of examples) {
    const key = textHash(exampleUserText(ex));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(ex);
  }
  return out;
}

function splitTrainVal(all: TuningExample[], valRatio = 0.1) {
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  const valCount = Math.max(1, Math.floor(shuffled.length * valRatio));
  return {
    train: shuffled.slice(valCount),
    val: shuffled.slice(0, valCount),
  };
}

async function main() {
  mkdirSync(TRAINING_DIR, { recursive: true });

  const gold = readJsonl(GOLD_PATH);
  console.log(`Gold: ${gold.length} satır (${GOLD_PATH})`);

  let dbRows: TuningExample[] = [];
  try {
    dbRows = await fromDb();
    console.log(`DB: ${dbRows.length} satır`);
  } catch (err) {
    console.warn("DB export atlandı:", err instanceof Error ? err.message : err);
  }

  const fromDbPath = path.join(TRAINING_DIR, "from-db.jsonl");
  writeJsonl(fromDbPath, dbRows);

  const merged = dedupe([...gold, ...dbRows]);
  const { train, val } = splitTrainVal(merged);

  writeJsonl(path.join(TRAINING_DIR, "train.jsonl"), train);
  writeJsonl(path.join(TRAINING_DIR, "val.jsonl"), val);

  console.log(`Birleşik (dedupe): ${merged.length}`);
  console.log(`train.jsonl: ${train.length}`);
  console.log(`val.jsonl: ${val.length}`);
  if (merged.length < 50) {
    console.warn("Uyarı: 50'den az örnek — fine-tune için daha fazla etiketli veri ekleyin.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
