# Bölüm 8 — Kabul Kontrol Listesi

Her Excel sayfası / sütun grubu için sistemde karşılık işareti.

## 8.1 Çağrı Yönetim Sistemi

| Excel | Sistem | Durum |
|-------|--------|-------|
| LİSTELER (mahalle, müdürlük, tür) | `/tanimlar` + seed | [x] |
| TANIMLAMALAR zimmet / personel | Araç zimmet + `/personel` | [x] |
| ŞİKAYET KAYIT 18 sütun | `/sikayetler`, `/sikayetler/yeni` | [x] |
| AKTİF / KAPALI İŞLER | `/sikayetler?sekme=` filtreleri | [x] |
| İSTATİSTİK | Dashboard `/` | [x] |
| RAPORLAMA PDF | `/sikayetler/[id]/rapor` | [x] |
| WhatsApp kuyruk | `/whatsapp` + bot | [x] |

## 8.2 Araç Envanteri

| Excel | Sistem | Durum |
|-------|--------|-------|
| Araç Envanteri | `/araclar` | [x] |
| Bakım Takip | `/bakim` | [x] |
| Yakıt Takip | `/yakit` | [x] |
| Özet Panel | Dashboard + raporlar | [x] |

## 8.3 Araç Havuz Takip

| Excel | Sistem | Durum |
|-------|--------|-------|
| Araç Havuzu durumları | `Vehicle.operasyonDurumu` | [x] |
| Görev Formu + Çıkış-Giriş | `/gorevler` | [x] |
| Müdürlük Özeti | `/gorevler` alt özet | [x] |

## 8.4 İş Makineleri Bakım Kontrol

| Excel | Sistem | Durum |
|-------|--------|-------|
| 5 şablon / 195 kalem seed | `ChecklistTemplate*` | [x] |
| Form doldurma + onay | `/kontrol-listeleri` | [x] |
| PDF çıktı | `/kontrol-listeleri/[id]/yazdir` | [x] |
| ❌ → bakım önerisi | `kontrolKalemKaydet` | [x] |

## 8.5 Günlük Çalışma

| Excel | Sistem | Durum |
|-------|--------|-------|
| Personel Listesi | `/personel` | [x] |
| Personel Günlük Takip | `/gunluk-calisma` | [x] |
| Araç Günlük Takip | `/gunluk-calisma` | [x] |
| Aylık Özet kartları | `/gunluk-calisma` | [x] |
| Formül testleri | `packages/shared` Vitest | [x] |

## 8.6 Tekilleştirme

| Kural | Durum |
|-------|-------|
| Tek Vehicle / Personnel / Department | [x] |
| envanterDurumu + operasyonDurumu | [x] |
| FuelRecord tek kaynak (günlük → fuel) | [x] |

## Mobil / Bot / Operasyon

| Madde | Durum |
|-------|-------|
| Expo mobil (işlerim, görev, kontrol offline, mesai) | [x] |
| `/api/mobile` JWT | [x] |
| WhatsApp Baileys + Gemini + BullMQ | [x] |
| Excel export (`/api/export/*`) | [x] |
| Excel import script | [x] |
| Docker compose full profile | [x] |
| Playwright duman testleri | [x] |
