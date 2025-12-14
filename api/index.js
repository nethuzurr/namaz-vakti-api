const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// Güvenlik: Her yerden erişime izin ver
app.use(cors({ origin: '*', methods: '*', allowedHeaders: '*' }));

// Temizleme Fonksiyonu (NTV link yapısına uygun hale getirir)
function slugify(text) {
    if (!text) return "";
    const trMap = {'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o'};
    return text.toLowerCase()
        .replace(/[çğşüıö]/g, char => trMap[char])
        .replace(/[^a-z0-9]/g, ''); // Tire (-) bile kaldırıp bitişik yazıyor (örn: gaziosmanpasa)
}

app.get('/api/vakitler', async (req, res) => {
    // Query'den verileri al
    let { sehir, ilce } = req.query;

    // HATA AYIKLAMA: Gelen veriyi konsola bas (Sunucu loglarından kontrol et)
    console.log(`Gelen İstek -> Şehir: ${sehir}, İlçe: ${ilce}`);

    // Eğer parametre hiç gelmemişse hata döndür veya varsayılan ata
    // (Burada varsayılanı sildim, veri gelmezse uyarsın)
    if (!sehir || !ilce) {
        return res.status(400).json({
            error: 'Eksik Parametre',
            message: 'Lütfen ?sehir=istanbul&ilce=kadikoy şeklinde parametre gönderin.'
        });
    }

    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(ilce); // Ne gelirse onu temizleyip koyar, Fatih'e çevirmez.
    
    // NTV Link Yapısı
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

            haftalikListe.push({
                date: $(cols[0]).text().trim(),
                Fajr: $(cols[1]).text().trim(),
                Sunrise: $(cols[2]).text().trim(),
                Dhuhr: $(cols[3]).text().trim(),
                Asr: $(cols[4]).text().trim(),
                Maghrib: $(cols[5]).text().trim(),
                Isha: $(cols[6]).text().trim()
            });
        });

        if (haftalikListe.length === 0) throw new Error("Tablo boş geldi.");

        const bugunData = haftalikListe[0];

        res.json({
            success: true,
            location: `${ilce.toUpperCase()} / ${sehir.toUpperCase()}`, // Senin gönderdiğin orijinal isim
            search_url: targetUrl, // Hangi adrese gittiğini gör
            times: bugunData, 
            results: haftalikListe 
        });

    } catch (error) {
        console.error("API Hatası:", error.message);
        
        // NTV'de sayfa yoksa (Örn: Mahalle adı girildiyse) burası çalışır
        res.status(404).json({ 
            error: 'Veri Bulunamadı', 
            message: 'Bu şehir/ilçe kombinasyonu NTV sitesinde bulunamadı. Lütfen ilçe ismini kontrol edin (Mahalle girmeyin).',
            tried_url: targetUrl
        });
    }
});

module.exports = app;
