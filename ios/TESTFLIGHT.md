# KarsPanel TestFlight

- Bundle ID: `tr.gov.kars.panel`
- Display name: KarsPanel
- Backend (Release): `https://karsbelediyesi.gbsoftt.com`
- Debug builds talk to `http://localhost:3000`

## Privacy strings (Info.plist)

- Location When In Use — saha konum ping ve görev rotası
- Camera — şikayet kapanış / yol engeli fotoğrafı
- Photo Library — galeriden fotoğraf seçimi
- Photo Library Add — Excel/rapor kaydı (opsiyonel)

## Giriş

Seed şifre (`admin123`) native login ekranında yok. Canlı ortamda gerçek personel hesabı kullanın.

## Gönderim

1. Xcode’da Release scheme, Any iOS Device
2. Archive → Distribute App → App Store Connect → TestFlight
3. Gizlilik anketinde konum, kamera ve fotoğraf kütüphanesi “uygulama işlevi” olarak işaretlenir
