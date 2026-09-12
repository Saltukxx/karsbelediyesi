# TestFlight duman kontrolü (kısa)

Cihaz veya simülatör + erişilebilir backend (`localhost:3000` Debug / prod Release).

1. **Giriş** — personel hesabı ile login; ana kabuk açılır.
2. **İşlerim kapanış + foto** — açık şikayet → kapat → kamera/galeri foto → toast OK veya “Senkron bekliyor”.
3. **Atama / görev** — size atanmış görev görünür; KM/başlat (varsa) çalışır.
4. **Harita engel** — Harita → engel bırak → foto + kaydet; pin/ liste güncellenir.
5. **Offline rozet** — uçak modu → bir yazma → header’da senkron sayısı; ağ gelince flush.

İsteğe bağlı: bildirim zili poll; push (APNs env doluysa) arka plan uyarısı.

Otomatik: `P0FlowsUITests` (simülatör, backend ayaktaysa).
