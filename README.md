# SaveIt — Video Downloader

Download video berkualitas tinggi dari semua platform sosial media hanya dari link video.

## Fitur

- ✅ **Download Video + Audio** — Kualitas terbaik, format MP4
- ✅ **Download Video Saja** — Tanpa audio
- ✅ **Download Audio Saja** — Format MP3 berkualitas tinggi
- ✅ **Pilih Kualitas** — 360p, 480p, 720p, 1080p, 1440p, 4K, dll.
- ✅ **1000+ Platform** — YouTube, Instagram, TikTok, Facebook, Twitter/X, dll.

## Prasyarat

1. **Node.js** (v18+): https://nodejs.org
2. **yt-dlp**: `pip install yt-dlp`
3. **ffmpeg** (untuk merge video+audio & extract audio): https://ffmpeg.org/download.html

## Cara Menjalankan

```bash
# Install dependencies
npm install

# Jalankan server
npm start
```

Buka `http://localhost:3000` di browser.

## Platform yang Didukung

YouTube, Instagram, TikTok, Facebook, Twitter/X, Reddit, Vimeo, Dailymotion, Twitch, SoundCloud, Bilibili, dan 1000+ platform lainnya.

Lihat daftar lengkap: https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md

## Struktur Project

```
WBSITE/
├── server.js           # Backend Express server
├── package.json        # Dependencies
├── public/
│   ├── index.html      # Frontend HTML
│   ├── style.css       # Styles (dark theme)
│   └── app.js          # Frontend JavaScript
├── downloads/          # Temporary download storage (auto-cleaned)
└── README.md
```
