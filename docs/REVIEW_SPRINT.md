# Yerel inceleme sprinti (prototip)

- Yeni migration: `202610220002_review_audit`.
- Admin için **yalnızca yerel geliştirmeye uygun** `ADMIN_REVIEW_TOKEN` (en az 32 karakter) korumalı endpoints.
- **Üretime açmayın:** çok kullanıcılı kimlik doğrulama/RBAC, HTTPS, CSRF/CORS kısıtları, rate limiting ve audit aktör kimliği eksik.
- Token `apps/api/.env` içine eklenmeli, admin sayfasında bellekte girilmeli; dosyaya ya da VITE_* frontend değişkenine yazılmamalı.
- `pnpm --filter @kadro/api build`, `pnpm --filter @kadro/admin build`, `pnpm --filter @kadro/api db:migrate`.
- Admin: `pnpm --filter @kadro/admin dev`, http://localhost:5173.
- Manuel PDF karşılaştırmasını tamamlamadan onay yapmayın. Şu anda tüm kaynak satırlarının ayrı ayrı insan tarafından gözle incelendiği kanıtlanmış değildir.
- Onay eski 504 kaydı silmez. Hatalı veya tekrarlı partiler reddedilir; kaynak SHA ve satırların DB ile tutarlılığı kontrol edilir.
- İleri sprint: gerçek login, roller, satır düzeltme/red, PDF sayfa önizleme, kontrollü kaynak yayımı.
