// ===== State =====
let currentVideoUrl = '';
let currentMode = 'video_audio';
let currentQuality = 'best';
let videoData = null;

// ===== Fetch Video Info =====
async function fetchVideoInfo() {
  const urlInput = document.getElementById('urlInput');
  const url = urlInput.value.trim();

  if (!url) {
    showError('Silakan masukkan link video terlebih dahulu!');
    urlInput.focus();
    return;
  }

  // Basic URL validation
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    showError('Link tidak valid. Pastikan dimulai dengan http:// atau https://');
    urlInput.focus();
    return;
  }

  currentVideoUrl = url;
  hideError();
  setFetchLoading(true);
  hideVideoInfo();

  try {
    const response = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Gagal mengambil info video');
    }

    videoData = data;
    displayVideoInfo(data);
  } catch (err) {
    showError(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
  } finally {
    setFetchLoading(false);
  }
}

// ===== Display Video Info =====
function displayVideoInfo(data) {
  // Thumbnail
  const thumbnail = document.getElementById('thumbnail');
  if (data.thumbnail) {
    thumbnail.src = data.thumbnail;
    thumbnail.alt = data.title;
  } else {
    thumbnail.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" fill="%2316161f"><rect width="320" height="180"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%236a6a80" font-size="14">No Thumbnail</text></svg>');
  }

  // Duration
  const durationBadge = document.getElementById('durationBadge');
  if (data.duration_string) {
    durationBadge.textContent = data.duration_string;
    durationBadge.style.display = 'block';
  } else if (data.duration) {
    durationBadge.textContent = formatDuration(data.duration);
    durationBadge.style.display = 'block';
  } else {
    durationBadge.style.display = 'none';
  }

  // Title
  document.getElementById('videoTitle').textContent = data.title;

  // Uploader
  const uploaderEl = document.getElementById('videoUploader');
  uploaderEl.querySelector('span').textContent = data.uploader;

  // Views
  const viewsEl = document.getElementById('videoViews');
  if (data.view_count) {
    viewsEl.querySelector('span').textContent = formatNumber(data.view_count) + ' views';
    viewsEl.style.display = 'inline-flex';
  } else {
    viewsEl.style.display = 'none';
  }

  // Platform
  const platformEl = document.getElementById('videoPlatform');
  platformEl.querySelector('span').textContent = data.extractor;

  // Populate quality options
  populateQualityOptions(data);

  // Show the section
  const videoInfo = document.getElementById('videoInfo');
  videoInfo.style.display = 'block';
  videoInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== Populate Quality Options =====
function populateQualityOptions(data) {
  const grid = document.getElementById('qualityGrid');
  grid.innerHTML = '';

  const formats = data.video_formats || [];

  if (formats.length === 0 && currentMode !== 'audio') {
    // No specific formats, show "Best" only
    grid.innerHTML = createQualityRadio('best', 'Terbaik', '', true, true);
    currentQuality = 'best';
    return;
  }

  // Add "Best" option first
  let html = createQualityRadio('best', 'Terbaik', '', true, true);

  // Add available qualities
  const qualities = [];
  const seen = new Set();

  for (const f of formats) {
    const h = f.height;
    if (!h || seen.has(h)) continue;
    seen.add(h);
    const label = `${h}p`;
    const sizeStr = f.filesize ? formatFileSize(f.filesize) : '';
    const isBest = h >= 1080;
    qualities.push({ height: h, label, sizeStr, isBest });
  }

  // Sort descending
  qualities.sort((a, b) => b.height - a.height);

  for (const q of qualities) {
    html += createQualityRadio(q.height.toString(), q.label, q.sizeStr, false, q.height >= 2160);
  }

  grid.innerHTML = html;
  currentQuality = 'best';
}

function createQualityRadio(value, name, size, checked, badge) {
  const badgeHtml = badge && value === 'best' ? '<span class="quality-badge">HD</span>' : '';
  return `
    <div class="quality-option">
      <input type="radio" name="quality" id="q_${value}" value="${value}" ${checked ? 'checked' : ''} onchange="currentQuality = '${value}'">
      <label for="q_${value}">
        <span class="quality-name">${name}</span>
        ${size ? `<span class="quality-size">${size}</span>` : ''}
      </label>
      ${badgeHtml}
    </div>
  `;
}

// ===== Mode Selection =====
function selectMode(el) {
  // Update active tab
  document.querySelectorAll('.mode-tab').forEach(tab => tab.classList.remove('active'));
  el.classList.add('active');

  currentMode = el.dataset.mode;

  // Show/hide quality section
  const qualitySection = document.getElementById('qualitySection');
  if (currentMode === 'audio') {
    qualitySection.style.display = 'none';
  } else {
    qualitySection.style.display = 'block';
    if (videoData) {
      populateQualityOptions(videoData);
    }
  }

  // Update download button text
  const texts = {
    'video_audio': 'Download Video + Audio',
    'video': 'Download Video Saja',
    'audio': 'Download Audio (MP3)',
  };
  document.getElementById('downloadBtnText').textContent = texts[currentMode] || 'Download Sekarang';
}

// ===== Start Download =====
async function startDownload() {
  if (!currentVideoUrl) {
    showError('Silakan cari video terlebih dahulu!');
    return;
  }

  const downloadBtn = document.getElementById('downloadBtn');
  const progressSection = document.getElementById('progressSection');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  // Disable button
  downloadBtn.disabled = true;
  downloadBtn.querySelector('#downloadBtnText').textContent = 'Sedang memproses...';

  // Show progress
  progressSection.style.display = 'block';
  progressFill.style.width = '0%';
  progressText.textContent = 'Mempersiapkan download...';

  // Animate progress bar
  let progress = 0;
  const progressInterval = setInterval(() => {
    if (progress < 85) {
      progress += Math.random() * 8;
      progressFill.style.width = Math.min(progress, 85) + '%';
    }
    if (progress > 20) {
      progressText.textContent = 'Sedang mengunduh dan memproses file...';
    }
    if (progress > 60) {
      progressText.textContent = 'Hampir selesai, menyiapkan file...';
    }
  }, 500);

  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: currentVideoUrl,
        mode: currentMode,
        quality: currentMode === 'audio' ? null : currentQuality,
      }),
    });

    clearInterval(progressInterval);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Download gagal');
    }

    progressFill.style.width = '95%';
    progressText.textContent = 'Menyimpan file...';

    // Get filename from Content-Disposition header
    const disposition = response.headers.get('Content-Disposition');
    let filename = 'download';
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match) {
        filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
      }
    }

    // Download the blob
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    progressFill.style.width = '100%';
    progressText.textContent = '✅ Download berhasil! File telah disimpan.';
    progressFill.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';

    setTimeout(() => {
      progressFill.style.background = '';
    }, 3000);

  } catch (err) {
    clearInterval(progressInterval);
    progressFill.style.width = '100%';
    progressFill.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    progressText.textContent = `❌ ${err.message}`;
    showError(err.message);

    setTimeout(() => {
      progressFill.style.background = '';
    }, 3000);
  } finally {
    downloadBtn.disabled = false;
    const texts = {
      'video_audio': 'Download Video + Audio',
      'video': 'Download Video Saja',
      'audio': 'Download Audio (MP3)',
    };
    downloadBtn.querySelector('#downloadBtnText').textContent = texts[currentMode] || 'Download Sekarang';
  }
}

// ===== Utility Functions =====
function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError() {
  document.getElementById('errorMsg').style.display = 'none';
}

function hideVideoInfo() {
  document.getElementById('videoInfo').style.display = 'none';
}

function setFetchLoading(loading) {
  const btn = document.getElementById('fetchBtn');
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');

  btn.disabled = loading;
  text.style.display = loading ? 'none' : 'inline';
  loader.style.display = loading ? 'inline-flex' : 'none';
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + ' KB';
  return bytes + ' B';
}

// ===== Enter Key Handler =====
document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      fetchVideoInfo();
    }
  });

  // Auto-paste from clipboard on focus (optional UX)
  urlInput.addEventListener('focus', async () => {
    if (urlInput.value) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        urlInput.value = text;
        urlInput.select();
      }
    } catch (e) {
      // Clipboard permission denied, ignore
    }
  });
});
