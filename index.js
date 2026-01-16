const express = require("express");
const fetch = require("node-fetch");

const app = express();

const PORT = process.env.PORT || 8080;
const RD_KEY = process.env.REAL_DEBRID_API;

console.log(`Starting with PORT: ${PORT}, RD_KEY: ${RD_KEY ? "yes" : "no"}`);

/* =========================
   MANIFEST - CORRECTED
========================= */
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "com.souhail.stremio",
    version: "1.0.0",
    name: "Souhail Premium",
    description: "Real-Debrid Streams with Full Info",
    logo: "https://cdn-icons-png.flaticon.com/512/3095/3095588.png",
    background: "https://images.unsplash.com/photo-1536440136628-849c177e76a1",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: []
  });
});

/* =========================
   STREAM - CORRECTED
========================= */
app.get("/stream/:type/:id.json", async (req, res) => {
  console.log(`Request: ${req.params.type}/${req.params.id}`);
  
  if (!RD_KEY) {
    console.log("No RD Key");
    return res.json({ streams: [] });
  }

  try {
    // الرابط الصحيح
    const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${req.params.type}/${req.params.id}.json`;
    console.log(`Fetching: ${torrentioUrl}`);
    
    const response = await fetch(torrentioUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    if (!response.ok) {
      console.log(`Torrentio error: ${response.status}`);
      return res.json({ streams: [] });
    }
    
    const data = await response.json();
    console.log(`Got ${data.streams?.length || 0} streams`);

    if (!data.streams || data.streams.length === 0) {
      return res.json({ streams: [] });
    }

    const streams = data.streams
      .filter(s => {
        const title = s.title || s.name || "";
        // إزالة الأنواع السيئة
        return !/(CAM|TS|Telesync|SCR|HDCAM|R5|DVDScr)/i.test(title);
      })
      .sort((a, b) => {
        // ترتيب: 4K أولاً، ثم 1080p، ثم 720p
        const aQuality = getQualityScore(a.title || "");
        const bQuality = getQualityScore(b.title || "");
        return bQuality - aQuality;
      })
      .map((s, index) => {
        const title = s.title || s.name || "";
        const isCached = s.url.includes('real-debrid.com');
        
        // استخراج المعلومات
        const movieName = extractMovieName(title);
        const size = extractSizeFormatted(title);
        const quality = extractQuality(title);
        const codec = extractCodec(title);
        const audio = extractAudio(title);
        const source = extractSource(title);
        const seeders = extractSeeders(title);
        
        // بناء العنوان بشكل منظم
        const streamTitle = `${movieName}

Quality: ${quality}
Size: ${size}
Codec: ${codec}
Audio: ${audio}
Seeders: ${seeders}
Source: ${source}
Status: ${isCached ? '✅ Cached' : '🔗 Torrent'}`;

        return {
          title: streamTitle,
          url: s.url,
          name: `Souhail Premium - ${index + 1}`,
          behaviorHints: s.behaviorHints || {}
        };
      })
      .slice(0, 10); // الحد الأقصى 10 ستريمات

    console.log(`Returning ${streams.length} streams`);
    res.json({ streams });

  } catch (err) {
    console.error("Stream error:", err.message);
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
      <title>Install Souhail Premium</title>
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
        .install-btn {
          display: block;
          width: 100%;
          padding: 15px;
          margin: 20px 0;
          background: #00b4db;
          color: white;
          text-decoration: none;
          border-radius: 10px;
          font-weight: bold;
          font-size: 18px;
        }
        .url-box {
          background: #333;
          padding: 15px;
          margin: 20px 0;
          border-radius: 10px;
          font-family: monospace;
          word-break: break-all;
        }
        .status {
          padding: 15px;
          margin: 20px 0;
          background: ${RD_KEY ? '#00ff0020' : '#ff000020'};
          border-radius: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎬 Souhail Premium</h1>
        <p>Real-Debrid Streaming Addon</p>
        
        <div class="status">
          <h3>${RD_KEY ? '✅ Ready to Install' : '❌ Configuration Required'}</h3>
          <p>Real-Debrid API: ${RD_KEY ? 'Configured' : 'Not Configured'}</p>
        </div>
        
        <a href="${stremioUrl}" class="install-btn">📲 Install in Stremio</a>
        
        <div class="url-box">
          <strong>Manifest URL:</strong><br>
          ${manifestUrl}
        </div>
        
        <p>Or install manually in Stremio: Addons → Manual Install</p>
        
        <div style="margin-top: 30px; text-align: left;">
          <h3>✨ Features:</h3>
          <ul>
            <li>✅ Real-Debrid cached streams</li>
            <li>✅ Filtered quality (no CAM/TS)</li>
            <li>✅ Complete torrent information</li>
            <li>✅ Organized display</li>
            <li>✅ Multiple qualities (4K, 1080p, 720p)</li>
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
    rd_configured: !!RD_KEY
  });
});

/* =========================
   DEBUG ENDPOINT
========================= */
app.get("/debug", async (req, res) => {
  const testUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/movie/tt0111161.json`;
  
  try {
    const response = await fetch(testUrl);
    const data = await response.json();
    
    res.json({
      success: true,
      rd_key_present: !!RD_KEY,
      rd_key_length: RD_KEY ? RD_KEY.length : 0,
      torrentio_url: testUrl,
      streams_count: data.streams?.length || 0,
      sample_stream: data.streams?.[0] || null
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      rd_key_present: !!RD_KEY
    });
  }
});

/* =========================
   HELPER FUNCTIONS
========================= */
function getQualityScore(title) {
  if (/(2160p|4K)/i.test(title)) return 3;
  if (/(1080p|FHD)/i.test(title)) return 2;
  if (/(720p|HD)/i.test(title)) return 1;
  return 0;
}

function extractMovieName(title) {
  // إزالة المعلومات التقنية
  let name = title
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // إزالة الجودة والمعلومات التقنية
  const techTerms = ['2160p', '1080p', '720p', '4K', 'WEB-DL', 'WEBRip', 'BluRay', 
                    'HDR', 'DV', 'x265', 'x264', 'H.265', 'H.264', 'DTS', 'Atmos',
                    'AAC', 'AC3', '5.1', '10Bit', 'REMUX'];
  
  techTerms.forEach(term => {
    name = name.replace(new RegExp(term, 'gi'), '');
  });
  
  return name.substring(0, 50).trim() || 'Movie';
}

function extractQuality(title) {
  if (/(2160p|4K)/i.test(title)) return '4K';
  if (/(1080p|FHD)/i.test(title)) return '1080p';
  if (/(720p|HD)/i.test(title)) return '720p';
  return 'HD';
}

function extractSizeFormatted(title) {
  const match = title.match(/(\d+(\.\d+)?)\s*(GB|MB)/i);
  if (match) {
    return `${match[1]} ${match[3].toUpperCase()}`;
  }
  return 'Unknown';
}

function extractCodec(title) {
  if (/(x265|H\.265|H265)/i.test(title)) return 'H.265 / x265';
  if (/(x264|H\.264|H264)/i.test(title)) return 'H.264 / x264';
  return 'Unknown';
}

function extractAudio(title) {
  if (/Atmos/i.test(title)) return 'Dolby Atmos';
  if (/DTS/i.test(title)) return 'DTS';
  if (/DDP5\.1/i.test(title)) return 'DDP5.1';
  if (/5\.1/i.test(title)) return '5.1 Surround';
  if (/AAC/i.test(title)) return 'AAC';
  if (/AC3/i.test(title)) return 'AC3';
  return 'Stereo';
}

function extractSource(title) {
  if (/YTS/i.test(title)) return 'YTS';
  if (/RARBG/i.test(title)) return 'RARBG';
  if (/1337x/i.test(title)) return '1337x';
  if (/thepiratebay|piratebay|TPB/i.test(title)) return 'The Pirate Bay';
  return 'Torrent';
}

function extractSeeders(title) {
  const match = title.match(/(\d+)\s*(seeds|seeders|🌟)/i);
  return match ? match[1] : '?';
}

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`
=======================================
🎬 Souhail Premium Server Started
=======================================
📍 Local: http://localhost:${PORT}
📲 Install: http://localhost:${PORT}/install
🔧 Debug: http://localhost:${PORT}/debug
🔑 RD Key: ${RD_KEY ? '✅ Configured' : '❌ Missing'}
=======================================
  `);
});
