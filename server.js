const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure downloads directory exists
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Clean up old files periodically (every 30 minutes)
setInterval(() => {
  cleanupDownloads();
}, 30 * 60 * 1000);

function cleanupDownloads() {
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(DOWNLOADS_DIR, file);
      const stat = fs.statSync(filePath);
      // Delete files older than 1 hour
      if (now - stat.mtimeMs > 60 * 60 * 1000) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up: ${file}`);
      }
    }
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}

// Helper: run yt-dlp command
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to run yt-dlp: ${err.message}. Make sure yt-dlp is installed.`));
    });

    // Timeout after 120 seconds
    setTimeout(() => {
      proc.kill();
      reject(new Error('Request timed out'));
    }, 120000);
  });
}

// API: Get video info
app.post('/api/info', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const output = await runYtDlp([
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      url
    ]);

    const info = JSON.parse(output);

    // Parse available formats
    const formats = (info.formats || []);

    // Get video formats (with both video and audio, or video only)
    const videoFormats = formats
      .filter(f => f.vcodec && f.vcodec !== 'none' && f.height)
      .map(f => ({
        format_id: f.format_id,
        ext: f.ext,
        quality: `${f.height}p`,
        height: f.height,
        width: f.width,
        fps: f.fps,
        filesize: f.filesize || f.filesize_approx || null,
        vcodec: f.vcodec,
        acodec: f.acodec,
        has_audio: f.acodec && f.acodec !== 'none',
        tbr: f.tbr
      }))
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    // Deduplicate by quality, keeping the best for each resolution
    const seenQualities = new Set();
    const uniqueVideoFormats = videoFormats.filter(f => {
      if (seenQualities.has(f.quality)) return false;
      seenQualities.add(f.quality);
      return true;
    });

    // Get audio formats
    const audioFormats = formats
      .filter(f => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
      .map(f => ({
        format_id: f.format_id,
        ext: f.ext,
        abr: f.abr,
        asr: f.asr,
        filesize: f.filesize || f.filesize_approx || null,
        acodec: f.acodec
      }))
      .sort((a, b) => (b.abr || 0) - (a.abr || 0));

    const result = {
      title: info.title || 'Untitled',
      thumbnail: info.thumbnail || null,
      duration: info.duration || 0,
      duration_string: info.duration_string || '',
      uploader: info.uploader || info.channel || 'Unknown',
      view_count: info.view_count || 0,
      like_count: info.like_count || 0,
      description: (info.description || '').substring(0, 300),
      webpage_url: info.webpage_url || url,
      extractor: info.extractor || 'unknown',
      video_formats: uniqueVideoFormats,
      audio_formats: audioFormats,
    };

    res.json(result);
  } catch (err) {
    console.error('Info error:', err.message);
    res.status(500).json({ error: 'Failed to fetch video info. Please check the URL and try again.' });
  }
});

// API: Download video/audio
app.post('/api/download', async (req, res) => {
  const { url, mode, quality } = req.body;
  // mode: 'video' | 'video_audio' | 'audio'
  // quality: e.g., '1080', '720', '480', '360', 'best'

  if (!url || !mode) {
    return res.status(400).json({ error: 'URL and mode are required' });
  }

  const fileId = uuidv4();
  let args = [];
  let outputTemplate = '';
  let expectedExt = '';

  switch (mode) {
    case 'video':
      // Video only (no audio)
      outputTemplate = path.join(DOWNLOADS_DIR, `${fileId}.%(ext)s`);
      if (quality && quality !== 'best') {
        args = [
          '-f', `bestvideo[height<=${quality}]`,
          '--no-playlist',
          '--no-warnings',
          '-o', outputTemplate,
          url
        ];
      } else {
        args = [
          '-f', 'bestvideo',
          '--no-playlist',
          '--no-warnings',
          '-o', outputTemplate,
          url
        ];
      }
      break;

    case 'video_audio':
      // Video + Audio merged (best quality)
      outputTemplate = path.join(DOWNLOADS_DIR, `${fileId}.%(ext)s`);
      if (quality && quality !== 'best') {
        args = [
          '-f', `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`,
          '--merge-output-format', 'mp4',
          '--no-playlist',
          '--no-warnings',
          '-o', outputTemplate,
          url
        ];
      } else {
        args = [
          '-f', 'bestvideo+bestaudio/best',
          '--merge-output-format', 'mp4',
          '--no-playlist',
          '--no-warnings',
          '-o', outputTemplate,
          url
        ];
      }
      expectedExt = 'mp4';
      break;

    case 'audio':
      // Audio only, extract to mp3
      outputTemplate = path.join(DOWNLOADS_DIR, `${fileId}.%(ext)s`);
      args = [
        '-f', 'bestaudio',
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--no-playlist',
        '--no-warnings',
        '-o', outputTemplate,
        url
      ];
      expectedExt = 'mp3';
      break;

    default:
      return res.status(400).json({ error: 'Invalid mode' });
  }

  try {
    // First, get the title for the filename
    let title = 'download';
    try {
      const infoOutput = await runYtDlp([
        '--print', 'title',
        '--no-playlist',
        '--no-warnings',
        url
      ]);
      title = infoOutput.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    } catch (e) {
      // ignore, use default title
    }

    await runYtDlp(args);

    // Find the downloaded file
    const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(fileId));
    if (files.length === 0) {
      return res.status(500).json({ error: 'Download failed - file not found' });
    }

    const downloadedFile = files[0];
    const filePath = path.join(DOWNLOADS_DIR, downloadedFile);
    const ext = path.extname(downloadedFile);
    const downloadName = `${title}${ext}`;

    // Stream the file to the client
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    stream.on('end', () => {
      // Clean up the file after sending
      setTimeout(() => {
        try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
      }, 5000);
    });

  } catch (err) {
    console.error('Download error:', err.message);
    res.status(500).json({ error: `Download failed: ${err.message}` });
  }
});

// Serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 SaveIt Video Downloader running at http://localhost:${PORT}\n`);

  // Check if yt-dlp is installed
  const check = spawn('yt-dlp', ['--version'], { windowsHide: true });
  check.on('error', () => {
    console.warn('⚠️  yt-dlp is not installed! Please install it:');
    console.warn('   pip install yt-dlp');
    console.warn('   or download from: https://github.com/yt-dlp/yt-dlp/releases\n');
  });
  check.stdout.on('data', (data) => {
    console.log(`✅ yt-dlp version: ${data.toString().trim()}`);
  });

  // Check if ffmpeg is installed
  const ffcheck = spawn('ffmpeg', ['-version'], { windowsHide: true });
  ffcheck.on('error', () => {
    console.warn('⚠️  ffmpeg is not installed! Needed for merging video+audio and audio extraction.');
    console.warn('   Download from: https://ffmpeg.org/download.html\n');
  });
  ffcheck.stdout.on('data', (data) => {
    const ver = data.toString().split('\n')[0];
    console.log(`✅ ${ver}`);
  });
});
