// api/index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/api/vakitler', async (req, res) => {
    let { ilce } = req.query;

    if (!ilce) ilce = "Fatih"; // Test için varsayılan

    // Türkçe karakterleri ve boşlukları temizle
    const cleanQuery = ilce.trim().toLowerCase();

    try {
        // MASKELİ İSTEK (User-Agent ekliyoruz ki Diyanet bizi engellemesin)
        const config = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://awqatsalah.diyanet.gov.tr/',
                'Origin': 'https://awqatsalah.diyanet.gov.tr'
            }
        };

        // 1. ARAMA YAP (ID Bul)
        // Diyanet arama endpoint'i
        const searchUrl = `https://awqatsalah.diyanet.gov.tr/api/Place/SearchList?q=${encodeURIComponent(cleanQuery)}`;
        console.log("Aranıyor:", searchUrl); // Log (Vercel loglarında görünür)

        const searchRes = await axios.get(searchUrl, config);

        // Arama sonucu boş mu?
        if (!searchRes.data || searchRes.data.length === 0) {
            return res.status(404).json({ error: "İlçe bulunamadı. Lütfen 'fatih', 'beylikduzu' gibi deneyin." });
        }

        // İlk sonucu al
        const place = searchRes.data[0];
        const placeId = place.id;
        const placeName = place.name; // Örn: BEYLİKDÜZÜ / İSTANBUL

        // 2. VAKİTLERİ ÇEK
        const timesUrl = `https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Daily/${placeId}`;
        const timesRes = await axios.get(timesUrl, config);
        
        const data = timesRes.data;

        // Veri kontrolü
        if (!data || data.length === 0) {
            throw new Error("Diyanet ID buldu ama vakit listesi boş döndü.");
        }

        const todayData = data[0]; // Bugün
        const tomorrowData = data[1]; // Yarın

        // BAŞARILI SONUÇ DÖNDÜR
        res.json({
            success: true,
            source: 'Diyanet Official (Masked)',
            location: placeName,
            placeId: placeId,
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
        // Detaylı hata raporu
        res.status(500).json({ 
            error: 'Sunucu Hatası', 
            message: error.message,
            details: error.response ? error.response.data : "Diyanet sunucusuna erişilemedi"
        });
    }
});

module.exports = app;
