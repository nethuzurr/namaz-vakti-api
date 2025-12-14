// api/index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/api/vakitler', async (req, res) => {
    // 1. Parametreleri al (Varsayılan: Istanbul/Beylikduzu)
    let { sehir, ilce } = req.query;
    if (!sehir) sehir = "Istanbul";
    if (!ilce) ilce = "Beylikduzu";

    // Türkçe karakterleri İngilizceye çevir (Aladhan için)
    const fixChar = (str) => str.toLowerCase()
        .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c");
    
    const cleanSehir = fixChar(sehir);
    const cleanIlce = fixChar(ilce);
    
    // Adres sorgusu: "Beylikduzu, Istanbul, Turkey"
    const address = `${cleanIlce},${cleanSehir},Turkey`;

    try {
        const date = new Date();
        const dateStr = `${date.getDate()}-${date.getMonth()+1}-${date.getFullYear()}`;
        
        // 2. ALADHAN API'ye Bağlan (Diyanet Metodu: 13)
        const url = `https://api.aladhan.com/v1/timingsByAddress/${dateStr}`;
        
        const response = await axios.get(url, {
            params: {
                address: address,
                method: 13, // Diyanet İşleri Metodu
                timezone: 'Europe/Istanbul', // 👈 KRİTİK NOKTA: Saati sunucuda zorluyoruz!
                iso8601: 'false'
            }
        });

        const data = response.data.data;
        const timings = data.timings;

        // Vakitlerdeki (EEST) gibi fazlalıkları temizle
        Object.keys(timings).forEach(key => {
            timings[key] = timings[key].split(' ')[0];
        });

        res.json({
            success: true,
            source: 'Diyanet (Via Proxy)',
            location: `${cleanIlce.toUpperCase()}, ${cleanSehir.toUpperCase()}`,
            times: {
                Fajr: timings.Fajr,
                Sunrise: timings.Sunrise,
                Dhuhr: timings.Dhuhr,
                Asr: timings.Asr,
                Maghrib: timings.Maghrib,
                Isha: timings.Isha
            }
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Sunucu Hatası', 
            details: error.message 
        });
    }
});

module.exports = app;
