const express = require('express');
const fetch = require('node-fetch');
const app = express();

const PORT = process.env.PORT || 8080;
const RD_KEY = process.env.REAL_DEBRID_API;

// MANIFEST
app.get('/manifest.json', (req, res) => {
    res.json({
        "id": "pro.souhail.stremio",
        "version": "1.0.0",
        "name": "Souhail Pro",
        "description": "Real-Debrid Torrent Streaming Pro",
        "logo": "https://cdn-icons-png.flaticon.com/512/3095/3095588.png",
        "background": "https://images.unsplash.com/photo-1536440136628-849c177e76a1",
        "resources": ["stream"],
        "types": ["movie", "series"],
        "idPrefixes": ["tt"]
    });
});

// STREAM
app.get('/stream/:type/:id.json', async (req, res) => {
    if (!RD_KEY) {
        console.log("❌ Real-Debrid API key is missing");
        return res.json({ streams: [] });
    }
    
    try {
        const url = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${req.params.type}/${req.params.id}.json`;
        console.log(`📡 Fetching: ${url}`);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.streams) {
            console.log("⚠️ No streams found");
            return res.json({ streams: [] });
        }
        
        console.log(`✅ Found ${data.streams.length} streams`);
        
        const processedStreams = data.streams.map(stream => {
            const title = stream.name || stream.title || '';
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
        console.error("❌ Error fetching streams:", error.message);
        res.json({ streams: [] });
    }
});

// INSTALL PAGE
app.get('/install', (req, res) => {
    const installUrl = `https://${req.hostname}/manifest.json`;
    const stremioUrl = `stremio://stremio.xyz/app/${req.hostname}/manifest.json`;
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Install Souhail Pro</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    color: white;
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    max-width: 500px;
                    margin: 0 auto;
                    padding: 30px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                }
                .logo { text-align: center; margin-bottom: 20px; }
                h1 { color: #00b4db; margin-bottom: 10px; }
                .btn {
                    display: block;
                    width: 100%;
                    padding: 15px;
                    margin: 10px 0;
                    background: #00b4db;
                    color: white;
                    text-decoration: none;
                    border-radius: 10px;
                    text-align: center;
                    font-weight: bold;
                }
                .btn:hover { background: #0083b0; }
                .status {
                    padding: 15px;
                    margin: 20px 0;
                    background: ${RD_KEY ? '#00ff0020' : '#ff000020'};
                    border-left: 4px solid ${RD_KEY ? '#00ff00' : '#ff0000'};
                    border-radius: 5px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">
                    <h1>🎬 Souhail Pro</h1>
                    <p>Real-Debrid Streaming Addon</p>
                </div>
                
                <div class="status">
                    <strong>Status:</strong> ${RD_KEY ? '✅ Ready' : '❌ API Key Missing'}
                </div>
                
                <a href="${stremioUrl}" class="btn">📲 Install in Stremio</a>
                <a href="/manifest.json" class="btn" style="background: #666;">🔗 Manifest URL</a>
                
                <p style="margin-top: 20px; color: #aaa; text-align: center;">
                    Real-Debrid API: ${RD_KEY ? 'Configured' : 'Not configured'}
                </p>
            </div>
        </body>
        </html>
    `);
});

// ROOT REDIRECT
app.get('/', (req, res) => {
    res.redirect('/install');
});

// HEALTH CHECK
app.get('/health', (req, res) => {
    res.json({ 
        status: 'running',
        timestamp: new Date().toISOString(),
        realdebrid: RD_KEY ? 'configured' : 'missing'
    });
});

// START SERVER
app.listen(PORT, () => {
    console.log(`🚀 Souhail Pro Server Started`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`📲 Install: http://localhost:${PORT}/install`);
    console.log(`🔑 Real-Debrid: ${RD_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
});
