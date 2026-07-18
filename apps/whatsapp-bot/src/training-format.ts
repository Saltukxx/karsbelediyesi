import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Classification } from "./classification-types.js";

export type TuningExample = {
  contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TRAINING_DIR = path.join(__dirname, "../data/training");
export const GOLD_PATH = path.join(TRAINING_DIR, "gold.jsonl");

export function classificationToJson(c: Classification): string {
  return JSON.stringify(c);
}

export function parseClassificationJson(text: string): Classification | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as Classification;
  } catch {
    return null;
  }
}

export function makeTuningExample(userText: string, label: Classification): TuningExample {
  return {
    contents: [
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: classificationToJson(label) }] },
    ],
  };
}

export function readJsonl(filePath: string): TuningExample[] {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TuningExample);
}

export function exampleUserText(ex: TuningExample): string {
  return ex.contents.find((c) => c.role === "user")?.parts[0]?.text ?? "";
}

export function exampleLabel(ex: TuningExample): Classification | null {
  const raw = ex.contents.find((c) => c.role === "model")?.parts[0]?.text ?? "";
  return parseClassificationJson(raw);
}

function diversityKey(label: Classification | null): string {
  if (!label) return "unknown";
  if (label.intent === "sikayet") {
    return `sikayet:${label.sikayet_turu ?? "null"}:${label.mahalle ? "m" : "no_m"}`;
  }
  return label.intent;
}

function exampleScore(ex: TuningExample, idx: number): number {
  const label = exampleLabel(ex);
  const text = exampleUserText(ex);
  let score = 0;
  if (label?.adres) score += 3;
  if (label?.oncelik === "ACIL" || label?.oncelik === "COK_ACIL") score += 2;
  if (!label?.mahalle && label?.intent === "sikayet") score += 2;
  if (/\b(foto|ses|cop|cukur|vidanjor|tikanik|yenisehir|ataturk)\b/i.test(text)) score += 2;
  if (/[ığüşöçİĞÜŞÖÇ]/.test(text) === false && /[a-z]{4,}/i.test(text)) score += 1;
  if (text === "(fotoğraf)" || text === "(sesli mesaj)") score += 4;
  score += (idx % 7) * 0.01;
  return score;
}

/**
 * Diversified few-shot from gold.jsonl:
 * 1) one per intent, 2) unique complaint types, 3) fill by quality score.
 */
export function loadFewShotExamples(limit = 12): TuningExample[] {
  const all = readJsonl(GOLD_PATH);
  if (all.length === 0) return [];

  const scored = all.map((ex, idx) => ({
    ex,
    label: exampleLabel(ex),
    key: diversityKey(exampleLabel(ex)),
    score: exampleScore(ex, idx),
  }));

  const picked: TuningExample[] = [];
  const usedKeys = new Set<string>();
  const usedTexts = new Set<string>();
  const usedIntents = new Set<string>();

  const tryPick = (row: (typeof scored)[number]) => {
    if (picked.length >= limit) return;
    const t = exampleUserText(row.ex);
    if (!t || usedTexts.has(t)) return;
    picked.push(row.ex);
    usedKeys.add(row.key);
    usedTexts.add(t);
    if (row.label?.intent) usedIntents.add(row.label.intent);
  };

  // Pass 1: cover every intent (best example per intent)
  const byIntent = new Map<string, typeof scored>();
  for (const row of scored) {
    const intent = row.label?.intent ?? "diger";
    const list = byIntent.get(intent) ?? [];
    list.push(row);
    byIntent.set(intent, list);
  }
  for (const list of byIntent.values()) {
    list.sort((a, b) => b.score - a.score);
    if (list[0]) tryPick(list[0]);
  }

  // Pass 2: unique diversity keys (tür × mahalle presence)
  const byKey = [...scored].sort((a, b) => b.score - a.score);
  for (const row of byKey) {
    if (picked.length >= limit) break;
    if (usedKeys.has(row.key)) continue;
    tryPick(row);
  }

  // Pass 3: fill by score
  for (const row of byKey) {
    if (picked.length >= limit) break;
    tryPick(row);
  }

  return picked.slice(0, limit);
}
