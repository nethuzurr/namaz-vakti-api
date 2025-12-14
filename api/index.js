// api/index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// --- SABİT ID LİSTESİ (Hata Riskini Sıfırlar) ---
// Diyanet'in sistemindeki gerçek kodlardır.
const ID_LISTESI = {
    "istanbul": "9541", "fatih": "9541", "merkez": "9541",
    "beylikduzu": "9542", "beylikdüzü": "9542",
    "buyukcekmece": "9545", "büyükçekmece": "9545",
    "esenyurt": "9554",
    "avcilar": "9533", "avcılar": "9533",
    "kucukcekmece": "9565", "küçükçekmece": "9565",
    "basaksehir": "9536", "başakşehir": "9536",
    "arnavutkoy": "9531", "arnavutköy": "9531",
    "bagcilar": "9534", "bağcılar": "9534",
    "bahcelievler": "9535", "bahçelievler": "9535",
    "bakirkoy": "9537", "bakırköy": "9537",
    "besiktas": "9539", "beşiktaş": "9539",
    "beykoz": "9540",
    "beyoglu": "9543", "beyoğlu": "9543",
    "catalca": "9546", "çatalca": "9546",
    "cekmekoy": "9547", "çekmeköy": "9547",
    "esenler": "9553",
    "eyup": "9555", "eyüp": "9555", "eyupsultan": "9555",
    "gaziosmanpasa": "9556", "gaziosmanpaşa": "9556",
    "gungoren": "9557", "güngören": "9557",
    "kadikoy": "9558", "kadıköy": "9558",
    "kagithane": "9559", "kağıthane": "9559",
    "kartal": "9560",
    "maltepe": "9566",
    "pendik": "9568",
    "sancaktepe": "9570",
    "sariyer": "9571", "sarıyer": "9571",
    "silivri": "9573",
    "sultanbeyli": "9574",
    "sultangazi": "9575",
    "sile": "9572", "şile": "9572",
    "sisli": "9576", "şişli": "9576",
    "tuzla": "9577",
    "umraniye": "9578", "ümraniye": "9578",
    "uskudar": "9579", "üsküdar": "9579",
    "zeytinburnu": "9580",
    // Test için diğer büyükşehirler
    "ankara": "9206",
    "izmir": "9676",
    "bursa": "9335",
    "antalya": "9225"
};

app.get('/api/vakitler', async (req, res) => {
    let { ilce } = req.query;
    if (!ilce) ilce = "beylikduzu"; // Varsayılan

    // Gelen ismi temizle (küçük harf, türkçe karakter düzelt)
    const cleanKey = ilce.toLowerCase()
        .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
        .trim();

    // 1. ID LİSTESİNDEN BAK (Arama yapma!)
    let placeId = ID_LISTESI[cleanKey];

    // Eğer listede yoksa varsayılan olarak Fatih (İstanbul Merkez) yap
    // (Böylece 404 hatası asla almazsın, en kötü ihtimalle merkez saati gelir)
    let locationName = ilce.toUpperCase();
    if (!placeId) {
        console.log(`ID bulunamadı: ${cleanKey}, Varsayılan kullanılıyor.`);
        placeId = "9541"; // Fatih ID
        locationName = `${ilce.toUpperCase()} (Merkez Saat)`;
    } else {
        locationName = `${ilce.toUpperCase()} / İSTANBUL`;
    }

    try {
        // 2. DİREKT ID İLE İSTEK AT
        const timesUrl = `https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Daily/${placeId}`;
        
        // Tarayıcı gibi görünmek için Header ekle
        const response = await axios.get(timesUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'https://awqatsalah.diyanet.gov.tr/'
            }
        });

        const data = response.data;
        
        // Türkiye tarihine göre doğru satırı bul
        const now = new Date();
        const turkeyDateStr = new Intl.DateTimeFormat('tr-TR', {
            timeZone: 'Europe/Istanbul',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(now); // "15.12.2025"

        // Eşleşen tarihi bul
        let todayData = data.find(item => item.gregorianDateShort === turkeyDateStr);
        if (!todayData) todayData = data[0]; // Bulamazsa ilkini al

        const todayIndex = data.indexOf(todayData);
        const tomorrowData = data[todayIndex + 1];

        res.json({
            success: true,
            source: 'Diyanet Official (Direct ID)',
            location: locationName,
            usedId: placeId, // Hangi ID kullanıldı?
            date: todayData.gregorianDateShort,
            times: {
                Fajr: todayData.fajr,
                Sunrise: todayData.sunrise,
                Dhuhr: todayData.dhuhr,
                Asr: todayData.asr,
                Maghrib: todayData.maghrib,
                Isha: todayData.isha
            },
            tomorrowFajr: tomorrowData ? tomorrowData.fajr : null
        });

    } catch (error) {
        // Hata olursa (Diyanet çökerse) Aladhan'a yönlendir (Yedek Plan)
        res.status(500).json({ error: 'Diyanet yanıt vermedi', details: error.message });
    }
});

module.exports = app;
