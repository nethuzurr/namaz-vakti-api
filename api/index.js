// api/index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/api/vakitler', async (req, res) => {
    let { ilce } = req.query; // Sadece ilçe ismi yeterli (Örn: Beylikduzu)

    if (!ilce) ilce = "Fatih"; // Varsayılan

    // Türkçe karakterleri arama için düzenle
    const query = ilce.toLowerCase()
        .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c");

    try {
        // 1. Diyanet'te İlçeyi Arat ve ID'sini Bul
        const searchUrl = `https://awqatsalah.diyanet.gov.tr/api/Place/SearchList?q=${query}`;
        const searchRes = await axios.get(searchUrl);

        // Sonuç var mı?
        if (!searchRes.data || searchRes.data.length === 0) {
            throw new Error("İlçe bulunamadı");
        }

        // İlk sonucu al (En güvenilir olan genelde ilkidir)
        const place = searchRes.data[0];
        const placeId = place.id;
        const placeName = place.name; // Örn: BEYLİKDÜZÜ / İSTANBUL

        // 2. ID ile Vakitleri Çek
        const timesUrl = `https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Daily/${placeId}`;
        const timesRes = await axios.get(timesUrl);
        const data = timesRes.data;

        // Diyanet listeyi bugünden itibaren verir. İlk eleman bugündür.
        const todayData = data[0];
        const tomorrowData = data[1]; // Yarın (Gece sayacı için lazım)

        if (!todayData) throw new Error("Vakit verisi alınamadı");

        res.json({
            success: true,
            source: 'Diyanet (Official/AwqatSalah)',
            location: placeName,
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
        res.status(500).json({ 
            error: 'Sunucu Hatası', 
            details: error.message 
        });
    }
});

module.exports = app;