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

// STREAM - كل تفصيل في سطر منفصل
app.get('/stream/:type/:id.json', async (req, res) => {
    if (!RD_KEY) return res.json({ streams: [] });
    
    try {
        const { type, id } = req.params;
        
        // الحصول على معلومات الفيلم من TMDB
        let movieInfo = { title: 'Movie', year: '' };
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
            console.log("TMDB error:", e.message);
        }
        
        // الحصول على الستريمات من Torrentio
        const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${type}/${id}.json`;
        const response = await fetch(torrentioUrl);
        const data = await response.json();
        
        if (!data.streams || data.streams.length === 0) {
            return res.json({ streams: [] });
        }
        
        const processedStreams = data.streams.map((stream, index) => {
            const originalTitle = stream.title || stream.name || '';
            const isCached = stream.url.includes('real-debrid.com');
            
            // استخراج جميع التفاصيل
            const details = extractFullDetails(originalTitle);
            
            // بناء العنوان مع كل تفصيل في سطر
            const formattedTitle = buildMultiLineTitle(
                movieInfo.title + (movieInfo.year ? ` (${movieInfo.year})` : ''),
                details,
                isCached,
                index + 1
            );
            
            return {
                title: formattedTitle,
                url: stream.url,
                behaviorHints: stream.behaviorHints || {}
            };
        });
        
        res.json({ streams: processedStreams });
        
    } catch (error) {
        console.error("Error:", error);
        res.json({ streams: [] });
    }
});

// استخراج جميع التفاصيل
function extractFullDetails(title) {
    const details = {
        quality: '',
        format: '',
        resolution: '',
        codec: '',
        size: '',
        seeders: '',
        source: '',
        audio: '',
        language: '',
        features: '',
        bitrate: '',
        group: ''
    };
    
    // الجودة والدقة
    if (title.includes('2160p') || title.includes('4K')) {
        details.quality = '4K';
        details.resolution = '2160p';
    } else if (title.includes('1080p')) {
        details.quality = '1080p';
        details.resolution = '1080p';
    } else if (title.includes('720p')) {
        details.quality = '720p';
        details.resolution = '720p';
    } else {
        details.quality = 'HD';
        details.resolution = 'HD';
    }
    
    // مميزات خاصة
    const features = [];
    if (title.includes('DV') || title.includes('Dolby Vision')) features.push('DV');
    if (title.includes('HDR')) features.push('HDR');
    if (title.includes('10Bit')) features.push('10Bit');
    if (title.includes('REMUX')) features.push('REMUX');
    details.features = features.join(' • ');
    
    // تنسيق الملف
    if (title.includes('WEB-DL')) details.format = 'WEB-DL';
    else if (title.includes('WEBRip')) details.format = 'WEBRip';
    else if (title.includes('BluRay')) details.format = 'BluRay';
    else if (title.includes('HDTV')) details.format = 'HDTV';
    else if (title.includes('CAM')) details.format = 'CAM';
    else if (title.includes('TS')) details.format = 'TS';
    
    // الكودك
    if (title.includes('H.265') || title.includes('x265') || title.includes('H265')) {
        details.codec = 'H.265 / x265';
    } else if (title.includes('H.264') || title.includes('x264') || title.includes('H264')) {
        details.codec = 'H.264 / x264';
    }
    
    // الحجم
    const sizeMatch = title.match(/(\d+\.?\d*)\s*(GB|GiB)/i);
    if (sizeMatch) {
        details.size = `${sizeMatch[1]} GB`;
    } else {
        const sizeMB = title.match(/(\d+\.?\d*)\s*(MB|MiB)/i);
        if (sizeMB) {
            details.size = `${(parseFloat(sizeMB[1]) / 1024).toFixed(1)} GB`;
        } else {
            details.size = 'Unknown';
        }
    }
    
    // عدد البذور
    const seedMatch = title.match(/🌟\s*(\d+)/i) || 
                     title.match(/(\d+)\s*🌟/i) || 
                     title.match(/(\d+)\s*seeds?/i);
    details.seeders = seedMatch ? seedMatch[1] : '?';
    
    // المصدر
    if (title.includes('thepiratebay')) details.source = 'The Pirate Bay';
    else if (title.includes('1337x')) details.source = '1337x';
    else if (title.includes('rarbg')) details.source = 'RARBG';
    else if (title.includes('yts')) details.source = 'YTS';
    else details.source = 'Torrent';
    
    // الصوت
    if (title.includes('Atmos')) details.audio = 'Dolby Atmos';
    else if (title.includes('DDP5.1')) details.audio = 'Dolby Digital Plus 5.1';
    else if (title.includes('DDP')) details.audio = 'Dolby Digital Plus';
    else if (title.includes('5.1')) details.audio = '5.1 Surround';
    else if (title.includes('DTS')) details.audio = 'DTS';
    else if (title.includes('AAC')) details.audio = 'AAC';
    else if (title.includes('AC3')) details.audio = 'AC3';
    else details.audio = 'Stereo';
    
    // اللغة
    if (title.includes('French')) details.language = 'French';
    else if (title.includes('Arabic')) details.language = 'Arabic';
    else if (title.includes('Multi')) details.language = 'Multi';
    else details.language = 'English';
    
    // البتريت
    if (title.includes('VBR')) details.bitrate = 'Variable';
    else if (title.includes('CBR')) details.bitrate = 'Constant';
    
    // المجموعة
    const groupMatch = title.match(/-(\w+)$/);
    if (groupMatch) details.group = groupMatch[1];
    
    return details;
}

// بناء العنوان مع كل سطر منفصل
function buildMultiLineTitle(movieName, details, isCached, streamNumber) {
    const lines = [];
    
    // السطر 1: اسم الفيلم مع رقم الستريم
    lines.push(`🎬 ${movieName}`);
    
    // سطر فارغ للفصل
    lines.push('');
    
    // السطر 2: الجودة والتنسيق
    let qualityLine = `📺 Quality: ${details.quality}`;
    if (details.format) qualityLine += ` | ${details.format}`;
    if (details.features) qualityLine += ` | ${details.features}`;
    lines.push(qualityLine);
    
    // السطر 3: الدقة والكودك
    let codecLine = `🎞️ Resolution: ${details.resolution}`;
    if (details.codec) codecLine += ` | Codec: ${details.codec}`;
    if (details.bitrate) codecLine += ` | ${details.bitrate}`;
    lines.push(codecLine);
    
    // السطر 4: الحجم
    lines.push(`💾 Size: ${details.size}`);
    
    // السطر 5: البذور
    lines.push(`👤 Seeders: ${details.seeders}`);
    
    // السطر 6: المصدر
    lines.push(`🏷️ Source: ${details.source}`);
    
    // السطر 7: الصوت
    lines.push(`🔊 Audio: ${details.audio}`);
    
    // السطر 8: اللغة
    lines.push(`🌍 Language: ${details.language}`);
    
    // السطر 9: حالة الكاش
    lines.push(isCached ? '✅ Status: Cached on Real-Debrid' : '🔗 Status: Direct Torrent');
    
    // إذا كان هناك مجموعة
    if (details.group) {
        lines.push(`👥 Release Group: ${details.group}`);
    }
    
    return lines.join('\n');
}

// TEST PAGE
app.get('/test-details/:id?', (req, res) => {
    const testId = req.params.id || 'tt1234567';
    
    // مثال على تفاصيل كاملة
    const exampleDetails = {
        quality: '4K',
        format: 'WEB-DL',
        resolution: '2160p',
        codec: 'H.265 / x265',
        size: '28.67 GB',
        seeders: '455',
        source: 'The Pirate Bay',
        audio: 'Dolby Atmos',
        language: 'English',
        features: 'DV • HDR',
        bitrate: 'Variable',
        group: 'AOC'
    };
    
    const exampleTitle = buildMultiLineTitle(
        'One Battle After Another (2025)',
        exampleDetails,
        true,
        1
    );
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Test Details Format</title>
            <style>
                body {
                    font-family: monospace;
                    padding: 20px;
                    background: #1a1a1a;
                    color: white;
                }
                .title-box {
                    background: #2a2a2a;
                    padding: 20px;
                    margin: 20px 0;
                    border-radius: 10px;
                    white-space: pre-line;
                    line-height: 1.6;
                }
                .info {
                    color: #aaa;
                    margin-top: 30px;
                }
            </style>
        </head>
        <body>
            <h1>🎬 Example Stream Display</h1>
            <p>Each detail on its own line:</p>
            
            <div class="title-box">
${exampleTitle}
            </div>
            
            <div class="info">
                <p><strong>Total Lines:</strong> 10 lines</p>
                <p><strong>Each detail is separate</strong></p>
                <p>Movie name, quality, resolution, size, seeders, source, audio, language, cache status</p>
            </div>
        </body>
        </html>
    `);
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
            <title>Souhail Pro - Multi-Line Details</title>
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
                .example {
                    background: #333;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 10px;
                    text-align: left;
                    white-space: pre-line;
                    line-height: 1.6;
                    font-family: monospace;
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
                <h1>🎬 Souhail Pro</h1>
                <p>Real-Debrid Streaming - Multi-Line Details</p>
                
                <div class="example">
🎬 One Battle After Another (2025)

📺 Quality: 4K | WEB-DL | DV • HDR
🎞️ Resolution: 2160p | Codec: H.265 / x265 | Variable
💾 Size: 28.67 GB
👤 Seeders: 455
🏷️ Source: The Pirate Bay
🔊 Audio: Dolby Atmos
🌍 Language: English
✅ Status: Cached on Real-Debrid
👥 Release Group: AOC
                </div>
                
                <a href="${stremioUrl}" class="btn">📲 Install in Stremio</a>
                <a href="/test-details" class="btn" style="background: #8a2be2;">🔍 View Example</a>
                <a href="/manifest.json" class="btn" style="background: #666;">📄 Manifest</a>
                
                <div style="text-align: left; margin-top: 20px; color: #aaa;">
                    <h4>✨ كل تفصيل في سطر منفصل:</h4>
                    <ol>
                        <li>اسم الفيلم والسنة</li>
                        <li>الجودة والتنسيق والمميزات</li>
                        <li>الدقة والكودك والبتريت</li>
                        <li>حجم الملف</li>
                        <li>عدد البذور</li>
                        <li>مصدر التورنت</li>
                        <li>جودة الصوت</li>
                        <li>اللغة</li>
                        <li>حالة الكاش</li>
                        <li>مجموعة النشر (إذا وجدت)</li>
                    </ol>
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

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        service: 'Souhail Pro - Multi-Line',
        realdebrid: RD_KEY ? 'configured' : 'missing'
    });
});

app.listen(PORT, () => {
    console.log(`
=======================================
🎬 Souhail Pro - Multi-Line Details
=======================================
📍 Local: http://localhost:${PORT}
📲 Install: http://localhost:${PORT}/install
🔍 Example: http://localhost:${PORT}/test-details
=======================================
    `);
});
