// api/index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// İlçe -> ID Eşleşmeleri (Diyanet İçin)
const ID_LISTESI = {
    "istanbul": "9541", "fatih": "9541", "merkez": "9541",
    "beylikduzu": "9542", "beylikdüzü": "9542",
    "avcilar": "9533", "avcılar": "9533",
    "esenyurt": "9554", "basaksehir": "9536",
    "uskudar": "9579", "kadikoy": "9558",
    "umraniye": "9578", "kartal": "9560"
    // Diğerleri eksik olsa bile kod çalışır
};

app.get('/api/vakitler', async (req, res) => {
    let { ilce } = req.query;
    if (!ilce) ilce = "beylikduzu"; 

    // Temizlik
    const cleanKey = ilce.toLowerCase()
        .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c").trim();

    // 1. ADIM: DİYANET'İ DENE (Resmi Kaynak)
    try {
        let placeId = ID_LISTESI[cleanKey] || "9541"; // Bulamazsa Fatih

        const diyanetUrl = `https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Daily/${placeId}`;
        
        // Diyanet'e istek at
        const response = await axios.get(diyanetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 3000 // 3 saniye içinde cevap vermezse pes et
        });

        // Veriyi bul
        const data = response.data;
        
        // Türkiye tarihini bul
        const now = new Date();
        const turkeyDateStr = new Intl.DateTimeFormat('tr-TR', {
            timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric'
        }).format(now); // "15.12.2025"

        let todayData = data.find(item => item.gregorianDateShort === turkeyDateStr);
        if (!todayData) todayData = data[0];

        const todayIndex = data.indexOf(todayData);
        const tomorrowData = data[todayIndex + 1];

        // BAŞARILI OLURSA DÖN
        return res.json({
            success: true,
            source: 'Diyanet Official',
            location: `${ilce.toUpperCase()} / TR`,
            times: {
                Fajr: todayData.fajr,
                Sunrise: todayData.sunrise,
                Dhuhr: todayData.dhuhr,
                Asr: todayData.asr,
                Maghrib: todayData.maghrib,
                Isha: todayData.isha
            },
            tomorrowFajr: tomorrowData ? tomorrowData.fajr : null
        });

    } catch (diyanetError) {
        // 2. ADIM: DİYANET HATA VERİRSE (404/Timeout) -> ALADHAN'A GEÇ (B PLANI)
        console.log("Diyanet başarısız, Aladhan devreye giriyor...");
        
        try {
            // Tarihi API formatına çevir (15-12-2025)
            const now = new Date();
            const dateStr = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric'
            }).format(now).replace(/\//g, '-');

            const address = `${cleanKey},Istanbul,Turkey`;
            const aladhanUrl = `https://api.aladhan.com/v1/timingsByAddress/${dateStr}`;

            const response = await axios.get(aladhanUrl, {
                params: {
                    address: address,
                    method: 13, // Diyanet Metodu
                    timezone: 'Europe/Istanbul', // Saat Zorlama
                    iso8601: 'false'
                }
            });

            const timings = response.data.data.timings;
            // Saatlerdeki (EEST) temizliği
            Object.keys(timings).forEach(k => timings[k] = timings[k].split(' ')[0]);

            return res.json({
                success: true,
                source: 'Aladhan Fallback (Diyanet Failed)',
                location: `${ilce.toUpperCase()} (Yedek)`,
                times: {
                    Fajr: timings.Fajr,
                    Sunrise: timings.Sunrise,
                    Dhuhr: timings.Dhuhr,
                    Asr: timings.Asr,
                    Maghrib: timings.Maghrib,
                    Isha: timings.Isha
                },
                tomorrowFajr: null // Aladhan günlük verir, yarını ayrıca çekmek gerekir (şimdilik null)
            });

        } catch (backupError) {
            // HER İKİSİ DE ÇÖKERSE (İmkansız ama)
            return res.status(500).json({ error: 'Tüm servisler devre dışı', details: backupError.message });
        }
    }
});

module.exports = app;
