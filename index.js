const express = require('express');
const fetch = require('node-fetch');
const app = express();

// CORS FIX
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

const PORT = process.env.PORT || 8080;
const RD_KEY = process.env.REAL_DEBRID_API;

// MANIFEST
app.get('/manifest.json', (req, res) => {
    console.log('📄 Manifest requested');
    res.json({
        "id": "pro.souhail.stremio",
        "version": "1.0.0",
        "name": "Souhail Pro",
        "description": "Real-Debrid Torrent Streaming Pro",
        "logo": "https://cdn-icons-png.flaticon.com/512/3095/3095588.png",
        "background": "https://images.unsplash.com/photo-1536440136628-849c177e76a1",
        "resources": ["stream"],
        "types": ["movie", "series"],
        "idPrefixes": ["tt"],
        "catalogs": []
    });
});

// STREAM
app.get('/stream/:type/:id.json', async (req, res) => {
    console.log(`🎬 Stream request: ${req.params.type}/${req.params.id}`);
    
    if (!RD_KEY) {
        console.log("❌ No Real-Debrid API key");
        return res.json({ streams: [] });
    }
    
    try {
        const url = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${req.params.type}/${req.params.id}.json`;
        console.log(`📡 Fetching from: ${url}`);
        
        const response = await fetch(url, {
            timeout: 10000
        });
        
        const data = await response.json();
        console.log(`✅ Found ${data.streams?.length || 0} streams`);
        
        if (!data.streams) {
            return res.json({ streams: [] });
        }
        
        const processedStreams = data.streams.map(stream => {
            const title = stream.name || stream.title || 'Unknown';
            const isCached = stream.url.includes('real-debrid.com');
            
            const movieName = title
                .replace(/\[.*?\]/g, '')
                .replace(/\./g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 50);
            
            const size = (title.match(/(\d+(\.\d+)?\s*GB)/i) || ['Unknown'])[0];
            const quality = title.includes('2160p') ? '4K' : 
                           title.includes('1080p') ? '1080p' : 'HD';
            const seeders = (title.match(/(\d+)\s*Seeds?/i) || [])[1] || '?';
            const source = (title.match(/\[(.*?)\]/) || [])[1] || 'Torrent';
            
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
        
    } catch (error) {
        console.error("❌ Stream error:", error.message);
        res.json({ streams: [] });
    }
});

// INSTALL PAGE
app.get('/install', (req, res) => {
    const protocol = req.protocol;
    const host = req.get('host');
    const manifestUrl = `${protocol}://${host}/manifest.json`;
    const stremioUrl = `stremio://stremio.xyz/app/${host}/manifest.json`;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Install Souhail Pro</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: #1a1a1a;
                    color: white;
                    padding: 20px;
                    text-align: center;
                }
                .container {
                    max-width: 500px;
                    margin: 50px auto;
                    padding: 30px;
                    background: #2a2a2a;
                    border-radius: 10px;
                }
                .url-box {
                    background: #000;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 5px;
                    font-family: monospace;
                    word-break: break-all;
                }
                .btn {
                    display: block;
                    background: #00b4db;
                    color: white;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 5px;
                    text-decoration: none;
                    font-weight: bold;
                }
                .btn:hover {
                    background: #0083b0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎬 Souhail Pro</h1>
                <p>Install this addon in Stremio</p>
                
                <div class="url-box">${manifestUrl}</div>
                
                <a href="${stremioUrl}" class="btn">📲 Auto-Install</a>
                
                <p>OR</p>
                
                <ol style="text-align: left;">
                    <li>Open Stremio</li>
                    <li>Click Addons (top left)</li>
                    <li>Click Manual Install</li>
                    <li>Paste the URL above</li>
                    <li>Click Install</li>
                </ol>
            </div>
        </body>
        </html>
    `);
});

// ROOT
app.get('/', (req, res) => {
    res.redirect('/install');
});

// HEALTH
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Souhail Pro',
        version: '1.0.0',
        rd_configured: !!RD_KEY
    });
});

// START
app.listen(PORT, () => {
    console.log('================================');
    console.log('🚀 Souhail Pro Addon Started');
    console.log('================================');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log(`📄 Manifest: http://localhost:${PORT}/manifest.json`);
    console.log(`🔑 Real-Debrid: ${RD_KEY ? '✅ Configured' : '❌ NOT Configured'}`);
    console.log('================================');
    console.log('📲 TO INSTALL:');
    console.log(`1. Open Stremio`);
    console.log(`2. Addons → Manual Install`);
    console.log(`3. Paste: http://localhost:${PORT}/manifest.json`);
    console.log('================================');
});
