const express = require('express');
const fetch = require('node-fetch');
const app = express();

const PORT = process.env.PORT || 8080;
const RD_KEY = process.env.REAL_DEBRID_API;

// MANIFEST - بإسم جديد
app.get('/manifest.json', (req, res) => {
    res.json({
        "id": "pro.souhail.stremio",
        "version": "1.0.0",
        "name": "Souhail Pro",
        "description": "Real-Debrid Torrent Streaming Pro",
        "resources": ["stream"],
        "types": ["movie", "series"]
    });
});

// STREAM - تنظيم محترف
app.get('/stream/:type/:id.json', async (req, res) => {
    if (!RD_KEY) return res.json({ streams: [] });
    
    try {
        const url = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${req.params.type}/${req.params.id}.json`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.streams) return res.json({ streams: [] });
        
        const processedStreams = data.streams.map(stream => {
            const title = stream.name || stream.title || '';
            const isCached = stream.url.includes('real-debrid.com');
            
            // معلومات منظمة
            const movieName = cleanText(title.replace(/\./g, ' ').substring(0, 50));
            const size = (title.match(/(\d+(\.\d+)?\s*GB)/i) || [''])[0] || 'Unknown';
            const quality = title.includes('2160p') ? '4K' : title.includes('1080p') ? '1080p' : 'HD';
            const seeders = (title.match(/(\d+)\s*Seeds?/i) || [])[1] || '?';
            const source = (title.match(/\[(.*?)\]/) || [])[1] || 'Torrent';
            
            // تنسيق محترف
            const formattedTitle = 
`🎬 ${movieName}
📺 ${quality} | 👤 ${seeders}
💾 ${size}
🏷️ ${source}
${isCached ? '✅ CACHED' : '🔗 TORRENT'}`;
            
            return {
                title: formattedTitle,
                url: stream.url,
                behaviorHints: stream.behaviorHints || {}
            };
        });
        
        res.json({ streams: processedStreams });
        
    } catch {
        res.json({ streams: [] });
    }
});

function cleanText(text) {
    return text
        .replace(/\[.*?\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// INSTALL
app.get('/install', (req, res) => {
    res.send(`
        <h2>Souhail Pro - Install</h2>
        <a href="stremio://stremio.xyz/app/${req.hostname}/manifest.json">
            Install Now
        </a>
        <p><code>https://${req.hostname}/manifest.json</code></p>
    `);
});

app.get('/', (req, res) => {
    res.redirect('/install');
});

app.listen(PORT, () => {
    console.log(`Souhail Pro addon running on port ${PORT}`);
});
