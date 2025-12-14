// api/index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// Türkçe karakter düzeltme (API uyumu için)
function capitalize(text) {
    if (!text) return "";
    text = text.toString();
    // Türkçe karakterleri İngilizceye çevir
    const trMap = { 'ç':'c', 'ğ':'g', 'ş':'s', 'ü':'u', 'ı':'i', 'ö':'o', 'Ç':'C', 'Ğ':'G', 'Ş':'S', 'Ü':'U', 'İ':'I', 'Ö':'O' };
    text = text.replace(/[çğşüıöÇĞŞÜİÖ]/g, char => trMap[char]);
    // İlk harfi büyüt, gerisini küçült (Örn: beylikduzu -> Beylikduzu)
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

app.get('/api/vakitler', async (req, res) => {
    let { sehir, ilce } = req.query;

    // Varsayılanlar
    if (!sehir) sehir = "Istanbul";
    if (!ilce) ilce = "Beylikduzu";

    // API'nin istediği format: Region=Istanbul, City=Beylikduzu
    const region = capitalize(sehir);
    const city = capitalize(ilce);

    try {
        // Bu açık kaynaklı API, arka planda Diyanet ID'lerini kullanarak veriyi çeker.
        // Vercel üzerinde çalıştığı için hızlıdır ve engellenmez.
        const url = `https://namaz-vakti.vercel.app/api/timesFromPlace?country=Turkey&region=${region}&city=${city}`;
        
        console.log("İstek atılıyor:", url);
        const response = await axios.get(url);
        const data = response.data;

        // API bize o günün tarihini "YYYY-MM-DD" anahtarı olarak döner.
        // Örn: data.times["2025-12-15"]
        // Biz direkt ilk gelen günü alacağız.
        const dateKeys = Object.keys(data.times);
        const todayKey = dateKeys[0]; 
        const todayTimes = data.times[todayKey]; // Dizi döner: ["06:33", "08:00", ...]

        // Veri Diyanet sırasıyla gelir: İmsak, Güneş, Öğle, İkindi, Akşam, Yatsı
        const timings = {
            Fajr: todayTimes[0],
            Sunrise: todayTimes[1],
            Dhuhr: todayTimes[2],
            Asr: todayTimes[3],
            Maghrib: todayTimes[4],
            Isha: todayTimes[5]
        };
        
        // Yarının verisi var mı? (Gece sayacı için)
        let tomorrowFajr = null;
        if (dateKeys.length > 1) {
            tomorrowFajr = data.times[dateKeys[1]][0];
        }

        res.json({
            success: true,
            source: 'Diyanet (Via Proxy)',
            location: `${city} / ${region}`,
            date: todayKey,
            times: timings,
            tomorrowFajr: tomorrowFajr
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Veri alınamadı', 
            details: error.message, 
            hint: "İlçe ismini İngilizce karakterle deneyin (Örn: Beylikduzu)" 
        });
    }
});

module.exports = app;
