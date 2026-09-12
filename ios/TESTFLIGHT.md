# KarsPanel TestFlight

- Bundle ID: `tr.gov.kars.panel`
- Display name: KarsPanel
- Backend (Release): `https://karsbelediyesi.gbsoftt.com`
- Debug builds talk to `http://localhost:3000`

## Görünüm

Açık tema zorunlu (`preferredColorScheme(.light)`). Belediye Figma kiti light-only; koyu mod ürün kararı olarak kapalıdır.

## Privacy strings (Info.plist)

- Location When In Use — saha konum ping ve görev rotası
- Location Always / Always & When In Use — yalnızca aktif konum paylaşımı (görev/saha oturumu) açıkken arka plan ping; 7/24 takip yok. İzin yoksa When-In-Use ile ön planda kalır.
- Camera — şikayet kapanış / yol engeli fotoğrafı
- Photo Library — galeriden fotoğraf seçimi
- Photo Library Add — Excel/rapor kaydı (opsiyonel)
- Background Modes → location — aktif saha oturumu arka plan ping’i

## Giriş

Seed şifre (`admin123`) native login ekranında yok. Canlı ortamda gerçek personel hesabı kullanın.

## Gönderim

1. Xcode’da Release scheme, Any iOS Device
2. Archive → Distribute App → App Store Connect → TestFlight
3. Gizlilik anketinde konum (When In Use + Always), kamera ve fotoğraf kütüphanesi “uygulama işlevi” olarak işaretlenir

## Push (APNs)

- Bundle: `tr.gov.kars.panel`
- İstemci: izin ister, remote notification kaydı, token `POST /api/v1/devices` (JWT).
- Sunucu: `DeviceToken` tablosu; SLA/ATAMA/GOREV bildirimlerinde APNs dener.
- Env: `APNS_KEY_PATH`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_TOPIC=tr.gov.kars.panel` (opsiyonel `APNS_PRODUCTION=1`).
- Makinede `.p8` örneği: `gbsoft-internal-backend/AuthKey_APNS.p8` + App Store Connect Key/Team ID.
- Env eksikse sunucu no-op log yazar; mevcut 30 sn poll yedek kalır.
- Capability: Push Notifications + Background Modes → remote-notification (entitlements `aps-environment`).
