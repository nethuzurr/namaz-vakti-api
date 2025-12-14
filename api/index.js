// api/index.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

function slugify(text) {
    const trMap = {'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'};
    return text.toLowerCase().replace(/[çğşüıö]/g, char => trMap[char]).replace(/[^a-z0-9]/g, '');
}

app.get('/api/vakitler', async (req, res) => {
    let { sehir, ilce } = req.query;

    // 1. Varsayılanlar
    if (!sehir) sehir = "istanbul";
    if (!ilce) ilce = "beylikduzu";

    // 2. AKILLI DÜZELTME (NTV 'Merkez' kabul etmez)
    // Eğer ilçe "Merkez" ise ve şehir İstanbul ise, bunu "Fatih" yap.
    if (ilce.toLowerCase() === "merkez") {
        if (sehir.toLowerCase() === "istanbul") {
            ilce = "fatih";
        }
        // Diğer şehirlerde Merkez genelde çalışır ama garanti olsun diye
        // kullanıcıya bırakıyoruz.
    }

    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(ilce);

    // Linki oluştur (Hata durumunda görmek için değişkene atadık)
    const targetUrl = `https://www.ntv.com.tr/namaz-vakitleri/${cleanSehir}/${cleanIlce}`;

    try {
        const response = await axios.get(targetUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0' } 
        });

        const $ = cheerio.load(response.data);
        const now = new Date();
        const trDate = new Intl.DateTimeFormat('tr-TR', {
            timeZone: 'Europe/Istanbul',
            day: 'numeric', month: 'long', year: 'numeric'
        }).format(now);

        let foundData = null;
        let tomorrowData = null;

        $('table tbody tr').each((index, element) => {
            const cols = $(element).find('td');
            if (cols.length < 7) return;

            const rowDateRaw = $(cols[0]).text().trim();

            if (rowDateRaw.includes(trDate) || index === 0) {
                if (!foundData) {
                    foundData = {
                        date: rowDateRaw,
                        Fajr: $(cols[1]).text().trim(),
                        Sunrise: $(cols[2]).text().trim(),
                        Dhuhr: $(cols[3]).text().trim(),
                        Asr: $(cols[4]).text().trim(),
                        Maghrib: $(cols[5]).text().trim(),
                        Isha: $(cols[6]).text().trim()
                    };
                }
            }
            if (foundData && !tomorrowData && !rowDateRaw.includes(trDate) && index > 0) {
                 tomorrowData = { Fajr: $(cols[1]).text().trim() };
            }
        });

        if (!foundData) throw new Error("Tarih tablosu okunamadı");

        res.json({
            success: true,
            source: 'NTV',
            location: `${ilce.toUpperCase()} / ${sehir.toUpperCase()}`,
            times: foundData,
            tomorrowFajr: tomorrowData ? tomorrowData.Fajr : null
        });

    } catch (error) {
        // Hata durumunda hangi linkin bozuk olduğunu gösterelim
        res.status(500).json({ 
            error: 'NTV Sayfası Bulunamadı', 
            details: error.message,
            tried_url: targetUrl 
        });
    }
});

module.exports = app;
