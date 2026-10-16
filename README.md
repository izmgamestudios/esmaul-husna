# Esmaü'l-Hüsna Uygulaması

Bağımlılıksız Node.js (>= 20) sunucusu ve vanilla JS arayüzü. Kılavuz verisi `data/kilavuz.md` dosyasından okunur.

## Çalıştırma

    npm start            # http://127.0.0.1:3000
    PORT=8080 npm start  # farklı port
    npm test             # birim testleri

## API

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/api/state` | İsimler, rozetler, tamamlananlar ve istatistikler |
| POST | `/api/toggle` | Body: `{"name": "El-Adl"}`. Tamamlanmayı açar/kapatır |

## Bilinen sınırlar (MVP)

- İlerleme tek kullanıcılı; `data/progress.json` dosyasında tutulur. Çok kullanıcılı sürüm için Supabase (PostgreSQL + RLS) önerilir.
- Rozet kuralı basitleştirildi: kategoriden 3 isim tamamlanınca kazanılır. Kılavuzdaki "7 gün içinde" koşulu henüz uygulanmadı.
- Haftalık tema bonusu (+100 XP) henüz hesaplanmıyor.
- Sunucu varsayılan olarak yalnızca `127.0.0.1` üzerinde dinler. Dışarı açmadan önce kimlik doğrulama eklenmelidir.
