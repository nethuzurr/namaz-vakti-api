// api/index.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// --- 🛑 KİLİT NOKTA: CORS AYARLARI ---
// Uygulamanın veriyi çekebilmesi için bu ayarlar ŞARTTIR.
app.use(cors({
    origin: '*', // Tüm dünyadan gelen isteklere "EVET" de
    methods: ['GET', 'POST', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Ekstra Garanti: Headerları elle de ekliyoruz (Bazı webview'ler cors kütüphanesini takmaz)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Eğer tarayıcı sadece "İzin var mı?" diye soruyorsa (Preflight), hemen "Var" de.
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Türkçe karakter dönüşüm
function slugify(text) {
    const trMap = {
        'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's',
        'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'
    };
    return text.toLowerCase()
        .replace(/[çğşüıö]/g, char => trMap[char])
        .replace(/[^a-z0-9]/g, '');
}

app.get('/api/vakitler', async (req, res) => {
    let { sehir, ilce } = req.query;
    if (!sehir) sehir = "istanbul";
    if (!ilce) ilce = "beylikduzu";

    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(ilce);

    try {
        const url = `https://www.ntv.com.tr/namaz-vakitleri/${cleanSehir}/${cleanIlce}`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
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

        if (!foundData) throw new Error("Veri bulunamadı");

        res.json({
            success: true,
            source: 'NTV',
            location: `${ilce.toUpperCase()} / ${sehir.toUpperCase()}`,
            times: foundData,
            tomorrowFajr: tomorrowData ? tomorrowData.Fajr : null
        });

    } catch (error) {
        res.status(500).json({ error: 'Hata', details: error.message });
    }
});

module.exports = app;
