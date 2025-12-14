const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*', methods: '*', allowedHeaders: '*' }));

function slugify(text) {
    if (!text) return "";
    const trMap = {'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'};
    return text.toLowerCase()
        .replace(/[çğşüıö]/g, char => trMap[char])
        .replace(/[^a-z0-9]/g, '');
}

app.get('/api/vakitler', async (req, res) => {
    let { sehir, ilce } = req.query;

    console.log(`📡 İSTEK GELDİ: Şehir: ${sehir} | İlçe: ${ilce}`);

    if (!sehir) sehir = "istanbul";
    if (!ilce) ilce = "beylikduzu";

    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(ilce);
    
    const targetUrl = `https://www.ntv.com.tr/namaz-vakitleri/${cleanSehir}/${cleanIlce}`;

    try {
        const response = await axios.get(targetUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0' } 
        });

        const $ = cheerio.load(response.data);
        const haftalikListe = [];

        $('table tbody tr').each((index, element) => {
            const cols = $(element).find('td');
            if (cols.length < 7) return;

            // Tarih verisini alıp konsola basalım ki görelim
            const rawDate = $(cols[0]).text().trim();
            
            haftalikListe.push({
                date: rawDate, 
                Fajr: $(cols[1]).text().trim(),
                Sunrise: $(cols[2]).text().trim(),
                Dhuhr: $(cols[3]).text().trim(),
                Asr: $(cols[4]).text().trim(),
                Maghrib: $(cols[5]).text().trim(),
                Isha: $(cols[6]).text().trim()
            });
        });

        if (haftalikListe.length === 0) {
            console.log("❌ Tablo boş! NTV HTML yapısı değişmiş olabilir veya URL yanlış.");
            throw new Error("Tablo yapısı değişmiş veya veri bulunamadı.");
        }

        const bugunData = haftalikListe[0];

        // LOGLAMA: Burası sana terminalde gerçeği gösterecek
        console.log("✅ NTV'den Çekilen İlk Tarih:", bugunData.date);
        console.log("⚠️ Eğer telefonun tarihi bu değilse, uygulama veriyi göstermez!");

        res.json({
            success: true,
            source: 'NTV',
            location: `${ilce.toUpperCase()} / ${sehir.toUpperCase()}`,
            server_time_check: new Date().toLocaleString(), // Sunucunun (PC'nin) saati
            times: bugunData, 
            results: haftalikListe 
        });

    } catch (error) {
        console.error("🔥 API Hatası:", error.message);
        res.status(404).json({ 
            error: 'Veri Bulunamadı', 
            message: 'NTV erişimi başarısız.',
            tried_url: targetUrl
        });
    }
});

module.exports = app;
