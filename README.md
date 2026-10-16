# Esmaü'l-Hüsna Kılavuzu

Esmaü'l-Hüsna'yı anlamlandıran, her gün yaşatan ve oyunlaştırılmış bir takip uygulaması. Bağımlılıksız Node.js (>= 20) sunucusu ve vanilla JS arayüzü.

**Beta · Erken Erişim**

## Özellikler

- 98 ismin Arapça yazılışı, anlamı ve günlük görevi
- XP, seri (streak), seviye ve 7 kategori rozeti
- Açık ve koyu tema (tercih tarayıcıda saklanır, yoksa sistem ayarı kullanılır)
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
| POST | `/api/toggle` | Body: `{"name": "El-Adl"}`. Tamamlanmayı açar veya kapatır |

## Veri dosyaları

- `data/kilavuz.md`: isim tabloları, rozetler, ayet ve hadis dayanakları
- `data/sources.json`: kaynakça. Yalnızca `https` bağlantılar kabul edilir (`lib/sources.mjs` doğrular)
- `data/progress.json`: kullanıcı ilerlemesi (git'e eklenmez)

## Kaynakça hakkında

Dış bağlantılar üçüncü taraf sitelere gider. Ayet ve hadis bilgilerini her zaman birincil kaynaktan doğrulayın.

## Oyun kuralları

- **XP:** Tamamlanan her isim 10 XP. Her tam 7 günlük seri +50 XP. Haftalık tema bonusu +100 XP.
- **Rozet:** Aynı kategoriden 7 gün içinde 3 isim tamamlanınca kazanılır. Kazanıldığı gün gösterilir.
- **Haftalık tema:** Kılavuzdaki 4 haftalık tema sırayla döner. Temanın rozetlerine ait tüm isimler aynı hafta (Pazartesi–Pazar) içinde tamamlanırsa +100 XP.
- **Seviye:** XP eşiklerine göre Talip, Salik, Arif, Muhsin, Sadık.

## Bilinen sınırlar (MVP)

- Her isim için yalnızca son tamamlanma tarihi tutulur. Bir ismi bir hafta içinde tamamlayıp sonra geri alırsanız, o haftaki bonus ve rozet hesabı bu değişikliğe göre yeniden yapılır.
- İlerleme tek kullanıcılıdır. Çok kullanıcılı sürüm için Supabase (PostgreSQL + RLS) önerilir.
- Sunucu varsayılan olarak yalnızca `127.0.0.1` üzerinde dinler. Dışarı açmadan önce kimlik doğrulama eklenmelidir.

## Geliştirici

Hüseyin Bayer · izmgamestudios · TEKNODOZ
