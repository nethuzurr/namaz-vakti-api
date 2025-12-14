// api/index.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// EN GENİŞ GÜVENLİK İZNİ
app.use(cors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// ... (Kalan kodlar, slugify ve endpoint aynı kalsın) ...
// Buraya önceki çalışan NTV kodlarını aynen koyabilirsin, sadece üstteki app.use kısımlarını değiştirmen yeterli.
// Türkçe karakter düzeltme ve NTV scraper kodun aşağıda devam etsin.

function slugify(text) {
    // ... eski kodun aynısı ...
    const trMap = {'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'};
    return text.toLowerCase().replace(/[çğşüıö]/g, char => trMap[char]).replace(/[^a-z0-9]/g, '');
}

app.get('/api/vakitler', async (req, res) => {
    // ... eski kodun aynısı ...
    let { sehir, ilce } = req.query;
    if (!sehir) sehir = "istanbul";
    if (!ilce) ilce = "beylikduzu";
    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(ilce);

    try {
        const url = `https://www.ntv.com.tr/namaz-vakitleri/${cleanSehir}/${cleanIlce}`;
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(response.data);
        // ... cheerio işlemleri (eski çalışan kodun aynısı) ...
        // (Eğer silindiyse önceki mesajımdan kopyalayıp buraya yapıştırabilirsin)
        // Kısaca: Burası değişmedi.
        
        // --- KOD TEKRARINI ÖNLEMEK İÇİN KISALTTIM, SEN ESKİ ÇALIŞAN KODUNU BURAYA KOY ---
        // Sadece en üstteki CORS ayarlarını değiştirmen yeterli.

        // ...
        
    } catch (error) {
        res.status(500).json({ error: 'Hata', details: error.message });
    }
});

module.exports = app;
