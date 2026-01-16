const express = require("express");
const fetch = require("node-fetch");

const app = express();

const PORT = process.env.PORT || 8080;
const RD_KEY = process.env.REAL_DEBRID_API;

console.log(`Starting with PORT: ${PORT}, RD_KEY: ${RD_KEY ? "yes" : "no"}`);

/* =========================
   MANIFEST
========================= */
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "com.souhail.premium",
    version: "2.0.0",
    name: "Souhail Premium",
    description: "Real-Debrid Streams with Clean Details",
    logo: "https://cdn-icons-png.flaticon.com/512/3095/3095588.png",
    background: "https://images.unsplash.com/photo-1536440136628-849c177e76a1",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: []
  });
});

/* =========================
   STREAM
========================= */
app.get("/stream/:type/:id.json", async (req, res) => {
  if (!RD_KEY) {
    console.log("❌ No RD Key");
    return res.json({ streams: [] });
  }

  try {
    const { type, id } = req.params;
    
    // 1. الحصول على معلومات الفيلم
    let movieName = "Movie";
    let movieYear = "";
    
    try {
      const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/find/${id}?api_key=9b8933e4c7b5c78de32f1d301b6988ed&external_source=imdb_id`
      );
      const tmdbData = await tmdbResponse.json();
      if (tmdbData.movie_results && tmdbData.movie_results.length > 0) {
        movieName = tmdbData.movie_results[0].title;
        movieYear = tmdbData.movie_results[0].release_date?.substring(0, 4) || "";
      }
    } catch (tmdbError) {
      console.log("TMDB error, using default name");
    }
    
    // 2. الحصول على الستريمات من Torrentio
    const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${type}/${id}.json`;
    console.log(`🌐 Fetching: ${torrentioUrl}`);
    
    const response = await fetch(torrentioUrl);
    const data = await response.json();
    
    if (!data.streams || data.streams.length === 0) {
      console.log("⚠️ No streams found");
      return res.json({ streams: [] });
    }
    
    console.log(`✅ Found ${data.streams.length} streams`);
    
    // 3. معالجة الستريمات
    const streams = data.streams
      // تصفية الأنواع السيئة
      .filter(s => {
        const t = s.title || s.name || "";
        return !/(CAM|TS|Telesync|SCR|HDCAM|R5|DVDScr)/i.test(t);
      })
      // ترتيب حسب الجودة والحجم
      .sort((a, b) => {
        const aTitle = a.title || "";
        const bTitle = b.title || "";
        
        // أولاً: 4K > 1080p > 720p > HD
        const aQualityScore = getQualityScore(aTitle);
        const bQualityScore = getQualityScore(bTitle);
        if (aQualityScore !== bQualityScore) {
          return bQualityScore - aQualityScore;
        }
        
        // ثم: الحجم الأكبر أولاً
        const aSize = extractSize(aTitle);
        const bSize = extractSize(bTitle);
        return bSize - aSize;
      })
      // بناء العناوين النهائية
      .map(s => {
        const t = s.title || s.name || "";
        const isCached = s.url.includes('real-debrid.com');
        
        // استخراج المعلومات
        const videoRange = extractVideoRange(t);
        const sizeFormatted = formatSize(extractSize(t));
        const quality = extract(t, /(2160p|1080p|720p|480p|360p)/i) || "HD";
        const codec = extract(t, /(H\.265|H\.264|x265|x264)/i) || "H.264";
        const audio = extract(t, /(Atmos|DDP5\.1|DD5\.1|AC3|AAC)/i) || "Audio";
        const source = extract(t, /(YTS|RARBG|TPB|ThePirateBay|1337x)/i) || "Torrent";
        
        // بناء العنوان بالشكل المطلوب
        const displayTitle = `❄️🎬 ${cleanTitle(t, movieName, movieYear)}
🟢💾 ${sizeFormatted}  | 🟢📽️ ${videoRange}
🟢📺 ${quality}  | 🟢🎞️ ${codec}
🟢🔊 ${audio}  | 🟢🧲 ${source}
🟢📡${isCached ? '✅ Cached on RD' : '🔗 Direct Torrent'}`;
        
        return {
          title: displayTitle,
          url: s.url,
          behaviorHints: s.behaviorHints || {}
        };
      });
    
    console.log(`🎉 Returning ${streams.length} processed streams`);
    res.json({ streams });
    
  } catch (err) {
    console.error("💥 Stream error:", err.message);
    res.json({ streams: [] });
  }
});

/* =========================
   INSTALL PAGE
========================= */
app.get("/install", (req, res) => {
  const host = req.hostname;
  const manifestUrl = `https://${host}/manifest.json`;
  const stremioUrl = `stremio://stremio.xyz/app/${host}/manifest.json`;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Souhail Premium</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          text-align: center;
          background: #1a1a1a;
          color: white;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: #2a2a2a;
          padding: 30px;
          border-radius: 15px;
        }
        .quality-examples {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin: 20px 0;
        }
        .quality-box {
          background: #333;
          padding: 10px;
          border-radius: 8px;
          text-align: left;
          font-family: monospace;
          font-size: 12px;
          white-space: pre-line;
        }
        .btn {
          display: block;
          width: 100%;
          padding: 15px;
          margin: 10px 0;
          background: #00b4db;
          color: white;
          text-decoration: none;
          border-radius: 10px;
          font-weight: bold;
        }
        .btn:hover {
          background: #0083b0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎬 Souhail Premium</h1>
        <p>Real-Debrid Streaming - All Qualities Available</p>
        
        <div class="quality-examples">
          <div class="quality-box">
🎬 Movie (2024)
💾 28.67 GB | DV
📽️ 2160p | 🎞️ H.265
🔊 Atmos | 🧲 TPB
✅ Cached on RD
          </div>
          <div class="quality-box">
🎬 Movie (2024)
💾 8.75 GB | HDR
📽️ 1080p | 🎞️ H.264
🔊 5.1 | 🧲 YTS
✅ Cached on RD
          </div>
          <div class="quality-box">
🎬 Movie (2024)
💾 1.45 GB | SDR
📽️ 720p | 🎞️ x264
🔊 AAC | 🧲 1337x
✅ Cached on RD
          </div>
        </div>
        
        <a href="${stremioUrl}" class="btn">📲 Install in Stremio</a>
        <a href="/manifest.json" class="btn" style="background: #666;">📄 View Manifest</a>
        
        <div style="margin-top: 30px; text-align: left;">
          <h3>✨ Available Qualities:</h3>
          <ul>
            <li>✅ 4K (2160p) - Highest quality</li>
            <li>✅ 1080p (Full HD) - Best balance</li>
            <li>✅ 720p (HD) - Smaller size</li>
            <li>✅ All cached on Real-Debrid</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get("/", (req, res) => res.redirect("/install"));

/* =========================
   HEALTH CHECK
========================= */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Souhail Premium",
    version: "2.0.0",
    rd_configured: !!RD_KEY,
    qualities: ["4K", "1080p", "720p"]
  });
});

/* =========================
   DEBUG TEST
========================= */
app.get("/test/:id?", async (req, res) => {
  const testId = req.params.id || "tt0111161";
  
  // أمثلة للجودات المختلفة
  const testTitles = [
    "One.Battle.After.Another.2025.2160p.WEB-DL.DV.HDR.DDP5.1.Atmos.H265-AOC 28.67 GB 🌟 455 🌟 thepiratebay",
    "The.Movie.2024.1080p.BluRay.x264.DTS-HD.MA.5.1-RARBG 8.75 GB 🌟 1250 🌟 rarbg",
    "Another.Movie.2023.720p.BluRay.x264.AAC-YTS 1.45 GB 🌟 5200 🌟 yts"
  ];
  
  const results = testTitles.map((testTitle, index) => {
    const quality = index === 0 ? "4K" : index === 1 ? "1080p" : "720p";
    
    return {
      quality: quality,
      original_title: testTitle,
      cleaned: cleanTitle(testTitle),
      size: formatSize(extractSize(testTitle)),
      video_range: extractVideoRange(testTitle),
      quality_extracted: extract(testTitle, /(2160p|1080p|720p|480p|360p)/i) || "HD",
      codec: extract(testTitle, /(H\.265|H\.264|x265|x264)/i) || "H.264",
      audio: extract(testTitle, /(Atmos|DDP5\.1|DD5\.1|AC3|AAC)/i) || "Audio",
      source: extract(testTitle, /(YTS|RARBG|TPB|ThePirateBay|1337x)/i) || "Torrent",
      final_display: `🎬 ${cleanTitle(testTitle)}
💾 ${formatSize(extractSize(testTitle))} | ${extractVideoRange(testTitle)}
📽️ ${extract(testTitle, /(2160p|1080p|720p|480p|360p)/i) || "HD"}
🎞️ ${extract(testTitle, /(H\.265|H\.264|x265|x264)/i) || "H.264"}
🔊 ${extract(testTitle, /(Atmos|DDP5\.1|DD5\.1|AC3|AAC)/i) || "Audio"}
🧲 ${extract(testTitle, /(YTS|RARBG|TPB|ThePirateBay|1337x)/i) || "Torrent"}`
    };
  });
  
  res.json({
    test_id: testId,
    qualities_tested: ["4K", "1080p", "720p"],
    results: results
  });
});

/* =========================
   HELPER FUNCTIONS
========================= */
function extract(text, regex) {
  const match = text.match(regex);
  return match ? match[0] : null;
}

function extractVideoRange(text) {
  if (/dolby\s?vision|dv/i.test(text)) return "Dolby Vision";
  if (/hdr10\+/i.test(text)) return "HDR10+";
  if (/hdr/i.test(text)) return "HDR";
  return "SDR";
}

function cleanTitle(text, movieName = "", movieYear = "") {
  if (movieName && movieName !== "Movie") {
    return `${movieName}${movieYear ? ` (${movieYear})` : ''}`;
  }
  
  // تنظيف العنوان الأصلي
  let cleaned = text
    .replace(/\[RD\]/g, '')
    .replace(/Jackettio/g, '')
    .replace(/ElfHosted/g, '')
    .replace(/Torrentio/g, '')
    .replace(/Souhail Pro/g, '')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // إزالة المعلومات التقنية
  const techTerms = ['2160p', '1080p', '720p', '480p', '360p', '4K', 'WEB-DL', 'WEBRip', 'BluRay', 
                    'HDR', 'DV', 'x265', 'x264', 'H.265', 'H.264', 'DTS', 'Atmos',
                    'AAC', 'AC3', '5.1', '10Bit', 'REMUX', 'VBR', 'CBR'];
  
  techTerms.forEach(term => {
    cleaned = cleaned.replace(new RegExp(term, 'gi'), '');
  });
  
  // استخراج اسم الفيلم (أول 3 كلمات)
  const words = cleaned.split(' ').filter(w => w.length > 2);
  const moviePart = words.slice(0, 3).join(' ');
  
  // استخراج السنة
  const yearMatch = text.match(/(19|20)\d{2}/);
  const year = yearMatch ? yearMatch[0] : "";
  
  return `${moviePart || "Movie"}${year ? ` (${year})` : ''}`;
}

function extractSize(text) {
  const match = text.match(/(\d+(\.\d+)?)\s?(GB|MB)/i);
  if (!match) return 0;
  
  const size = parseFloat(match[1]);
  const unit = match[3].toUpperCase();
  
  return unit === "GB" ? size * 1024 : size;
}

function formatSize(sizeMB) {
  if (!sizeMB || sizeMB === 0) return "Size N/A";
  
  if (sizeMB >= 1024) {
    return (sizeMB / 1024).toFixed(2) + " GB";
  } else {
    return sizeMB.toFixed(0) + " MB";
  }
}

function getQualityScore(title) {
  if (/(2160p|4K)/i.test(title)) return 4;
  if (/(1080p|FHD)/i.test(title)) return 3;
  if (/(720p|HD)/i.test(title)) return 2;
  if (/(480p|SD)/i.test(title)) return 1;
  return 0;
}

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`
=======================================
🎬 Souhail Premium v2.0.0
=======================================
📍 Local: http://localhost:${PORT}
📲 Install: http://localhost:${PORT}/install
🔧 Test: http://localhost:${PORT}/test
=======================================
Available Qualities:
✅ 4K (2160p) - Ultra HD
✅ 1080p - Full HD
✅ 720p - HD
✅ All cached on Real-Debrid
=======================================
Example Outputs:
🎬 Movie (2024)
💾 28.67 GB | Dolby Vision
📽️ 2160p | 🎞️ H.265
🔊 Atmos | 🧲 ThePirateBay
✅ Cached on RD

🎬 Movie (2024)
💾 8.75 GB | HDR
📽️ 1080p | 🎞️ H.264
🔊 5.1 | 🧲 YTS
✅ Cached on RD

🎬 Movie (2024)
💾 1.45 GB | SDR
📽️ 720p | 🎞️ x264
🔊 AAC | 🧲 1337x
✅ Cached on RD
=======================================
  `);
});
