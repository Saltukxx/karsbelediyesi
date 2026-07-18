/**
 * val.jsonl (yoksa gold) üzerinde classifyMessage değerlendirmesi.
 * Kullanım: npm run eval:ai
 */
import { writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { classifyMessage } from "../src/classify.js";
import {
  GOLD_PATH,
  TRAINING_DIR,
  exampleLabel,
  exampleUserText,
  readJsonl,
} from "../src/training-format.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../../.env") });
dotenv.config();

function eqNullAware(a: string | null, b: string | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a.toLowerCase() === b.toLowerCase();
}

async function main() {
  const valPath = path.join(TRAINING_DIR, "val.jsonl");
  const source = existsSync(valPath) ? valPath : GOLD_PATH;
  const examples = readJsonl(source);
  if (examples.length === 0) {
    console.error("Eval verisi yok");
    process.exit(1);
  }

  let intentOk = 0;
  let turOk = 0;
  let mahalleOk = 0;
  const details: Array<{
    text: string;
    expectedIntent: string;
    gotIntent: string;
    expectedTur: string | null;
    gotTur: string | null;
  }> = [];

  for (const ex of examples) {
    const expected = exampleLabel(ex);
    const text = exampleUserText(ex);
    if (!expected || !text) continue;

    const got = await classifyMessage(text);
    if (got.intent === expected.intent) intentOk += 1;
    if (eqNullAware(got.sikayet_turu, expected.sikayet_turu)) turOk += 1;
    if (eqNullAware(got.mahalle, expected.mahalle)) mahalleOk += 1;

    details.push({
      text: text.slice(0, 60),
      expectedIntent: expected.intent,
      gotIntent: got.intent,
      expectedTur: expected.sikayet_turu,
      gotTur: got.sikayet_turu,
    });
  }

  const n = details.length || 1;
  const report = {
    source,
    n: details.length,
    intentAccuracy: intentOk / n,
    turAccuracy: turOk / n,
    mahalleAccuracy: mahalleOk / n,
    model:
      process.env.GEMINI_TUNED_MODEL ||
      process.env.GEMINI_MODEL ||
      (process.env.GEMINI_API_KEY ? "gemini-2.5-flash" : "heuristic"),
    evaluatedAt: new Date().toISOString(),
    sample: details.slice(0, 10),
  };

  console.table({
    n: report.n,
    intentAccuracy: report.intentAccuracy.toFixed(3),
    turAccuracy: report.turAccuracy.toFixed(3),
    mahalleAccuracy: report.mahalleAccuracy.toFixed(3),
    model: report.model,
  });

  mkdirSync(TRAINING_DIR, { recursive: true });
  const out = path.join(TRAINING_DIR, "last-eval.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`Rapor: ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
