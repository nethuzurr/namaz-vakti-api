// api/index.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// Türkçe karakterleri İngilizceye çevir (Link yapısı için)
function slugify(text) {
    const trMap = {
        'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's',
        'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'
    };
    return text.toLowerCase()
        .replace(/[çğşüıö]/g, char => trMap[char])
        .replace(/[^a-z0-9]/g, ''); // Sadece harf ve rakam
}

app.get('/api/vakitler', async (req, res) => {
    let { sehir, ilce } = req.query;
    
    // Varsayılanlar
    if (!sehir) sehir = "istanbul";
    if (!ilce) ilce = "beylikduzu";

    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(ilce);

    try {
        // NTV Link Yapısı: https://www.ntv.com.tr/namaz-vakitleri/istanbul/beylikduzu
        const url = `https://www.ntv.com.tr/namaz-vakitleri/${cleanSehir}/${cleanIlce}`;
        console.log("Kaynak:", url);

        // Tarayıcı gibi davranarak sayfayı çek
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        
        // NTV'de bugünün verisi genellikle "today-row" class'ına sahiptir veya tablonun ilk satırıdır.
        // Ancak biz garantici olup bugünün tarihini sayfada arayacağız.
        
        // Türkiye Tarihini Bul (Gün.Ay.Yıl)
        const now = new Date();
        const trDate = new Intl.DateTimeFormat('tr-TR', {
            timeZone: 'Europe/Istanbul',
            day: 'numeric',
            month: 'long', // "Aralık" gibi uzun isim
            year: 'numeric'
        }).format(now); 
        // Çıktı Örn: "15 Aralık 2025"
        
        // Tablo satırlarını gez
        let foundData = null;
        let tomorrowData = null;

        // Tablo satırlarını bul
        $('table tbody tr').each((index, element) => {
            const cols = $(element).find('td');
            if (cols.length < 7) return;

            // Satırdaki tarihi al
            const rowDateRaw = $(cols[0]).text().trim(); // Örn: 15 Aralık 2025 Pazartesi

            // Eğer satırdaki tarih, bugünün tarihini içeriyorsa AL
            if (rowDateRaw.includes(trDate) || index === 0) { 
                // index === 0: Eğer tarih eşleşmesi bulamazsak (format farkından), ilk satırı bugün kabul et (NTV ilk satıra bugünü koyar)
                if (!foundData) {
                    foundData = {
                        date: rowDateRaw,
                        Fajr: $(cols[1]).text().trim(),    // İmsak
                        Sunrise: $(cols[2]).text().trim(), // Güneş
                        Dhuhr: $(cols[3]).text().trim(),   // Öğle
                        Asr: $(cols[4]).text().trim(),     // İkindi
                        Maghrib: $(cols[5]).text().trim(), // Akşam
                        Isha: $(cols[6]).text().trim()     // Yatsı
                    };
                }
            }
            
            // Bugünü bulduysak, bir sonraki satırı "Yarın" olarak al
            if (foundData && !tomorrowData && !rowDateRaw.includes(trDate) && index > 0) {
                 tomorrowData = {
                    Fajr: $(cols[1]).text().trim()
                 };
            }
        });

        if (!foundData) {
            throw new Error("Tablo okundu ama tarih eşleşmedi.");
        }

        res.json({
            success: true,
            source: 'NTV (Web Scrape)',
            location: `${ilce.toUpperCase()} / ${sehir.toUpperCase()}`,
            date: foundData.date,
            times: {
                Fajr: foundData.Fajr,
                Sunrise: foundData.Sunrise,
                Dhuhr: foundData.Dhuhr,
                Asr: foundData.Asr,
                Maghrib: foundData.Maghrib,
                Isha: foundData.Isha
            },
            tomorrowFajr: tomorrowData ? tomorrowData.Fajr : null
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            error: 'Veri Çekilemedi', 
            details: error.message,
            url: `ntv.com.tr/namaz-vakitleri/${cleanSehir}/${cleanIlce}`
        });
    }
});

module.exports = app;
