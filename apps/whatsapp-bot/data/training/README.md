# WhatsApp AI eğitim verisi

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `gold.jsonl` | Elle kalibre edilmiş örnekler (repo’da) — few-shot kaynağı |
| `from-db.jsonl` | `npm run export:training` ile DB’den üretilir |
| `train.jsonl` / `val.jsonl` | Birleşik split (gitignore) |
| `last-tune-job.json` | Son fine-tune job çıktısı |
| `last-eval.json` | Son eval raporu |

## Yerel iyileştirme (fine-tune yok)

Canlı sınıflandırma `gold.jsonl` üzerinden **few-shot** çeker (varsayılan 12; `GEMINI_FEW_SHOT` ile değiştirilir). Fine-tune olmadan kaliteyi artırmak için:

1. `gold.jsonl` satır ekleyin (argo, yazım hatası, mahallesiz, adresli, medya placeholder).
2. `npm run export:training` ve `npm run eval:ai` ile doğrulayın.
3. Botu yeniden başlatın.

## Akış

```bash
# 1) Veri birleştir
npm run export:training

# 2) (İsteğe bağlı) Fine-tune ≥50 örnek + GEMINI_API_KEY
npm run tune

# 3) Job bitince .env
# GEMINI_TUNED_MODEL=tunedModels/...

# 4) Değerlendir
npm run eval:ai
```

Tune API hata verirse `train.jsonl` dosyasını [Google AI Studio](https://aistudio.google.com/) üzerinden yükleyip supervised tuning başlatın; biten model adını `GEMINI_TUNED_MODEL` olarak yazın.

## Medya (fotoğraf / ses)

`gold.jsonl` ve `eval:ai` metin örnekleridir. Canlı hat fotoğraf ve sesli mesajları Gemini multimodal ile sınıflandırır (few-shot örnekler metin kalır). İndirilen dosyalar `data/media/` altında saklanır.
