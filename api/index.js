// api/index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/api/vakitler', async (req, res) => {
    let { sehir, ilce } = req.query;
    if (!sehir) sehir = "Istanbul";
    if (!ilce) ilce = "Beylikduzu";

    const fixChar = (str) => str.toLowerCase()
        .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c");
    
    const cleanSehir = fixChar(sehir);
    const cleanIlce = fixChar(ilce);
    const address = `${cleanIlce},${cleanSehir},Turkey`;

    try {
        // --- TARİH DÜZELTMESİ (KRİTİK KISIM) ---
        // Sunucu saati ne olursa olsun (ABD/Avrupa), biz Türkiye saatini baz alıyoruz.
        const now = new Date();
        const turkeyDate = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Istanbul',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(now); 
        // Çıktı formatı: "15/12/2025" şeklindedir.
        
        // Aladhan API tire (-) ister, slash (/) istemez. Onu düzeltiyoruz.
        const dateStr = turkeyDate.replace(/\//g, '-'); 

        // API İSTEĞİ
        const url = `https://api.aladhan.com/v1/timingsByAddress/${dateStr}`;
        
        const response = await axios.get(url, {
            params: {
                address: address,
                method: 13, // Diyanet
                timezone: 'Europe/Istanbul',
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
            source: 'Diyanet (Via Proxy / Fixed Date)',
            queryDate: dateStr, // Hangi tarihi çektiğimizi görelim
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
