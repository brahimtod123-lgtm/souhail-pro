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

// STREAM - FIXED VERSION
app.get('/stream/:type/:id.json', async (req, res) => {
    if (!RD_KEY) return res.json({ streams: [] });
    
    try {
        const { type, id } = req.params;
        
        // الحصول على معلومات الفيلم أولاً من TMDB
        let movieInfo = { title: '', year: '' };
        if (id.startsWith('tt')) {
            try {
                const tmdbResponse = await fetch(
                    `https://api.themoviedb.org/3/find/${id}?api_key=9b8933e4c7b5c78de32f1d301b6988ed&external_source=imdb_id`
                );
                const tmdbData = await tmdbResponse.json();
                if (tmdbData.movie_results && tmdbData.movie_results.length > 0) {
                    movieInfo.title = tmdbData.movie_results[0].title;
                    movieInfo.year = tmdbData.movie_results[0].release_date?.substring(0, 4) || '';
                }
            } catch (e) {
                console.log("TMDB API error, using fallback");
            }
        }
        
        // الحصول على الستريمات من Torrentio
        const url = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${type}/${id}.json`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const data = await response.json();
        
        if (!data.streams || data.streams.length === 0) {
            return res.json({ streams: [] });
        }
        
        // حفظ العناوين الأصلية في متغير للتصحيح
        console.log("Original Torrentio titles:");
        data.streams.forEach((stream, i) => {
            console.log(`${i + 1}. ${stream.name || stream.title}`);
        });
        
        const processedStreams = data.streams.map((stream, index) => {
            const originalTitle = stream.name || stream.title || '';
            const isCached = stream.url.includes('real-debrid.com');
            
            // استخراج المعلومات من العنوان الأصلي
            let quality = 'HD';
            let size = 'Unknown';
            let seeders = '?';
            let source = 'RD+';
            let audio = 'Stereo';
            let language = 'Multi';
            
            // البحث عن المعلومات في العنوان
            const title = originalTitle.toLowerCase();
            
            // الجودة
            if (title.includes('2160p') || title.includes('4k')) quality = '4K';
            else if (title.includes('1080p')) quality = '1080p';
            else if (title.includes('720p')) quality = '720p';
            else if (title.includes('480p')) quality = '480p';
            
            // DV/HDR
            if (title.includes('dv') || title.includes('dolby vision')) {
                quality += ' DV';
            }
            if (title.includes('hdr')) {
                quality += ' HDR';
            }
            
            // الحجم
            const sizeMatch = originalTitle.match(/(\d+\.?\d*)\s*(GB|GiB)/i);
            if (sizeMatch) {
                size = `${sizeMatch[1]} GB`;
            } else {
                const sizeMB = originalTitle.match(/(\d+\.?\d*)\s*(MB|MiB)/i);
                if (sizeMB) {
                    size = `${(parseFloat(sizeMB[1]) / 1024).toFixed(1)} GB`;
                }
            }
            
            // البذور
            const seedMatch = originalTitle.match(/seeds?:\s*(\d+)/i) || 
                             originalTitle.match(/(\d+)\s*seeds?/i);
            if (seedMatch) seeders = seedMatch[1];
            
            // الصوت
            if (title.includes('dts')) audio = 'DTS';
            else if (title.includes('dolby')) audio = 'Dolby';
            else if (title.includes('aac')) audio = 'AAC';
            else if (title.includes('ac3')) audio = 'AC3';
            
            // إنشاء عنوان الفيلم
            let movieTitle = movieInfo.title || `Movie ${index + 1}`;
            if (movieInfo.year) {
                movieTitle += ` (${movieInfo.year})`;
            }
            
            // إنشاء العنوان النهائي مع كل المعلومات
            const formattedTitle = 
`${movieTitle}

Quality: 🫟📽️ ${quality}
Size: 🫟🎬 ${size}
Seeders: 🫟🧑‍🔧 ${seeders}
Source: 🫟📡 ${source}
Audio: 🫟🎧 ${audio}
Language: 🫟🌐 ${language}
Cached: 🫟🧲 ${isCached ? 'Yes' : 'No'}`;
            
            return {
                title: formattedTitle,
                url: stream.url,
                behaviorHints: stream.behaviorHints || {}
            };
        });
        
        res.json({ streams: processedStreams });
        
    } catch (error) {
        console.error("Error in stream handler:", error);
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
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    color: white;
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }
                
                .install-container {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 500px;
                    width: 100%;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                .logo {
                    text-align: center;
                    margin-bottom: 30px;
                }
                
                .logo-icon {
                    font-size: 60px;
                    margin-bottom: 10px;
                }
                
                h1 {
                    text-align: center;
                    margin-bottom: 10px;
                    font-size: 28px;
                    background: linear-gradient(135deg, #00b4db 0%, #0083b0 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                
                .subtitle {
                    text-align: center;
                    color: #aaa;
                    margin-bottom: 30px;
                    font-size: 16px;
                }
                
                .status-box {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 15px;
                    border-radius: 10px;
                    margin-bottom: 25px;
                    border-left: 4px solid ${RD_KEY ? '#00ff00' : '#ff0000'};
                }
                
                .status-title {
                    font-weight: bold;
                    margin-bottom: 5px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .install-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                
                .btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 18px;
                    border-radius: 10px;
                    text-decoration: none;
                    font-size: 18px;
                    font-weight: bold;
                    transition: all 0.3s ease;
                    border: none;
                    cursor: pointer;
                }
                
                .btn-primary {
                    background: linear-gradient(135deg, #00b4db 0%, #0083b0 100%);
                    color: white;
                }
                
                .btn-secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
                }
                
                .url-box {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 15px;
                    border-radius: 10px;
                    margin-top: 20px;
                    font-family: 'Courier New', monospace;
                    word-break: break-all;
                    font-size: 14px;
                }
                
                .features {
                    margin-top: 30px;
                }
                
                .feature-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 10px;
                    padding: 10px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 5px;
                }
            </style>
        </head>
        <body>
            <div class="install-container">
                <div class="logo">
                    <div class="logo-icon">🎬</div>
                    <h1>Souhail Pro</h1>
                    <p class="subtitle">Professional Real-Debrid Streaming</p>
                </div>
                
                <div class="status-box">
                    <div class="status-title">
                        <span>🔧 Configuration Status:</span>
                        <span style="color: ${RD_KEY ? '#00ff00' : '#ff0000'}">
                            ${RD_KEY ? '✅ Ready to Install' : '❌ Real-Debrid API Required'}
                        </span>
                    </div>
                    ${RD_KEY ? 
                        '<p>All systems ready for installation.</p>' : 
                        '<p>Add REAL_DEBRID_API in Railway Variables.</p>'
                    }
                </div>
                
                <div class="install-buttons">
                    <a href="${stremioUrl}" class="btn btn-primary" onclick="installClick()">
                        <span>📲</span>
                        <span>Install Now</span>
                    </a>
                    
                    <button class="btn btn-secondary" onclick="copyUrl()">
                        <span>📋</span>
                        <span>Copy Installation URL</span>
                    </button>
                </div>
                
                <div class="url-box" id="urlBox">
                    ${installUrl}
                </div>
                
                <div class="features">
                    <h3 style="margin-bottom: 15px;">✨ Features:</h3>
                    <div class="feature-item">
                        <span>✅</span>
                        <span>Complete torrent information display</span>
                    </div>
                    <div class="feature-item">
                        <span>✅</span>
                        <span>Organized multi-line details</span>
                    </div>
                    <div class="feature-item">
                        <span>✅</span>
                        <span>Real-Debrid cached streams</span>
                    </div>
                    <div class="feature-item">
                        <span>✅</span>
                        <span>Quality, size, and seeders info</span>
                    </div>
                </div>
            </div>
            
            <script>
                function installClick() {
                    setTimeout(() => {
                        document.getElementById('urlBox').style.display = 'block';
                    }, 1000);
                }
                
                function copyUrl() {
                    const url = '${installUrl}';
                    navigator.clipboard.writeText(url).then(() => {
                        alert('✅ Installation URL copied to clipboard!');
                    }).catch(err => {
                        prompt('Copy this URL:', url);
                    });
                }
                
                // Auto-try installation on page load
                window.onload = function() {
                    if (window.location.protocol !== 'file:') {
                        setTimeout(() => {
                            window.location.href = '${stremioUrl}';
                        }, 500);
                    }
                };
            </script>
        </body>
        </html>
    `);
});

// HOME
app.get('/', (req, res) => {
    res.redirect('/install');
});

// HEALTH
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Souhail Pro',
        realdebrid: RD_KEY ? 'configured' : 'missing'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Souhail Pro Installation Portal: http://localhost:${PORT}/install`);
});
