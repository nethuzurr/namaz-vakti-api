const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// Tüm güvenlik kilitlerini aç
app.use(cors({ origin: '*', methods: '*', allowedHeaders: '*' }));

// Türkçe karakterleri ve boşlukları temizle
function slugify(text) {
    if (!text) return "";
    const trMap = {'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'};
    return text.toLowerCase()
        .replace(/[çğşüıö]/g, char => trMap[char])
        .replace(/[^a-z0-9]/g, ''); // Sadece harf ve rakam kalsın
}

app.get('/api/vakitler', async (req, res) => {
    let { sehir, ilce } = req.query;

    // 1. Web'de test ederken patlamaması için varsayılanlar (Sadece parametre yoksa devreye girer)
    if (!sehir) sehir = "istanbul";
    if (!ilce) ilce = "beylikduzu";

    // 2. NTV UYUM MODU: NTV "Merkez" kelimesini sevmez.
    // Eğer GPS "Merkez" dediyse, NTV'nin anlayacağı dile çevirelim ama kullanıcıya çaktırmayalım.
    let searchIlce = ilce;
    if (ilce.toLowerCase() === 'merkez') {
        if (sehir.toLowerCase().includes('istanbul')) searchIlce = 'fatih';
        else if (sehir.toLowerCase().includes('ankara')) searchIlce = 'cankaya';
        else if (sehir.toLowerCase().includes('izmir')) searchIlce = 'konak';
        // Diğer şehirlerde 'merkez' çalışabilir, dokunmuyoruz.
    }

    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(searchIlce);

    // Hangi linke gidiyoruz?
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

        if (!foundData) throw new Error("Tablo bulundu ama tarih eşleşmedi.");

        res.json({
            success: true,
            source: 'NTV',
            location: `${ilce.toUpperCase()} / ${sehir.toUpperCase()}`, // Ekranda orijinal ismi göster (Merkez ise Merkez yazar)
            search_location: `${cleanIlce} / ${cleanSehir}`, // Arka planda aranan yer
            times: foundData,
            tomorrowFajr: tomorrowData ? tomorrowData.Fajr : null
        });

    } catch (error) {
        // Hata durumunda sorunun kaynağını net söyle
        res.status(404).json({ 
            error: 'Veri Bulunamadı (404)', 
            message: 'NTV sitesinde bu ilçe için sayfa yok.',
            tried_url: targetUrl, // Hangi linki denedi de bulamadı?
            original_input: `${ilce} / ${sehir}`
        });
    }
});

module.exports = app;
