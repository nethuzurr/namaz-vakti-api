// api/index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/api/vakitler', async (req, res) => {
    let { ilce, id } = req.query; // Hem isim hem ID desteği ekledik

    try {
        let placeId = id;
        let placeName = "Bilinmeyen";

        // EĞER ID GÖNDERİLMEDİYSE, İSİMLE ARA
        if (!placeId) {
            if (!ilce) ilce = "Fatih"; 
            const cleanQuery = ilce.toLowerCase()
                .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
                .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c");

            // Arama yap
            const searchUrl = `https://awqatsalah.diyanet.gov.tr/api/Place/SearchList?q=${encodeURIComponent(cleanQuery)}`;
            const searchRes = await axios.get(searchUrl);

            if (!searchRes.data || searchRes.data.length === 0) {
                return res.status(404).json({ error: "İlçe bulunamadı." });
            }

            // İlk sonucu al
            placeId = searchRes.data[0].id;
            placeName = searchRes.data[0].name;
        } else {
            // ID GÖNDERİLDİYSE DİREKT ONU KULLAN (En Garantisi)
            placeName = `Özel Konum (ID: ${placeId})`;
        }

        // VAKİTLERİ ÇEK
        const timesUrl = `https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Daily/${placeId}`;
        const timesRes = await axios.get(timesUrl);
        const data = timesRes.data;

        // --- TARİH KONTROLÜ (Web ile Eşleşmesi İçin) ---
        // Türkiye tarihini bul
        const now = new Date();
        const turkeyDateStr = new Intl.DateTimeFormat('tr-TR', {
            timeZone: 'Europe/Istanbul',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(now); // "15.12.2025"

        // Listeden bugünü bul
        let todayData = data.find(item => item.gregorianDateShort === turkeyDateStr);
        if (!todayData) todayData = data[0]; // Bulamazsa ilkini al

        // Yarını bul
        const todayIndex = data.indexOf(todayData);
        const tomorrowData = data[todayIndex + 1];

        res.json({
            success: true,
            source: 'Diyanet Official',
            location: placeName,
            placeId: placeId, // Hangi ID'yi kullandığını gör
            date: todayData.gregorianDateShort,
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

    } catch (error) {
        res.status(500).json({ error: 'Sunucu Hatası', details: error.message });
    }
});

module.exports = app;
