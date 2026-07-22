This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Otomatik Yedekleme

Kök dizinde `npm run backup` komutu PostgreSQL dump'ını ve fotoğraf klasörünü
`backups/` altına alır (14 günden eski yedekler silinir). Sunucuda her gece
03:00'te çalışması için crontab satırı:

```cron
0 3 * * * cd /path/to/Kars\ Belediyesi && bash scripts/backup.sh >> backups/backup.log 2>&1
```

## Hata İzleme (Sentry)

`@sentry/nextjs` kuruludur ancak yalnız `SENTRY_DSN` (ve istemci için
`NEXT_PUBLIC_SENTRY_DSN`) ortam değişkeni tanımlıysa etkinleşir. sentry.io'da
ücretsiz bir proje açıp DSN'i `.env` dosyasına ekleyin; tanımlı değilse tamamen
devre dışı kalır.
