# KadroRadar — Expo 52 -> 54 ve Google Play hazırlığı

## Mevcut ZIP incelemesi (23 Ekim 2026)
- Monorepo: `apps/api`, `apps/admin`, `apps/mobile`, `services/ingest`, Prisma migrasyonları, GitHub CI.
- Mobil: Expo 52, Expo Router 4, React Native 0.76.x, React 18.3.1; Android package `com.kadroradar.app`.
- Çalışan ekranlar: index, historical, placement/[id]. API URL `EXPO_PUBLIC_API_URL` üzerinden.
- Backend: NestJS; `/api/v1/historical/*` uçları, yönetici onay akışı. Güncel ilanlar için tamamlanmış işlevsel veri toplama yok.
- ZIP'te **.env dosyaları bulunuyor**. Bunları GitHub'a, ekran görüntüsüne veya teslim ZIP'ine koymayın. Git ile önceden takip ediliyorlarsa geçmiş temizliği ve gizli değer rotasyonu gerekir.
- Mobil `app.json` içinde mağaza için görseller, splash, versionCode, privacy URL ve eas.json yok. Mevcut source dosyaları kompakt, ileride UI iyileştirmesi gerekiyor.

## Güvenli geçiş
1. Yerelde `git status`, `git ls-files '*env*'`, `git check-ignore apps/api/.env` ile sırları kontrol edin; temiz dal açın: `git switch -c feature/expo-sdk54`.
2. Paket içindeki `scripts/upgrade-expo-sdk54.ps1` dosyasını proje köküne `scripts/` altında kopyalayın. (Script bu konumdayken proje kökünü bulur.)
3. `powershell -ExecutionPolicy Bypass -File .\scripts\upgrade-expo-sdk54.ps1 -Target 53`.
4. Expo 53 uygulamasının fiziksel telefonda açıldığını ve geçmiş atamalar ekranını test edin. `git add`/commit yapın; farklı sorun varsa durup düzeltin.
5. `powershell -ExecutionPolicy Bypass -File .\scripts\upgrade-expo-sdk54.ps1 -Target 54`.
6. Android export + fiziksel telefon testi + API istekleri; `git add`/commit.

Not: Script Expo ve uyumlu paketleri kurmayı **deneyecek**; online npm erişimi gerekiyor ve burada build çalıştırılmadı. `pnpm dlx expo-doctor` kullandığı için internet gerektirir. Expo SDK 54 Android 16 / API 36 hedefler. Expo Go sürüm uyumsuzluğu varsa SDK'ya uygun Expo Go veya development build kullanın.

## Yayın öncesi engeller
- API yalnızca LAN adresindeyse herkese açık çalışmaz: HTTPS + production veritabanı + CORS/origin kontrolü + sunucu logları + yedekleme.
- `ADMIN_REVIEW_TOKEN` ile halka açık admin yayınlanmaz; oturum/RBAC ve audit gereklidir.
- Güncel ilanlar için kaynak doküman, son tarih, başvuru URL'si, kaynak türü, status, tarih sürümü ve idari doğrulama akışı tasarlanmalı.
- Eski ilan arşivi (`Announcement`) ve geçmiş yerleştirme (`HistoricalPlacement`) ayrı tutulmalı; farklı zaman ve uygunluk mantığı.
- Gizlilik politikası, hesap silme (hesap açılırsa), bağımsız kamu bilgisi açıklaması, gerçek mağaza görselleri, Android 36 hedefleyen imzalı AAB, Play Console test süreci.
- Açılış sayfasındaki `index` / `historical` başlıkları kullanıcıya dönük Türkçeleştirilmeli; safe area ve Android edge-to-edge gözden geçirilmeli.

## Veri modeli önerisi — Güncel ilanlar
`Announcement` (id, institutionId, title, summary, recruitmentType, status, announcedAt, applicationStartsAt, applicationEndsAt, officialSourceUrl, applicationUrl, originalDocumentUrl, sourceCheckedAt, approvedAt, revisionNo, lastSeenAt).
`AnnouncementPosition` (id, announcementId, title, cityCode, district, quota, educationLevel, scoreType, minimumScore, employmentType).
`RequirementGroup` ve `PositionRequirement` (AND/OR, nitelik kodu, value, validAt, citation text, sourcePage).
`AnnouncementRevision` (announcementId, sourceHash, diffs, capturedAt).
`SavedAnnouncement` ve `ApplicationTracking` kullanıcının açık rızasıyla ilerleyen sprintte.
Başlangıçta manuel/resmî kaynakla doğrulanmış ilan girişinden sonra izinli otomasyon ekleyin. İlanı hiç doğrulamadan `ACTIVE` olarak yayımlamayın.
