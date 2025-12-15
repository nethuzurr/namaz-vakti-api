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
    let { sehir, ilce } = req.query;

    console.log(`📡 İSTEK GELDİ: Şehir: "${sehir}" | İlçe: "${ilce}"`);

    // DÜZELTME: Varsayılan değerler (İstanbul/Beylikdüzü) KALDIRILDI.
    
    // Şehir zorunludur, yoksa hata verelim
    if (!sehir) {
        return res.status(400).json({ success: false, message: "Şehir parametresi zorunludur." });
    }

    // İlçe yoksa veya null ise boş string yapalım (Beylikdüzü yapmayalım!)
    if (!ilce) {
        ilce = ""; 
    }

    const cleanSehir = slugify(sehir);
    const cleanIlce = slugify(ilce);
    
    // Eğer ilçe boşsa URL sonundaki slash sorun çıkarmaz, NTV bunu yönetir veya yönlendirir.
    // Örn: .../namaz-vakitleri/tokat/ (Sondaki boşluk bazen merkez kabul edilir)
    let targetUrl = `https://www.ntv.com.tr/namaz-vakitleri/${cleanSehir}`;
    if (cleanIlce) {
        targetUrl += `/${cleanIlce}`;
    }

    console.log(`🔗 Hedef URL: ${targetUrl}`);

    try {
        const response = await axios.get(targetUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } 
        });

        const $ = cheerio.load(response.data);
        const haftalikListe = [];

        $('table tbody tr').each((index, element) => {
            const cols = $(element).find('td');
            if (cols.length < 7) return;

            const rawDateStr = $(cols[0]).text().trim(); 
            let isoDate = null;
            try {
                const parts = rawDateStr.split(' ');
                if(parts.length >= 3) {
                    const d = parts[0].padStart(2, '0');
                    const m = monthsTR[parts[1]];
                    const y = parts[2];
                    isoDate = `${y}-${m}-${d}`;
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
            throw new Error("Tablo bulunamadı veya boş.");
        }

        const today = new Date();
        const todayISO = today.toISOString().split('T')[0];
        
        let bugunData = haftalikListe.find(d => d.isoDate === todayISO);
        if (!bugunData) bugunData = haftalikListe[0];

        let tomorrowFajr = "00:00";
        const currentIndex = haftalikListe.indexOf(bugunData);
        if (currentIndex !== -1 && currentIndex + 1 < haftalikListe.length) {
            tomorrowFajr = haftalikListe[currentIndex + 1].Fajr;
        }

        res.json({
            success: true,
            source: 'NTV',
            location: cleanIlce ? `${ilce.toUpperCase()} / ${sehir.toUpperCase()}` : sehir.toUpperCase(),
            times: bugunData,
            tomorrowFajr: tomorrowFajr,
            full_list: haftalikListe
        });

    } catch (error) {
        console.error("🔥 Hata:", error.message);
        // 404 hatasını frontend'in anlaması için status kodunu geçiriyoruz
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ success: false, message: "İlçe bulunamadı (NTV 404)" });
        }
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = app;
