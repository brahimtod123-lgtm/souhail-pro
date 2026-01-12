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
        "description": "Real-Debrid Torrent Streaming Pro - Enhanced Info",
        "logo": "https://cdn-icons-png.flaticon.com/512/3095/3095588.png",
        "background": "https://images.unsplash.com/photo-1536440136628-849c177e76a1",
        "resources": ["stream"],
        "types": ["movie", "series"],
        "idPrefixes": ["tt"]
    });
});

// STREAM - ENHANCED VERSION
app.get('/stream/:type/:id.json', async (req, res) => {
    if (!RD_KEY) return res.json({ streams: [] });
    
    try {
        const { type, id } = req.params;
        
        // 1. الحصول على بيانات الفيلم من TMDB
        let movieInfo = { title: '', year: '', overview: '' };
        try {
            const tmdbResponse = await fetch(
                `https://api.themoviedb.org/3/find/${id}?api_key=9b8933e4c7b5c78de32f1d301b6988ed&external_source=imdb_id&language=en`
            );
            const tmdbData = await tmdbResponse.json();
            if (tmdbData.movie_results && tmdbData.movie_results.length > 0) {
                movieInfo.title = tmdbData.movie_results[0].title;
                movieInfo.year = tmdbData.movie_results[0].release_date?.substring(0, 4) || '';
                movieInfo.overview = tmdbData.movie_results[0].overview || '';
            }
        } catch (e) {
            console.log("TMDB API error:", e.message);
        }
        
        // 2. الحصول على الستريمات من Torrentio
        const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${type}/${id}.json`;
        const response = await fetch(torrentioUrl);
        const data = await response.json();
        
        if (!data.streams || data.streams.length === 0) {
            return res.json({ streams: [] });
        }
        
        // 3. معالجة كل ستريم مع معلومات إضافية
        const processedStreams = data.streams.map((stream, index) => {
            const originalTitle = stream.title || stream.name || '';
            const isCached = stream.url.includes('real-debrid.com');
            
            // استخراج المعلومات من الرابط إذا لم تكن في العنوان
            let quality = 'HD';
            let size = 'Unknown';
            let seeders = 'Unknown';
            let audio = 'Stereo';
            let encoding = 'x264';
            
            // تحليل الرابط لاكتشاف الجودة
            if (stream.url.includes('2160p') || originalTitle.includes('4K')) quality = '4K';
            else if (stream.url.includes('1080p') || originalTitle.includes('1080p')) quality = '1080p';
            else if (stream.url.includes('720p') || originalTitle.includes('720p')) quality = '720p';
            
            // اكتشاف DV/HDR من الرابط
            if (stream.url.includes('DV') || originalTitle.includes('DV')) quality += ' DV';
            if (stream.url.includes('HDR') || originalTitle.includes('HDR')) quality += ' HDR';
            
            // تقدير الحجم بناءً على الجودة
            if (quality.includes('4K')) size = '15-25 GB';
            else if (quality.includes('1080p')) size = '2-10 GB';
            else if (quality.includes('720p')) size = '1-4 GB';
            
            // اكتشاف الصوت من الرابط
            if (stream.url.includes('DTS') || originalTitle.includes('DTS')) audio = 'DTS';
            else if (stream.url.includes('Dolby') || originalTitle.includes('Dolby')) audio = 'Dolby Digital';
            else if (stream.url.includes('AAC')) audio = 'AAC';
            
            // اكتشاف الترميز
            if (stream.url.includes('x265') || originalTitle.includes('x265')) encoding = 'x265';
            else if (stream.url.includes('HEVC')) encoding = 'HEVC';
            
            // إنشاء عنوان الفيلم
            const movieTitle = movieInfo.title || `Movie ${index + 1}`;
            const yearInfo = movieInfo.year ? ` (${movieInfo.year})` : '';
            
            // إنشاء معلومات الستريم المفصلة
            const streamInfo = `
🎬 ${movieTitle}${yearInfo}

📌 جودة الفيديو: ${quality}
📌 حجم الملف: ${size}
📌 عدد البذور: ${seeders}
📌 جودة الصوت: ${audio}
📌 نوع الترميز: ${encoding}
📌 المصدر: Real-Debrid
📌 حالة الكاش: ${isCached ? '✅ مخزن' : '🔗 مباشر'}
            `.trim();
            
            return {
                title: streamInfo,
                url: stream.url,
                behaviorHints: stream.behaviorHints || {},
                // حفظ المعلومات الأصلية للتصحيح
                _original: {
                    title: originalTitle,
                    urlPreview: stream.url.substring(0, 100)
                }
            };
        });
        
        res.json({ streams: processedStreams });
        
    } catch (error) {
        console.error("Error in stream handler:", error);
        res.json({ streams: [] });
    }
});

// صفحة خاصة للاختبار والتصحيح
app.get('/debug/:id', async (req, res) => {
    const { id } = req.params;
    const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/movie/${id}.json`;
    
    try {
        const response = await fetch(torrentioUrl);
        const data = await response.json();
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Debug - Souhail Pro</title>
                <style>
                    body { font-family: Arial; padding: 20px; }
                    .stream { border: 1px solid #ccc; padding: 15px; margin: 10px; }
                    .info { background: #f0f0f0; padding: 10px; }
                </style>
            </head>
            <body>
                <h1>🔍 Debug Information</h1>
                <div class="info">
                    <p><strong>Real-Debrid Key:</strong> ${RD_KEY ? 'Present' : 'Missing'}</p>
                    <p><strong>Torrentio URL:</strong> ${torrentioUrl}</p>
                    <p><strong>Streams Found:</strong> ${data.streams ? data.streams.length : 0}</p>
                </div>
                
                <h2>Raw Stream Data:</h2>
                ${data.streams ? data.streams.map((stream, i) => `
                    <div class="stream">
                        <h3>Stream ${i+1}</h3>
                        <p><strong>Original Title:</strong> ${stream.title || stream.name || 'No title'}</p>
                        <p><strong>URL:</strong> ${stream.url}</p>
                        <p><strong>Is Cached:</strong> ${stream.url.includes('real-debrid.com') ? 'Yes' : 'No'}</p>
                        <p><strong>Behavior Hints:</strong> ${JSON.stringify(stream.behaviorHints || {})}</p>
                    </div>
                `).join('') : '<p>No streams found</p>'}
            </body>
            </html>
        `);
    } catch (error) {
        res.send(`<h1>Error: ${error.message}</h1>`);
    }
});

// INSTALL PAGE
app.get('/install', (req, res) => {
    const installUrl = `https://${req.hostname}/manifest.json`;
    const stremioUrl = `stremio://stremio.xyz/app/${req.hostname}/manifest.json`;
    const debugUrl = `https://${req.hostname}/debug/tt0111161`;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Souhail Pro - Installation</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: #1a1a1a;
                    color: white;
                    padding: 20px;
                    text-align: center;
                }
                .container {
                    max-width: 600px;
                    margin: 50px auto;
                    padding: 30px;
                    background: #2a2a2a;
                    border-radius: 15px;
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
                .status {
                    padding: 15px;
                    margin: 20px 0;
                    background: ${RD_KEY ? '#00ff0020' : '#ff000020'};
                    border-radius: 10px;
                    border-left: 5px solid ${RD_KEY ? '#00ff00' : '#ff0000'};
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎬 Souhail Pro</h1>
                <p>Enhanced Real-Debrid Streaming Addon</p>
                
                <div class="status">
                    <h3>${RD_KEY ? '✅ Ready to Install' : '❌ Configuration Required'}</h3>
                    <p>Real-Debrid API: ${RD_KEY ? 'Configured' : 'Not Configured'}</p>
                </div>
                
                <a href="${stremioUrl}" class="btn">📲 Install in Stremio</a>
                <a href="/manifest.json" class="btn" style="background: #666;">📄 View Manifest</a>
                <a href="${debugUrl}" class="btn" style="background: #8a2be2;" target="_blank">🔧 Debug Tool</a>
                
                <div style="margin-top: 30px; text-align: left; background: #333; padding: 15px; border-radius: 10px;">
                    <h3>✨ Features:</h3>
                    <ul>
                        <li>✅ Enhanced stream information display</li>
                        <li>✅ Movie details from TMDB</li>
                        <li>✅ Estimated file sizes based on quality</li>
                        <li>✅ Audio and encoding detection</li>
                        <li>✅ Real-Debrid cache status</li>
                    </ul>
                </div>
            </div>
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
        service: 'Souhail Pro Enhanced',
        version: '2.0.0',
        realdebrid: RD_KEY ? 'configured' : 'missing'
    });
});

app.listen(PORT, () => {
    console.log(`
=======================================
🎬 Souhail Pro Enhanced v2.0.0
=======================================
📍 Local: http://localhost:${PORT}
📲 Install: http://localhost:${PORT}/install
🔧 Debug: http://localhost:${PORT}/debug/tt0111161
🔑 RD Key: ${RD_KEY ? '✅ Configured' : '❌ Missing'}
=======================================
    `);
});
