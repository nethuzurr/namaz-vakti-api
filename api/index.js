const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*', methods: '*', allowedHeaders: '*' }));

// Türkçe karakter temizleyici
function slugify(text) {
    if (!text) return "";
    const trMap = {'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'};
    return text.toLowerCase()
        .replace(/[çğşüıö]/g, char => trMap[char])
        .replace(/[^a-z0-9]/g, '');
}

app.get('/api/vakitler', async (req, res) => {
    let { sehir, ilce } = req.query;

    if (!sehir) sehir = "istanbul";
    if (!ilce) ilce = "beylikduzu";

    // Akıllı İlçe Kontrolü (Merkez -> Fatih/Konak vs.)
    let searchIlce = ilce;
    if (ilce.toLowerCase() === 'merkez') {
        if (sehir.toLowerCase().includes('istanbul')) searchIlce = 'fatih';
        else if (sehir.toLowerCase().includes('ankara')) searchIlce = 'cankaya';
        else if (sehir.toLowerCase().includes('izmir')) searchIlce = 'konak';
    }

    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(searchIlce);
    const targetUrl = `https://www.ntv.com.tr/namaz-vakitleri/${cleanSehir}/${cleanIlce}`;

    try {
        const response = await axios.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(response.data);
        
        // Tüm listeyi tutacak dizi
        let weeklySchedule = [];

        // Tablodaki tüm satırları gez
        $('table tbody tr').each((index, element) => {
            const cols = $(element).find('td');
            if (cols.length < 7) return;

            // Satırı kaydet
            weeklySchedule.push({
                dateRaw: $(cols[0]).text().trim(), // Örn: 16 Aralık 2025 Salı
                times: {
                    Fajr: $(cols[1]).text().trim(),
                    Sunrise: $(cols[2]).text().trim(),
                    Dhuhr: $(cols[3]).text().trim(),
                    Asr: $(cols[4]).text().trim(),
                    Maghrib: $(cols[5]).text().trim(),
                    Isha: $(cols[6]).text().trim()
                }
            });
        });

        if (weeklySchedule.length === 0) throw new Error("Liste boş geldi");

        res.json({
            success: true,
            source: 'NTV (Bulk)',
            location: `${ilce.toUpperCase()} / ${sehir.toUpperCase()}`,
            data: weeklySchedule // ARTIK LİSTE DÖNÜYORUZ
        });

    } catch (error) {
        res.status(404).json({ 
            error: 'Veri Bulunamadı', 
            details: error.message,
            tried_url: targetUrl
        });
    }
});

module.exports = app;
