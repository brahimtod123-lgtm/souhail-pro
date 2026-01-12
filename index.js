const express = require('express');
const fetch = require('node-fetch');
const app = express();

const PORT = process.env.PORT || 8080;
const RD_KEY = process.env.REAL_DEBRID_API;

// MANIFEST مع catalogs
app.get('/manifest.json', (req, res) => {
    res.json({
        "id": "pro.souhail.stremio",
        "version": "1.0.0",
        "name": "Souhail Pro",
        "description": "Real-Debrid Torrent Streaming",
        "logo": "https://cdn-icons-png.flaticon.com/512/3095/3095588.png",
        "background": "https://images.unsplash.com/photo-1536440136628-849c177e76a1",
        "resources": ["stream", "catalog"],
        "types": ["movie", "series"],
        "catalogs": [
            {
                "type": "movie",
                "id": "movies",
                "name": "Movies"
            },
            {
                "type": "series",
                "id": "series",
                "name": "Series"
            }
        ],
        "idPrefixes": ["tt"],
        "behaviorHints": {
            "configurable": true
        }
    });
});

// CATALOG endpoint
app.get('/catalog/:type/:id.json', (req, res) => {
    res.json({ metas: [] }); // فارغ، استعمل search
});

// STREAM مع التفاصيل
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
            
            // تفاصيل
            const movieName = cleanTitle(title);
            const size = (title.match(/(\d+(\.\d+)?\s*GB)/i) || ['Unknown'])[0];
            const quality = title.includes('2160p') ? '4K' : 
                           title.includes('1080p') ? '1080p' : 'HD';
            const seeders = (title.match(/(\d+)\s*Seeds?/i) || [])[1] || '?';
            const source = (title.match(/\[(.*?)\]/) || [])[1] || 'Torrent';
            
            // تنسيق
            const formattedTitle = 
`🎬 ${movieName}
📺 ${quality} | 👤 ${seeders}
💾 ${size}
🏷️ ${source}
${isCached ? '✅ CACHED' : '🔗 TORRENT'}`;
            
            return {
                title: formattedTitle,
                url: stream.url,
                behaviorHints: {
                    notWebReady: false,
                    bingeGroup: `souhail-${req.params.id}`
                }
            };
        });
        
        res.json({ streams: processedStreams });
        
    } catch {
        res.json({ streams: [] });
    }
});

function cleanTitle(title) {
    return title
        .replace(/\[.*?\]/g, '')
        .replace(/\./g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);
}

// INSTALL
app.get('/install', (req, res) => {
    res.send(`
        <h2>Souhail Pro - Install</h2>
        <a href="stremio://stremio.xyz/app/${req.hostname}/manifest.json">
            Install Now
        </a>
        <p><code>https://${req.hostname}/manifest.json</code></p>
        <p><a href="/stream/movie/tt1375666.json">Test Stream</a></p>
    `);
});

app.get('/', (req, res) => {
    res.redirect('/install');
});

app.listen(PORT, () => {
    console.log(`✅ Souhail Pro ready: http://localhost:${PORT}/install`);
});
