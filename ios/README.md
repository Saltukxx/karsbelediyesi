# KarsPanel — iOS

Kars Belediyesi operasyon panelinin native SwiftUI istemcisi. Web panelindeki
ekranların tamamını (WebView olmadan) iOS 17+ üzerinde iPhone ve iPad için
sunar.

## Proje üretimi

Xcode projesi [XcodeGen](https://github.com/yonaskolb/XcodeGen) ile
`project.yml` üzerinden üretilir. **Yeni Swift dosyası eklediğinizde projeyi
yeniden üretin**, aksi halde dosya derlemeye girmez:

```bash
xcodegen generate
open KarsPanel.xcodeproj
```

## Sunucu adresi

Taban API adresi derleme yapılandırmasından gelir (`project.yml` →
`KB_API_BASE_URL`), `Info.plist` içindeki `KBAPIBaseURL` anahtarına yazılır ve
`AppConfig` tarafından okunur:

| Yapılandırma | Adres |
| --- | --- |
| Debug | `http://localhost:3000` |
| Release | `https://karsbelediyesi.gbsoftt.com` |

Panel şu an `karsbelediyesi.gbsoftt.com` üzerinde yayınlanıyor; kurum kendi alan
adına (`panel.kars.bel.tr`) geçtiğinde Release adresini güncellemek yeterlidir.

Kullanıcı giriş ekranındaki **Sunucu** sayfasından adresi geçersiz kılabilir
(saha testi ve kurum içi dağıtım için). Adres değişimi oturumu kapatır.

## Doğrulama

```bash
./scripts/typecheck.sh   # uygulama + test kaynaklarının tip kontrolü
./scripts/test.sh        # çekirdek birim testleri (macOS hedefi)
```

`scripts/test.sh`, ağ katmanı / yapılandırma / rol matrisi gibi Foundation'a
bağlı testleri macOS hedefinde derleyip koşturur; böylece iOS simulator
runtime'ı kurulu olmayan makinelerde de testler çalışır. UI testleri ve tam
uygulama derlemesi için simulator runtime'ı gerekir:

```bash
xcodebuild test -scheme KarsPanel -destination 'platform=iOS Simulator,name=iPhone 16'
```

## Mimari

```
KarsPanel/
  App/          Uygulama girişi, oturum durumu, kök yönlendirme
  Core/
    Auth/       Keychain token deposu
    Components/ Paylaşılan SwiftUI bileşenleri
    Config/     AppConfig (taban adres, sürüm)
    Location/   CoreLocation konum bildirimi
    Models/     API DTO'ları
    Navigation/ Rol bazlı menü kataloğu
    Network/    APIClient, Endpoint, hata eşlemesi
    Theme/      Renk ve ölçü sabitleri
  Features/     Ekran başına View + ViewModel (MVVM)
```

Ağ katmanı `APIClient` + `Endpoint` üzerine kuruludur: JSON, `multipart/form-data`
ve ikili indirme (Excel export, fotoğraf) desteklenir. 401 yanıtı
`AppSession`'a bildirilir ve oturum düşürülür.
