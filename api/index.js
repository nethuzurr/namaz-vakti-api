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

    if (!ilce) ilce = ""; 

    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(ilce);
    
    // 🔥 DEĞİŞİKLİK BURADA: URL'nin sonuna /aylik ekledik. 
    // Bu sayede NTV bize 5 günlük değil, 30 günlük tabloyu gönderiyor.
    let targetUrl = `https://www.ntv.com.tr/namaz-vakitleri/${cleanSehir}`;
    if (cleanIlce) {
        targetUrl += `/${cleanIlce}`;
    }
    targetUrl += "/aylik"; 

    console.log(`🔗 Hedef URL: ${targetUrl}`);

    try {
        const response = await axios.get(targetUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } 
        });

        const $ = cheerio.load(response.data);
        const haftalikListe = [];

        // Tablo satırlarını dönüyoruz
        $('table tbody tr').each((index, element) => {
            const cols = $(element).find('td');
            if (cols.length < 7) return;

            const rawDateStr = $(cols[0]).text().trim(); // Örn: "30 Aralık 2025 Pazartesi"
            let isoDate = null;

            try {
                const parts = rawDateStr.split(' ');
                if(parts.length >= 2) {
                    const day = parts[0].padStart(2, '0');
                    const month = monthsTR[parts[1]];
                    // Eğer tabloda yıl yazmıyorsa mevcut yılı kullan
                    const year = (parts[2] && parts[2].length === 4) ? parts[2] : new Date().getFullYear();
                    isoDate = `${year}-${month}-${day}`;
                }
            } catch (e) { }

            if (isoDate) {
                haftalikListe.push({
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

        if (haftalikListe.length === 0) {
            throw new Error("Veri çekilemedi. NTV sayfa yapısını değiştirmiş olabilir.");
        }

        // Tarih seçimi
        let targetDate = d || new Date().toISOString().split('T')[0];
        let selectedData = haftalikListe.find(item => item.isoDate === targetDate);

        if (!selectedData) {
            selectedData = haftalikListe[0];
        }

        // Yarınki imsak vakti (Kalan süreyi hesaplamak için kullanıyorsan lazım olur)
        let tomorrowFajr = "00:00";
        const currentIndex = haftalikListe.findIndex(item => item.isoDate === selectedData.isoDate);
        if (currentIndex !== -1 && currentIndex + 1 < haftalikListe.length) {
            tomorrowFajr = haftalikListe[currentIndex + 1].Fajr;
        }

        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=600');
        
        res.json({
            success: true,
            source: 'NTV',
            location: cleanIlce ? `${ilce.toUpperCase()} / ${sehir.toUpperCase()}` : sehir.toUpperCase(),
            count: haftalikListe.length, // Kaç günlük veri geldiğini görelim
            times: selectedData, 
            tomorrowFajr: tomorrowFajr,
            full_list: haftalikListe // Artık burada ~30 günlük veri olacak
        });

    } catch (error) {
        console.error("🔥 Hata:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = app;
