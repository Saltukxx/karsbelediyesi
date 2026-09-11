# Üretim dağıtımı (Hetzner odaklı)

Kısa kontrol listesi. Gerçek sırları repoya koymayın.

## 1. Sunucu

- Hetzner CX31+ (veya eşdeğeri), Ubuntu 24.04 LTS
- Docker Engine + Compose plugin
- UFW: yalnızca `22`, `80`, `443` (veya `WEB_PORT`) açık; Postgres/Redis host’a publish edilmez

## 2. Ortam değişkenleri

```bash
cp .env.example .env.prod
# Zorunlu: POSTGRES_*, REDIS_PASSWORD, AUTH_SECRET, AUTH_URL, JWT_SECRET, CRON_SECRET
# İsteğe bağlı: MOBILIZ_TOKEN, GEMINI_API_KEY, DB_CONNECTION_LIMIT
```

`docker-compose.prod.yml` varsayılan şifre taşımaz; eksik değişkenlerde compose hata verir (`:?`).

### `DB_CONNECTION_LIMIT`

Prisma her web örneğinde en fazla bu kadar bağlantı açar. Kaba formül:

`örnek_sayısı × DB_CONNECTION_LIMIT ≤ Postgres max_connections − 10 (yedek)`

Tek örnek için `10` genelde yeterli; ölçeklenince düşürün veya PgBouncer ekleyin.

## 3. Ayağa kaldırma

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod build
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
# Şema (ilk kurulum / uyumlu push):
docker compose -f docker-compose.prod.yml --env-file .env.prod exec web \
  npx prisma db push --schema=packages/db/prisma/schema.prisma
```

Önde reverse proxy (Caddy/Nginx) ile TLS terminasyonu önerilir; `AUTH_URL` public HTTPS adresi olmalı.

## 4. Cron (bildirim taramaları)

Panel poll’u artık SLA / araç süresi / Mobiliz çalıştırmaz. Ayrı tetikleyin:

```bash
# her 5 dk
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" "$AUTH_URL/api/ops/sla-tarama"
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" "$AUTH_URL/api/ops/arac-suresi-tarama"
# Mobiliz (token varsa)
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" "$AUTH_URL/api/ops/mobiliz-sync"
# Rota sapması
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" "$AUTH_URL/api/ops/sapma-tarama"
```

Sistem cron veya Hetzner cron-job ile çalıştırın.

## 5. Duman kontrol listesi

- [ ] `GET $AUTH_URL/giris` 200
- [ ] Admin ile giriş → dashboard açılıyor
- [ ] `GET /api/ops/notifications` (oturumlu) yalnızca bildirim listesi; ağır tarama yok
- [ ] Cron uçları `CRON_SECRET` olmadan 401/403
- [ ] Şikayet detay → iş emri raporu (web yazdır / mobil paylaş)
- [ ] WhatsApp medya (varsa) `/api/ops/whatsapp-media/:id`
- [ ] Yedek: `npm run backup` veya `pg_dump` + uploads hacmi

## 6. Bilinçli olarak burada olmayanlar

- Mobiliz canlı token, APNs sertifikaları, Baileys→WABA geçişi
- TestFlight / ASC uygulama CREATE
