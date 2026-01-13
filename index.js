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

// STREAM - ENHANCED VERSION WITH FULL DETAILS
app.get('/stream/:type/:id.json', async (req, res) => {
    if (!RD_KEY) return res.json({ streams: [] });
    
    try {
        const { type, id } = req.params;
        
        // 1. الحصول على بيانات الفيلم من TMDB
        let movieInfo = { title: '', year: '' };
        try {
            const tmdbResponse = await fetch(
                `https://api.themoviedb.org/3/find/${id}?api_key=9b8933e4c7b5c78de32f1d301b6988ed&external_source=imdb_id&language=en`
            );
            const tmdbData = await tmdbResponse.json();
            if (tmdbData.movie_results && tmdbData.movie_results.length > 0) {
                movieInfo.title = tmdbData.movie_results[0].title;
                movieInfo.year = tmdbData.movie_results[0].release_date?.substring(0, 4) || '';
            }
        } catch (e) {
            console.log("TMDB API error:", e.message);
        }
        
        // 2. الحصول على الستريمات من Torrentio
        const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${type}/${id}.json`;
        console.log("🌐 Fetching from:", torrentioUrl);
        
        const response = await fetch(torrentioUrl);
        const data = await response.json();
        
        if (!data.streams || data.streams.length === 0) {
            return res.json({ streams: [] });
        }
        
        console.log(`✅ Found ${data.streams.length} streams from Torrentio`);
        
        // 3. معالجة كل ستريم مع معلومات إضافية
        const processedStreams = data.streams.map((stream, index) => {
            const originalTitle = stream.title || stream.name || '';
            const isCached = stream.url.includes('real-debrid.com');
            
            // استخراج جميع التفاصيل من العنوان الأصلي
            const details = extractAllDetails(originalTitle);
            
            // استخدام اسم الفيلم الحقيقي
            const movieTitle = movieInfo.title || extractMovieName(originalTitle);
            const yearInfo = movieInfo.year ? `(${movieInfo.year})` : '';
            
            // بناء التفاصيل كما في الصورة الثانية
            const formattedTitle = buildStreamTitle(movieTitle, yearInfo, details, isCached);
            
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

// استخراج جميع التفاصيل من العنوان
function extractAllDetails(title) {
    const details = {
        movieName: '',
        size: '',
        seeders: '',
        source: '',
        codec: '',
        quality: '',
        audio: '',
        format: '',
        year: '',
        resolution: ''
    };
    
    // استخراج اسم الفيلم
    details.movieName = extractMovieName(title);
    
    // استخراج الحجم
    const sizeMatch = title.match(/(\d+\.?\d*)\s*(GB|GiB)/i);
    if (sizeMatch) {
        details.size = `${sizeMatch[1]} GB`;
    } else {
        const sizeMB = title.match(/(\d+\.?\d*)\s*(MB|MiB)/i);
        if (sizeMB) {
            details.size = `${(parseFloat(sizeMB[1]) / 1024).toFixed(1)} GB`;
        }
    }
    
    // استخراج البذور
    const seedMatch = title.match(/(\d+)\s*🌟/i) || 
                     title.match(/🌟\s*(\d+)/i) || 
                     title.match(/(\d+)\s*seeds?/i);
    if (seedMatch) {
        details.seeders = seedMatch[1];
    }
    
    // استخراج المصدر
    if (title.includes('thepiratebay')) details.source = 'thepiratebay';
    else if (title.includes('1337x')) details.source = '1337x';
    else if (title.includes('rarbg')) details.source = 'rarbg';
    else if (title.includes('yts')) details.source = 'yts';
    else details.source = 'torrent';
    
    // استخراج الكودك
    if (title.includes('H.265') || title.includes('x265') || title.includes('H265')) {
        details.codec = 'H265';
    } else if (title.includes('H.264') || title.includes('x264') || title.includes('H264')) {
        details.codec = 'H264';
    }
    
    // استخراج الجودة والملف
    if (title.includes('2160p') || title.includes('4K')) {
        details.quality = '4K';
        details.resolution = '2160p';
    } else if (title.includes('1080p')) {
        details.quality = '1080p';
        details.resolution = '1080p';
    } else if (title.includes('720p')) {
        details.quality = '720p';
        details.resolution = '720p';
    }
    
    // استخراج DV/HDR
    if (title.includes('DV') || title.includes('Dolby Vision')) {
        details.quality += ' DV';
    }
    if (title.includes('HDR')) {
        details.quality += ' HDR';
    }
    
    // استخراج نوع الملف
    if (title.includes('WEB-DL')) details.format = 'WEB-DL';
    else if (title.includes('WEBRip')) details.format = 'WEBRip';
    else if (title.includes('BluRay')) details.format = 'BluRay';
    else if (title.includes('HDTV')) details.format = 'HDTV';
    
    // استخراج الصوت
    if (title.includes('Atmos')) details.audio = 'Atmos';
    else if (title.includes('DDP5.1')) details.audio = 'DDP5.1';
    else if (title.includes('DDP')) details.audio = 'DDP';
    else if (title.includes('5.1')) details.audio = '5.1';
    else if (title.includes('DTS')) details.audio = 'DTS';
    else if (title.includes('AAC')) details.audio = 'AAC';
    else if (title.includes('AC3')) details.audio = 'AC3';
    
    // استخراج السنة
    const yearMatch = title.match(/(19|20)\d{2}/);
    if (yearMatch) details.year = yearMatch[0];
    
    return details;
}

// استخراج اسم الفيلم من العنوان
function extractMovieName(title) {
    // إزالة المعلومات التقنية
    let name = title
        .replace(/\[RD\]/g, '')
        .replace(/Jackettio.*/g, '')
        .replace(/ElfHosted.*/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\./g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    // إزالة الجودة والتفاصيل التقنية
    const techTerms = ['2160p', '1080p', '720p', '480p', '4K', 'WEB-DL', 'WEBRip', 'BluRay', 
                      'HDR', 'DV', 'Dolby', 'DTS', 'AAC', 'AC3', '5.1', 'Atmos', 'x265', 'x264',
                      'H.265', 'H.264', 'H265', 'H264', 'HEVC'];
    
    techTerms.forEach(term => {
        name = name.replace(new RegExp(term, 'gi'), '');
    });
    
    // تنظيف النهائي
    name = name
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);
    
    return name || 'Movie';
}

// بناء العنوان النهائي كما في الصورة الثانية
function buildStreamTitle(movieName, year, details, isCached) {
    // السطر الأول: اسم الفيلم (مختصر)
    const titleLine = `${movieName} ${year}`.trim();
    
    // السطر الثاني: معلومات الملف
    let fileInfo = '';
    if (details.format) {
        fileInfo = `${details.quality} ${details.format}`;
    } else {
        fileInfo = details.quality;
    }
    
    if (details.codec) {
        fileInfo += ` • ${details.codec}`;
    }
    
    // السطر الثالث: الحجم • البذور • المصدر
    const statsLine = `${details.size || 'Unknown'} • ${details.seeders || '?'} seeds • ${details.source}`;
    
    // السطر الرابع: الصوت والتقنيات
    const audioLine = details.audio || 'Stereo';
    
    // السطر الخامس: حالة الكاش
    const cacheLine = isCached ? '✅ Cached on Real-Debrid' : '🔗 Direct Torrent';
    
    // بناء العنوان النهائي
    return `${titleLine}

${fileInfo}
${statsLine}
${audioLine}
${cacheLine}`;
}

// DEBUG ENDPOINT
app.get('/debug/:id', async (req, res) => {
    const { id } = req.params;
    const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/movie/${id}.json`;
    
    try {
        const response = await fetch(torrentioUrl);
        const data = await response.json();
        
        res.json({
            success: true,
            url: torrentioUrl,
            streams_count: data.streams?.length || 0,
            raw_titles: data.streams?.map(s => s.title || s.name) || [],
            processed_example: data.streams?.slice(0, 1).map(stream => {
                const details = extractAllDetails(stream.title || stream.name);
                return {
                    original: stream.title || stream.name,
                    extracted_details: details,
                    final_title: buildStreamTitle(
                        extractMovieName(stream.title || stream.name),
                        details.year,
                        details,
                        stream.url.includes('real-debrid.com')
                    )
                };
            })
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// INSTALL PAGE
app.get('/install', (req, res) => {
    const installUrl = `https://${req.hostname}/manifest.json`;
    const stremioUrl = `stremio://stremio.xyz/app/${req.hostname}/manifest.json`;
    
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
                .preview {
                    background: #333;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 10px;
                    text-align: left;
                    font-family: monospace;
                    white-space: pre-line;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎬 Souhail Pro</h1>
                <p>Real-Debrid Streaming with Full Details</p>
                
                <div class="status">
                    <h3>${RD_KEY ? '✅ Ready to Install' : '❌ Configuration Required'}</h3>
                    <p>Real-Debrid API: ${RD_KEY ? 'Configured' : 'Not Configured'}</p>
                </div>
                
                <a href="${stremioUrl}" class="btn">📲 Install in Stremio</a>
                <a href="/manifest.json" class="btn" style="background: #666;">📄 View Manifest</a>
                <a href="/debug/tt0111161" class="btn" style="background: #8a2be2;">🔧 Debug</a>
                
                <div class="preview">
                    <strong>Example Stream Display:</strong>
                    
One Battle After Another (2025)

4K WEB-DL DV HDR 
• H265
28.67 GB 
• 455 seeds 
• thepiratebay
Dolby Atmos
✅ Cached on Real-Debrid
                </div>
                
                <div style="text-align: left; margin-top: 20px;">
                    <h4>✨ Features:</h4>
                    <ul>
                        <li>✅ Full movie name and year</li>
                        <li>✅ Quality and format (4K, 1080p, WEB-DL, etc.)</li>
                        <li>✅ File size and seeders count</li>
                        <li>✅ Torrent source (thepiratebay, 1337x, etc.)</li>
                        <li>✅ Audio details (Dolby Atmos, DTS, 5.1, etc.)</li>
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
        service: 'Souhail Pro',
        version: '2.0.0',
        realdebrid: RD_KEY ? 'configured' : 'missing'
    });
});

app.listen(PORT, () => {
    console.log(`
=======================================
🎬 Souhail Pro v2.0.0 - Full Details
=======================================
📍 Local: http://localhost:${PORT}
📲 Install: http://localhost:${PORT}/install
🔧 Debug: http://localhost:${PORT}/debug/tt0111161
🔑 RD Key: ${RD_KEY ? '✅ Configured' : '❌ Missing'}
=======================================
    `);
});
