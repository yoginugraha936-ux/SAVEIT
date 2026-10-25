const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

function check() {
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
    console.log('✅ yt-dlp already installed globally.');
    return;
  } catch (e) {}

  const isWin = process.platform === 'win32';
  const targetPath = path.join(__dirname, isWin ? 'yt-dlp.exe' : 'yt-dlp');
  if (fs.existsSync(targetPath)) {
    console.log('✅ local yt-dlp binary exists.');
    return;
  }

  console.log('⬇️ Downloading standalone yt-dlp binary...');
  const url = isWin
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  function download(downloadUrl) {
    https.get(downloadUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location);
      }
      const file = fs.createWriteStream(targetPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          if (!isWin) {
            try { fs.chmodSync(targetPath, '755'); } catch (err) {}
          }
          console.log('✅ Standalone yt-dlp ready at:', targetPath);
        });
      });
    }).on('error', (err) => {
      console.warn('⚠️ Could not download yt-dlp automatically:', err.message);
    });
  }

  download(url);
}

check();
