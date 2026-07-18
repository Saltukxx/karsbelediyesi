/**
 * Gemini Developer API supervised fine-tune.
 * Önkoşul: npm run export:training → data/training/train.jsonl
 *
 * Job bitince .env içine:
 *   GEMINI_TUNED_MODEL=<tuned model name>
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { TRAINING_DIR } from "../src/training-format.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../../.env") });
dotenv.config();

const MIN_EXAMPLES = 50;

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY zorunlu");
    process.exit(1);
  }

  const trainPath = path.join(TRAINING_DIR, "train.jsonl");
  if (!existsSync(trainPath)) {
    console.error("train.jsonl yok. Önce: npm run export:training");
    process.exit(1);
  }

  const lines = readFileSync(trainPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < MIN_EXAMPLES) {
    console.error(
      `Yetersiz veri: ${lines.length} satır (min ${MIN_EXAMPLES}). Gold + DB etiketlerini artırın.`,
    );
    process.exit(1);
  }

  const baseModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const ai = new GoogleGenAI({ apiKey });

  console.log(`Fine-tune başlıyor: base=${baseModel}, examples=${lines.length}`);

  // Developer API: inline examples via file contents as training dataset URI alternative.
  // SDK expects TuningDataset — try fileData / examples from JSONL.
  const trainingExamples = lines.map((line) => JSON.parse(line) as {
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  });

  try {
    const operation = await ai.tunings.tune({
      baseModel,
      trainingDataset: {
        // @ts-expect-error SDK variants accept examples for Developer API
        examples: trainingExamples,
      },
      config: {
        tunedModelDisplayName: `kars-whatsapp-${Date.now()}`,
      },
    });

    mkdirSync(TRAINING_DIR, { recursive: true });
    const outPath = path.join(TRAINING_DIR, "last-tune-job.json");
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          baseModel,
          exampleCount: lines.length,
          operation,
        },
        null,
        2,
      ),
    );

    console.log("Tune job oluşturuldu.");
    console.log(JSON.stringify(operation, null, 2));
    console.log(`Kaydedildi: ${outPath}`);
    console.log(
      "Job tamamlanınca dönen tuned model adını .env içine yazın:\n  GEMINI_TUNED_MODEL=<name>",
    );
  } catch (err) {
    console.error("Tune API hatası:", err instanceof Error ? err.message : err);
    console.error(`
Alternatif (AI Studio / Cloud Console):
1. ${trainPath} dosyasını yükleyin
2. Base model: ${baseModel}
3. Bitince tuned model ID'yi GEMINI_TUNED_MODEL olarak ayarlayın
`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
