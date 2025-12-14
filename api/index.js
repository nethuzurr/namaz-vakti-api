const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// Tüm erişim izinlerini aç (CORS)
app.use(cors({ origin: '*', methods: '*', allowedHeaders: '*' }));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Türkçe karakter temizleyici (Link yapısı için)
function slugify(text) {
    if(!text) return "";
    const trMap = {'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'};
    return text.toLowerCase()
        .replace(/[çğşüıö]/g, char => trMap[char])
        .replace(/[^a-z0-9]/g, '');
}

app.get('/api/vakitler', async (req, res) => {
    // Varsayılan değer yok! Ne gelirse o.
    // Eğer parametre yollamazsan hata döneriz ki "kafadan element uydurma" olayı bitsin.
    let { sehir, ilce } = req.query;

    if (!sehir || !ilce) {
        return res.status(400).json({ error: 'Eksik Parametre', details: 'Lütfen şehir ve ilçe gönderin.' });
    }

    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(ilce);
    
    // NTV Linki: ntv.com.tr/namaz-vakitleri/istanbul/beylikduzu
    const targetUrl = `https://www.ntv.com.tr/namaz-vakitleri/${cleanSehir}/${cleanIlce}`;

    try {
        const response = await axios.get(targetUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0' } 
        });

        const $ = cheerio.load(response.data);
        const now = new Date();
        const trDate = new Intl.DateTimeFormat('tr-TR', {
            timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric'
        }).format(now);

        let foundData = null;
        let tomorrowData = null;

        $('table tbody tr').each((index, element) => {
            const cols = $(element).find('td');
            if (cols.length < 7) return;

            const rowDateRaw = $(cols[0]).text().trim();
            
            // Bugünün tarihini içeren satırı bul
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
            // Yarını bul (Sayaç için)
            if (foundData && !tomorrowData && !rowDateRaw.includes(trDate) && index > 0) {
                 tomorrowData = { Fajr: $(cols[1]).text().trim() };
            }
        });

        if (!foundData) throw new Error("Tarih eşleşmedi");

        res.json({
            success: true,
            source: 'NTV',
            location: `${ilce.toUpperCase()} / ${sehir.toUpperCase()}`,
            times: foundData,
            tomorrowFajr: tomorrowData ? tomorrowData.Fajr : null
        });

    } catch (error) {
        // Hata durumunda ne olduğunu net görelim
        res.status(404).json({ 
            error: 'Veri Bulunamadı', 
            details: 'Bu ilçe için NTV sayfasında veri yok veya isim yanlış.',
            link: targetUrl
        });
    }
});

module.exports = app;
