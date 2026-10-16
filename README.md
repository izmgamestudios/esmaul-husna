# Esmaü'l-Hüsna Kılavuzu

Esmaü'l-Hüsna'yı anlamlandıran, her gün yaşatan ve oyunlaştırılmış bir takip uygulaması. Bağımlılıksız Node.js (>= 20) sunucusu ve vanilla JS arayüzü.

**Beta · Erken Erişim**

## Özellikler

- 98 ismin Arapça yazılışı, anlamı ve günlük görevi
- XP, seri (streak), seviye ve 7 kategori rozeti
- Açık ve koyu tema (tercih tarayıcıda saklanır, yoksa sistem ayarı kullanılır)
- **Günün ismi:** her gün tarihe göre sabit seçilen bir isim, tek tıkla tamamlanır
- **Seri koruyucu** (ayda 1 hak, dünkü boş günü affeder) ve **haftalık özet**
- **Seri uyarısı** (seri gece yarısı bozulacaksa) ve **sıradaki rozet ipucu**
- Kenar menü (mobilde açılır menü)
- Kaynakça bölümü: Kur'an, hadis ve resmi dini kaynaklara dış bağlantılar
- Krediler: e-posta, LinkedIn, arama ve WhatsApp bağlantıları

## Çalıştırma

    npm start            # http://127.0.0.1:3000
    PORT=8080 npm start  # farklı port
    npm test             # birim testleri

## API

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/api/state` | İsimler, rozetler, kaynaklar, tamamlananlar ve istatistikler |
| POST | `/api/freeze` | Dünü seri koruyucuyla kapatır (409: kullanılamaz) |
| POST | `/api/toggle` | Body: `{"name": "El-Adl"}`. Tamamlanmayı açar veya kapatır |

## Veri dosyaları

- `data/kilavuz.md`: isim tabloları, rozetler, ayet ve hadis dayanakları
- `data/sources.json`: kaynakça. Yalnızca `https` bağlantılar kabul edilir (`lib/sources.mjs` doğrular)
- `data/progress.json`: kullanıcı ilerlemesi (git'e eklenmez)

## Depolama: Google Drive veritabanı

Varsayılan depolama yerel `data/` klasörüdür. `STORAGE=drive` ile ilerleme bir Google Drive klasöründe tutulur:

| Dosya | Biçim | İçerik |
|---|---|---|
| `progress.json` | JSON | Tamamlanan isimler ve seri koruyucu günleri (asıl veri) |
| `activity.csv` | CSV | Her tamamla/geri al/koruyucu olayı (Sheets veya Excel'de açılır) |
| `summary.json` | JSON | XP, seri, seviye ve haftalık özet (her kayıtta güncellenir) |

Kurulum (bir kez):

1. Google Cloud'da bir **servis hesabı** oluşturup Drive API'yi etkinleştirin, JSON anahtarı indirin.
2. Drive klasörünü servis hesabının e-postasıyla **Düzenleyici** olarak paylaşın.
3. Sunucuda `/etc/esmaul-husna/sa.json` olarak kaydedin (`chmod 600`) ve `/etc/esmaul-husna.env` oluşturun:

        STORAGE=drive
        DRIVE_FOLDER_ID=1y3mr7xnHCyRt_MlQKih2gqjCy_-s0VC6
        GOOGLE_SERVICE_ACCOUNT_FILE=/etc/esmaul-husna/sa.json

4. `systemctl restart esmaul-husna`

Notlar: Drive gerçek bir veritabanı değildir. Yazmalar tek tek sıraya alınır, `activity.csv` her olayda baştan yüklenir (binlerce satırdan sonra Supabase'e geçin). Bozuk `progress.json` ilerlemeyi sıfırlamaz, sunucu hata verir. Anahtar dosyası repoya eklenmez.

## Kaynakça hakkında

Dış bağlantılar üçüncü taraf sitelere gider. Ayet ve hadis bilgilerini her zaman birincil kaynaktan doğrulayın.

## Oyun kuralları

- **XP:** Tamamlanan her isim 10 XP. Her tam 7 günlük seri +50 XP. Haftalık tema bonusu +100 XP.
- **Rozet:** Aynı kategoriden 7 gün içinde 3 isim tamamlanınca kazanılır. Kazanıldığı gün gösterilir.
- **Haftalık tema:** Kılavuzdaki 4 haftalık tema sırayla döner. Temanın rozetlerine ait tüm isimler aynı hafta (Pazartesi–Pazar) içinde tamamlanırsa +100 XP.
- **Seviye:** XP eşiklerine göre Talip, Salik, Arif, Muhsin, Sadık.

## Sunucuya kurulum (Hetzner / Ubuntu)

Ön koşul: `teknodoz-esmaulhusna-ortakofis.org` kaydının A (ve varsa AAAA) kaydı sunucuya işaret etmeli. Node.js 20+ kurulu olmalı.

    sudo bash deploy/install.sh

Script idempotenttir: tekrar çalıştırmak kodu günceller ve servisi yeniden başlatır. Oluşturduğu parçalar:

- `/opt/esmaul-husna`: kod (git klonu, `data/` dizini hariç)
- `esmaul-husna.service`: systemd servisi, `127.0.0.1:3000` üzerinde çalışır, `esmaul` kullanıcısıyla sınırlı yetkiyle
- nginx sitesi: alan adını `127.0.0.1:3000`'e yönlendirir
- Let's Encrypt sertifikası (certbot)

### Windows'tan güncelleme (PowerShell)

Kurulum bir kez yapıldıktan sonra yeni sürümü şu komutla yayınlayabilirsiniz:

    .\deploy\deploy.ps1 -Server <sunucu-ip> -User root -KeyPath "$HOME\.ssh\id_ed25519"

Script `main` dalının son sürümünü çeker, servisi yeniden başlatır ve sağlık kontrolü yapar. Özel anahtar repoya eklenmez.

CloudPanel kullanılan sunucularda nginx vhost'ları CloudPanel tarafından yönetilir. Orada alan adını CloudPanel'de bir site olarak ekleyip reverse proxy'yi `http://127.0.0.1:3000` olarak ayarlamak daha sağlıklıdır.

## Bilinen sınırlar (MVP)

- Her isim için yalnızca son tamamlanma tarihi tutulur. Bir ismi bir hafta içinde tamamlayıp sonra geri alırsanız, o haftaki bonus ve rozet hesabı bu değişikliğe göre yeniden yapılır.
- İlerleme tek kullanıcılıdır (Drive'da da tek `progress.json`). Çok kullanıcılı sürüm için Supabase (PostgreSQL + RLS) önerilir.
- Sunucu varsayılan olarak yalnızca `127.0.0.1` üzerinde dinler. Dışarı açmadan önce kimlik doğrulama eklenmelidir.

## Geliştirici

Hüseyin Bayer · izmgamestudios · TEKNODOZ
