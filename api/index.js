const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: '*', allowedHeaders: '*' }));

const monthsTR = {
    'Ocak': '01', 'Şubat': '02', 'Mart': '03', 'Nisan': '04', 'Mayıs': '05', 'Haziran': '06',
    'Temmuz': '07', 'Ağustos': '08', 'Eylül': '09', 'Ekim': '10', 'Kasım': '11', 'Aralık': '12'
};

function slugify(text) {
    if (!text) return "";
    const trMap = {'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'};
    return text.toLowerCase()
        .replace(/[çğşüıö]/g, char => trMap[char])
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-');
}

app.get('/api/vakitler', async (req, res) => {
    let { sehir, ilce, d } = req.query;

    if (!sehir) {
        return res.status(400).json({ success: false, message: "Şehir parametresi zorunludur." });
    }

    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(ilce || "");
    
    // 🔥 YENİ KAYNAK: Habertürk hem stabil hem de direkt 30 günlük tablo veriyor.
    let targetUrl = `https://www.haberturk.com/namaz-vakitleri/${cleanSehir}`;
    if (cleanIlce) {
        targetUrl += `/${cleanIlce}`;
    }

    console.log(`🔗 Bağlanılan URL: ${targetUrl}`);

    try {
        const response = await axios.get(targetUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0' } 
        });

        const $ = cheerio.load(response.data);
        const tamListe = [];

        // Habertürk'ün tablo satırlarını hedefliyoruz
        $('table tbody tr').each((index, element) => {
            const cols = $(element).find('td');
            if (cols.length < 7) return;

            const rawDateStr = $(cols[0]).text().trim(); // Örn: "31 Aralık 2025 Çarşamba"
            let isoDate = null;

            try {
                const parts = rawDateStr.split(' ');
                if(parts.length >= 3) {
                    const day = parts[0].padStart(2, '0');
                    const month = monthsTR[parts[1]];
                    const year = parts[2];
                    isoDate = `${year}-${month}-${day}`;
                }
            } catch (e) { }

            if (isoDate) {
                tamListe.push({
                    isoDate: isoDate,
                    rawDate: rawDateStr,
                    Fajr: $(cols[1]).text().trim(),
                    Sunrise: $(cols[2]).text().trim(),
                    Dhuhr: $(cols[3]).text().trim(),
                    Asr: $(cols[4]).text().trim(),
                    Maghrib: $(cols[5]).text().trim(),
                    Isha: $(cols[6]).text().trim()
                });
            }
        });

        if (tamListe.length === 0) throw new Error("Veri bulunamadı.");

        // Seçili günü bulma (veya bugünü)
        let targetDate = d || new Date().toISOString().split('T')[0];
        let selectedData = tamListe.find(item => item.isoDate === targetDate) || tamListe[0];

        // Yarınki İmsak
        let tomorrowFajr = "00:00";
        const currentIndex = tamListe.findIndex(item => item.isoDate === selectedData.isoDate);
        if (currentIndex !== -1 && currentIndex + 1 < tamListe.length) {
            tomorrowFajr = tamListe[currentIndex + 1].Fajr;
        }

        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=600');
        
        res.json({
            success: true,
            source: 'HaberTurk (30 Günlük)',
            location: ilce ? `${ilce.toUpperCase()} / ${sehir.toUpperCase()}` : sehir.toUpperCase(),
            count: tamListe.length, 
            times: selectedData, 
            tomorrowFajr: tomorrowFajr,
            full_list: tamListe 
        });

    } catch (error) {
        console.error("🔥 Hata:", error.message);
        res.status(500).json({ success: false, message: "Veri çekilemedi veya URL hatalı." });
    }
});

module.exports = app;
