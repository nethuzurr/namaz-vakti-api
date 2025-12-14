// api/index.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// Türkçe karakter düzeltme (Link yapısı için)
function slugify(text) {
    const trMap = {
        'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's',
        'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'
    };
    return text.toLowerCase()
        .replace(/[çğşüıö]/g, char => trMap[char])
        .replace(/[^a-z0-9]/g, ''); // Sadece harf ve rakam kalsın (Habertürk formatı)
}

app.get('/api/vakitler', async (req, res) => {
    let { sehir, ilce } = req.query;
    
    // Varsayılanlar
    if (!sehir) sehir = "istanbul";
    if (!ilce) ilce = "beylikduzu";

    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(ilce);

    try {
        // Habertürk URL Yapısı: https://www.haberturk.com/namaz-vakitleri/istanbul/beylikduzu
        const url = `https://www.haberturk.com/namaz-vakitleri/${cleanSehir}/${cleanIlce}`;
        console.log("Hedef:", url);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const prayerList = [];

        // Sayfadaki aylık tabloyu bul
        // Genelde "table" etiketidir.
        $('table tbody tr').each((index, element) => {
            const cols = $(element).find('td');
            
            // Satırda en az 7 sütun varsa (Tarih + 6 Vakit) veri vardır
            if (cols.length >= 7) {
                // Tarihi al (Örn: 15 Aralık 2025)
                const rawDate = $(cols[0]).text().trim();
                
                // Habertürk tarih formatını (15 Aralık 2025) bizim formata (15.12.2025) çevir
                const formattedDate = parseHaberturkDate(rawDate);
                
                if (formattedDate) {
                    prayerList.push({
                        date: formattedDate,
                        times: {
                            Fajr: $(cols[1]).text().trim(),    // İmsak
                            Sunrise: $(cols[2]).text().trim(), // Güneş
                            Dhuhr: $(cols[3]).text().trim(),   // Öğle
                            Asr: $(cols[4]).text().trim(),     // İkindi
                            Maghrib: $(cols[5]).text().trim(), // Akşam
                            Isha: $(cols[6]).text().trim()     // Yatsı
                        }
                    });
                }
            }
        });

        // Eğer tablo boşsa veya site yapısı değiştiyse hata döndür
        if (prayerList.length === 0) {
            throw new Error("Tablo okunamadı veya ilçe ismi yanlış.");
        }

        res.json({
            success: true,
            source: 'Haberturk',
            location: `${ilce.toUpperCase()} / ${sehir.toUpperCase()}`,
            data: prayerList
        });

    } catch (error) {
        res.status(500).json({ error: 'Veri Çekilemedi', details: error.message });
    }
});

// Ay isimlerini sayıya çevir
function parseHaberturkDate(dateStr) {
    // Gelen: "15 Aralık 2025 Pazartesi"
    const parts = dateStr.split(' ');
    if (parts.length < 3) return null;

    const day = parts[0].padStart(2, '0');
    const monthName = parts[1].toLowerCase();
    const year = parts[2];

    const months = {
        'ocak': '01', 'şubat': '02', 'subat': '02', 'mart': '03', 'nisan': '04', 'mayıs': '05', 'mayis': '05',
        'haziran': '06', 'temmuz': '07', 'ağustos': '08', 'agustos': '08', 'eylül': '09', 'eylul': '09',
        'ekim': '10', 'kasım': '11', 'kasim': '11', 'aralık': '12', 'aralik': '12'
    };

    const month = months[monthName];
    if (!month) return null;

    return `${day}.${month}.${year}`; // Çıktı: 15.12.2025
}

module.exports = app;
