# KarsPanel — Native iOS

Native SwiftUI panel uygulaması (Expo yok). XcodeGen ile proje üretilir.

## Gereksinimler

- macOS + Xcode 15+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen`

## Kurulum

```bash
cd ios
xcodegen generate
open KarsPanel.xcodeproj
```

Simülatörde çalıştırmadan önce web API'nin `http://localhost:3000` adresinde ayakta olduğundan emin olun.

## Logo

`KarsPanel/Resources/Assets.xcassets/Logo.imageset/logo.png` web markasından kopyalanır:

```bash
cp "../apps/web/public/brand/logo.png" "KarsPanel/Resources/Assets.xcassets/Logo.imageset/logo.png"
```

## Mimari

- **SwiftUI**, iOS 17+, **MVVM**
- `@MainActor ObservableObject` store/view model'ler
- `KeychainAuthStore` — JWT saklama
- `APIClient` — `http://localhost:3000/api/v1/*` Bearer JWT

## Modüller

| Ekran | API |
|-------|-----|
| Giriş | `POST /api/v1/auth/login` |
| Dashboard | `GET /api/v1/dashboard` |
| Şikayetler | `GET/POST/PATCH /api/v1/complaints` |
| Diğer modüller | İlgili `/api/v1/*` uçları (stub liste ekranları) |

## Rol menüsü

`KarsPanel/Core/Navigation/NavItem.swift` web panelindeki `nav.ts` ile uyumlu rol filtrelemesi içerir.

## Bundle

- Uygulama adı: **KarsPanel**
- Bundle ID: `tr.gov.kars.panel`
