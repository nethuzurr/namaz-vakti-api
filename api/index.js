// api/index.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/api/vakitler', async (req, res) => {
    // Şehir ve İlçe parametrelerini al (Türkçe karakter düzeltmesi gerekebilir)
    let { sehir, ilce } = req.query;

    if (!sehir || !ilce) {
        // Varsayılan: İstanbul/Beylikdüzü
        sehir = "istanbul";
        ilce = "beylikduzu";
    }

    try {
        // namazvakti.com sitesinden veriyi çek (Diyanet uyumludur)
        // URL yapısı: namazvakti.com/Turkiye/istanbul-beylikduzu-namaz-vakti.html
        const url = `https://www.namazvakti.com/Turkiye/${sehir}-${ilce}-namaz-vakti.html`;
        
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        // Sitedeki ID'lerden verileri yakala
        const imsak = $('#imsak').text().trim();
        const gunes = $('#gunes').text().trim();
        const ogle = $('#ogle').text().trim();
        const ikindi = $('#ikindi').text().trim();
        const aksam = $('#aksam').text().trim();
        const yatsi = $('#yatsi').text().trim();

        // Eğer veri boş geldiyse hata fırlat
        if (!imsak || !aksam) throw new Error("Veri okunamadı");

        // JSON olarak döndür
        res.json({
            success: true,
            source: 'Diyanet/NamazVakti',
            location: `${ilce.toUpperCase()}, ${sehir.toUpperCase()}`,
            times: {
                Fajr: imsak,
                Sunrise: gunes,
                Dhuhr: ogle,
                Asr: ikindi,
                Maghrib: aksam,
                Isha: yatsi
            }
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Veri alınamadı', 
            details: error.message,
            hint: "Şehir ve ilçe ismini ingilizce karakterlerle küçük harf yazın. Örn: istanbul-fatih"
        });
    }
});

// Vercel için export ediyoruz
module.exports = app;