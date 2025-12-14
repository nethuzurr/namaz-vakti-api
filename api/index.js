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

    // 1. Varsayılanlar
    if (!sehir) sehir = "istanbul";
    if (!ilce) ilce = "beylikduzu";

    // 2. NTV UYUM MODU: 'Merkez' sorunu için fix
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
        const response = await axios.get(targetUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0' } 
        });

        const $ = cheerio.load(response.data);
        
        // Tüm haftayı tutacak boş bir liste oluşturuyoruz
        const haftalikListe = [];

        $('table tbody tr').each((index, element) => {
            const cols = $(element).find('td');
            
            // Satırda yeterli veri yoksa (başlık vs ise) atla
            if (cols.length < 7) return;

            // Verileri çek ve listeye ekle
            haftalikListe.push({
                date: $(cols[0]).text().trim(),      // Tarih
                Fajr: $(cols[1]).text().trim(),      // İmsak
                Sunrise: $(cols[2]).text().trim(),   // Güneş
                Dhuhr: $(cols[3]).text().trim(),     // Öğle
                Asr: $(cols[4]).text().trim(),       // İkindi
                Maghrib: $(cols[5]).text().trim(),   // Akşam
                Isha: $(cols[6]).text().trim()       // Yatsı
            });
        });

        if (haftalikListe.length === 0) throw new Error("Tablo yapısı değişmiş veya veri bulunamadı.");

        res.json({
            success: true,
            source: 'NTV',
            location: `${ilce.toUpperCase()} / ${sehir.toUpperCase()}`,
            search_location: `${cleanIlce} / ${cleanSehir}`,
            results: haftalikListe // Artık tek obje değil, bir liste dönüyor
        });

    } catch (error) {
        res.status(404).json({ 
            error: 'Veri Bulunamadı (404)', 
            message: 'NTV sitesinde bu ilçe için sayfa yok veya yapı değişmiş.',
            tried_url: targetUrl,
            original_input: `${ilce} / ${sehir}`
        });
    }
});

module.exports = app;
