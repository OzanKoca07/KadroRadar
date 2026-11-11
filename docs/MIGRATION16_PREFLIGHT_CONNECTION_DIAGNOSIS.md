# Migration16 read-only bağlantı teşhisi

2 Kasım 2026, Europe/Istanbul. Dal `feature/announcements-core`; mevcut HEAD `4e5b86c5de22210eef254b682df6890ba96c4bca`. Bu değişiklikler yereldir. Production bağlantısı, credential okuma, API key kullanımı, production migration/yazma, backup, deployment, push veya EAS build yapılmadı. Test kurulumunun DDL/sentetik verisi yalnız rastgele adlı disposable PostgreSQL16 konteynerindedir.

## Kanıtlanan sorun ve bilinmeyen neden

Eski CLI catch bloğu, `M16_*` validationCode taşımayan **bütün** hataları `M16_CONNECTION_OR_OPERATION_FAILED` olarak yazıyordu. Buna Render hedef parse/validation hatası, DNS/TCP/TLS, yanlış parola/database, PrismaClient initialization/engine hatası, transaction acquisition/pool timeout, yetki/tablo/sorgu hatası, dosya okuma ve yazılım hataları dahildi. `.errorCode`, `.code`, SQLSTATE, error kind veya hangi aşamaya ulaşıldığı kayboluyordu.

Ayrıca eski akış explicit `$connect()` olmadan doğrudan interactive transaction açıyordu. İlk bağlantının kurulamaması, pool acquisition ve gerçek migration sorguları aynı belirsiz operation içinde görünüyordu. Bu, hata görünürlüğü kusurudur; production'daki olayın gerçekten DNS/TLS/parola veya transaction timeout olduğunun kanıtı değildir.

**Production kök nedeni henüz kanıtlanmış değil.** Eski tek satırdan belirlenemez; doğru hostname/database girildiği bilgisi bağlantı, TLS ve oturum açma başarısını tek başına kanıtlamaz. Production'a erişerek yeniden üretim yapılmadı. Yeni güvenli çıktı operatörün kendi terminalinde hangi aşama/kodda durulduğunu gösterecek. Geçici ağ sorunu yazılım hatası gibi, yazılım hatası ağ sorunu gibi raporlanmaz.

## Yapılan değişiklikler

`infra/migration16-preflight.cjs`:

1. Input ve sabit local manifest kontrolü.
2. Mevcut exact Render hostname/database/port + strict TLS hedef kapısıyla eşdeğer, core içinde bağımsız doğrulama. `.env`/DATABASE_URL fallback yok.
3. Bir DNS lookup;5 saniye sınır. IP/adres çıktısı yok; host rewrite/pinning veya alternatif hedefe geçiş yok. Prisma daha sonra kendi normal çözümlemesini yapar; DNS başarılı sonucu sonraki çözümlemenin de kesin başarılı olacağı garantisi değildir.
4. **Tek PrismaClient**, tek explicit `$connect()` ve sabit `SELECT 1` probe. Connection_limit1, connect_timeout10 ve pool_timeout10 ile sınırlandırılır; TLS parametreleri gevşetilmez. Connect/probe için ayrıca12 saniyelik JS deadline vardır; retry yok. Deadline devam eden engine işini sihirli biçimde iptal etmez; aynı client finally-disconnect ile temizlenir, engine bağlantı süresi de sınırlıdır.
5. Mevcut transaction içinde ilk SQL `SET TRANSACTION READ ONLY`; identity, migration query/validation ve data counts aşamaları ayrı izlenir. Transaction timeout30/maxWait10 saniye. Önceki15/sonraki16 manifest/checksum, PostgreSQL16/public/database ve8611/aktif admin kapıları korunur.
6. Disconnect failure bile safe classifier'dan geçer; ham hata basılmaz. Başarısızlıkta tek geçerli JSON, `write:false`, `readOnly:true` ve non-zero exit.

`infra/migration16-diagnostics.cjs`: yeni bağımsız allowlist sınıflandırıcısı. Mevcut korunan `prisma-connection-diagnostics.cjs` incelendi; core release’in ayrı ve commit edilmemiş operatör bundle’ına bağımlı kalmaması için sınırlı pattern mantığı yeni core modülde bağımsız tutuldu. Eski helper değiştirilmedi. En fazla4 cause seviyesi,16KiB in-memory message incelemesi; output'a hiçbir metin parçası, SQL, URL, IP, kullanıcı adı veya credential aktarılmaz. Prototype property isimleri/uydurulmuş code/phase/kind/SQLSTATE çıktıya alınmaz.

`infra/migration16-preflight.ps1`: güvenli JSON'u yeniden ham exception ile sarmalamaz; terminal exit code1 korunur. Input/launch exception'ı sabit INPUT/UNKNOWN_OPERATION_FAILURE ile gösterilir. Secret environment eski değerlerine finally içinde döner; BSTR sıfırlanır/SecureString dispose edilir. PS7 parent module path'inden etkilenmemek için shell'in kendi `$PSHOME` security modülü explicit yüklenir. PS5.1 sentetik wrapper fixture'ında görülen INPUT reddi bu değişiklikle giderildi; bu fixture bulgusu production olayının nedeni olarak sunulmaz.

## Güvenli çıktı sözleşmesi

Failure alanları: status, readOnly, write, requestedPhase (`before/after`), phase (sabit aşama), code, evidence, allowlisted errorKind; varsa prismaCode/sqlState/validationCode. Başarı mevcut before/after count/pending sözleşmesini korur. Connection URL ve ham error.message/stack/cause/meta/stderr hiçbir alanda bulunmaz.

| code | Güvenli kanıt ve sınırı |
| --- | --- |
| DNS_FAILURE | ENOTFOUND/EAI_AGAIN veya initialization içindeki sınırlı DNS pattern; çoğunlukla DNS_LOOKUP aşaması |
| TCP_CONNECTION_FAILURE | ECONNREFUSED/reset/unreachable, bağlantı SQLSTATE'leri veya Prisma P1001/P1017. **P1001 genel erişilememe bilgisidir; tek başına kesin TCP refusal veya firewall nedeni kanıtlamaz** |
| TLS_FAILURE | Allowlisted certificate system code, P1011 veya sınırlı initialization TLS pattern. Sertifika doğrulaması kapatılmaz |
| AUTHENTICATION_FAILURE | P1000,28P01/28000; P1010 database access reddi de bu gruptadır. Her ret kesin yanlış parola demek değildir |
| DATABASE_NOT_FOUND | P1003 veya3D000 |
| CONNECTION_TIMEOUT | Açık system/deadline timeout; P1002/P1008/P2024. P2028 yalnız exact bounded acquisition-timeout pattern'iyle buraya girer |
| PRISMA_INITIALIZATION_FAILURE | Tanınmayan initialization kind/engine/config hatası; ağ sorunu olduğu varsayılmaz |
| MIGRATION_VALIDATION_FAILURE | Sabit M16 validationCode; P2021/P2022 veya42P01/42703. LOCAL_MANIFEST hataları yerel dosyadır, production şemasının bozuk olduğu sonucu değildir |
| UNKNOWN_OPERATION_FAILURE | Yazılım/izin/unknown transaction vb. sınıflandırılamayan durum.42501 ve57014 safe SQLSTATE olarak korunur; query canceled veya kaynak limiti otomatik timeout sayılmaz |
| TARGET_VALIDATION_FAILURE | Ek fail-closed kategori: exact Render hedef kontrolü veya bağlanılan DB/schema/PG identity uyuşmazlığı. Hedef gevşetilmez |

Prisma `.errorCode` ve `.code` ayrı okunur; tanınan kodlar korunur. Örneğin P2010'ın altında meta.code42P01 varsa SQLSTATE migration hatası olarak ayrılır. Arbitrary beş karakterli string SQLSTATE sayılmaz. Genel P2028 transaction API failure timeout kabul edilmez. Unknown TypeError'ın mesajında “connection refused” geçmesi onu ağ hatasına dönüştürmez.

Başlıca phase değerleri: INPUT, LOCAL_MANIFEST, TARGET_VALIDATION, DNS_LOOKUP, CLIENT_CREATE, PRISMA_CONNECT, CONNECTION_PROBE, READ_ONLY_TRANSACTION, IDENTITY_CHECK, MIGRATION_QUERY, MIGRATION_VALIDATION, DATA_COUNTS ve DISCONNECT. Evidence alanı SYSTEM_CODE/SQLSTATE/PRISMA_CODE/BOUNDED_PATTERN/VALIDATION_GUARD/TARGET_GUARD gibi sabit bir değerdir. Bu alanlar tahmini mesaj parçaları değildir.

Temsili sentetik çıktı (production sonucu değildir):

```json
{"status":"FAIL","readOnly":true,"write":false,"requestedPhase":"before","phase":"PRISMA_CONNECT","code":"AUTHENTICATION_FAILURE","evidence":"PRISMA_CODE","errorKind":"PrismaClientInitializationError","prismaCode":"P1000"}
```

## İzole testler

`infra/test-migration16-connection.cjs` production env/credential dosyası okumadan kendi loopback PG16 fixture'ını kurar. Setup için ilk15 ve sonra16 migration yalnız bu disposable DB'de uygulanır; kaynak/admin/historical sayıları sentetiktir. Dump/backup/restore komutu veya eski backup testi bu görevde çalıştırılmadı.

| Test | Kanıt |
| --- | --- |
| Yanlış hostname | Gerçek reserved `.invalid` çözümleme hatası; ayrıca mock DNS deadline |
| Kapalı port | Gerçek loopback socket kapatılıp tek Prisma connect reddi |
| Yanlış parola / yanlış database | Gerçek PG16 connect reddi; probe/preflight'a geçilmez |
| Geçersiz TLS | Gerçek PG16'da disposable self-signed sertifika; sslmode=require/sslaccept=strict ile ret. TLS'siz PG16'ya strict TLS talebi de reddedilir |
| Timeout | TCP kabul eden ama PostgreSQL protokolüne cevap vermeyen gerçek loopback endpoint, tek bounded deadline; rastgele retry yok |
| Eksik migration / checksum farkı | Yalnız fixture migration metadata'sı değiştirilir; spesifik M16_APPLIED_COUNT/M16_DB_CHECKSUM ile validation failure |
| Migration15/before ve16/after | Gerçek PG16 read-only transaction PASS;8611 sentetik ID count/hash aynı |
| Yanlış production hedefi | Localhost/metadata hedefi Render guard'da, DNS/client'tan önce reddedilir; gerçek Render'a bağlanılmaz |
| Yanlış bağlanılan DB identity | Fixture'da beklenen database uyuşmazlığı fail-closed TARGET |
| Prisma sınıflandırma | Allowlisted errorCode/code/SQLSTATE, no-code pattern, unknown software/prototype input ve P2028 ayrımı |
| Tek bağlantı / probe | Bir client/connect + bir sabit SELECT; connection failure'da query sayısı0; bozuk probe reddi |
| Read-only | Transaction içindeki ilk SQL read-only SET; PostgreSQL identity sorgusu transaction_read_only=on ister |
| PS5.1/7 | İki shell'de yanlış hedef ve sentetik launch exception: valid safe JSON, write=false, environment eski haline döner; ham marker/URL/SQL bulunmaz |

Son hedefli test28 kontrol PASS. Yeni test CI typescript işine eklendi; Linux koşusunda Windows shell kontrolleri doğal olarak çalışmaz, bunlar yerel Windows'ta doğrulandı. Yeni remote CI koşusu yoktur. Özel test sertifikası/dosya çıktıları yalnız `.local/m16-connection/<run>/` altındadır; production sertifikası/key'i değildir, Git kapsamı dışıdır.23 korunan operatör dosyası hash karşılaştırmasıyla aynı; migration16 manifesti, Prisma şeması/environment ve eski15 SQL değiştirilmedi.

## Kullanıcının çalıştıracağı tek read-only komut

Proje kökünde, kendi PowerShell terminalinizde:

```powershell
.\infra\migration16-preflight.ps1 -Phase before
```

Wrapper bağlantı bilgilerini yalnız sizin terminalinizde alır; URL gizli girişlidir. Credential'ları veya environment dump'ını sohbete koymayın. Sonuç JSON'undaki phase/code/prismaCode/sqlState/validationCode güvenli teşhis alanlarıdır. UNKNOWN kalırsa ham hata metni istemek veya bağlantıyı gevşetmek yerine bu aşamaya göre yeni izole test gerekir. Genel hata alınması migration, backup veya retry yetkisi vermez.

## Production öncesi kalan engeller ve dosya kapsamı

Gerçek bağlantı nedeninin yeni kodla operatör tarafından belirlenmesi; before PASS ve doğru8611/admin sayıları; ayrıca yeni gerçek VERIFIED backup/ayrı restore,15→16 operatör uyumluluğu ve açık migration onayı hâlâ gereklidir. Ardından ayrı push/CI/deploy ve HTTPS/recovery aktivasyon kararları gelir. Bu task bunların hiçbirini başlatmadı; kayıt/mail/scheduler politikaları aynı kaldı.

Değişenler: migration16-preflight.cjs/.ps1; yeni migration16-diagnostics.cjs ve test-migration16-connection.cjs; CI/RELEASE_CANDIDATE_FILES.json; bu rapor ve önceki release raporuna yönlendirme notu. Korunan23 dosya değiştirilmedi; yeni commit/push yok. Son manifest PASS:131 candidate dosyası,23 ayrı korunan operatör dosyası,191 göreli import,0 kapsam dışı değişiklik. Secret scan PASS:849 nesne/dosya,0 bulgu; heuristic tarama manuel incelemenin yerine geçmez. İlk taramada sentetik URL sabitleri işaretlendi; test URL’leri rastgele fixture değerlerinden oluşturulacak şekilde değiştirildi, scanner kuralları gevşetilmedi. Korunan, ayrı commit kapsamındaki helper’a yeni core bağımlılığı da kaldırıldı; yeni hedef/sınıflandırma kodu bağımsızdır. Production için yeni bir başarı veya kök neden iddiası yoktur.
