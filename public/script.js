const preview = document.getElementById('preview');
const capture1Btn = document.getElementById('capture1');
const capture3Btn = document.getElementById('capture3');
const cameraList = document.getElementById('cameraList');
const statusEl = document.getElementById('status');
const photoGallery = document.getElementById('photoGallery');
const flashEl = document.getElementById('flash');
const refreshCamerasBtn = document.getElementById('refreshCameras');
const countdownEl = document.getElementById('countdown');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettings');

// Filter elements
const filterButtons = document.querySelectorAll('.filter-btn');

// Series layout: only stacked (3 photos one on top of another)
const seriesLayout = { rows: 3, cols: 1 };
const seriesCount = seriesLayout.rows * seriesLayout.cols;

let currentCollageLayout = '1x3';
let currentCollageCount = 3;

let stream = null;
let currentDeviceId = null;
let currentFilter = 'none';
let canvas = document.createElement('canvas');
let ctx = canvas.getContext('2d');

// Audio context for sounds
let audioContext;

// Initialize audio
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Play a beep sound
function playBeep(frequency = 800, duration = 0.1) {
  if (!audioContext) initAudio();
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// Play shutter sound (two quick beeps)
function playShutter() {
  playBeep(1000, 0.05);
  setTimeout(() => playBeep(800, 0.1), 50);
}

// Play countdown beep
function playCountdownBeep() {
  playBeep(600, 0.08);
}

// Trigger flash animation with shutter sound
function triggerFlash() {
  flashEl.classList.add('active');
  playShutter();
  return new Promise(resolve => {
    setTimeout(() => {
      flashEl.classList.remove('active');
      resolve();
    }, 150);
  });
}

// Show countdown animation with sounds
function showCountdown() {
  countdownEl.classList.add('active');
  countdownEl.textContent = '3';
  playCountdownBeep();
  
  return new Promise(resolve => {
    setTimeout(() => {
      countdownEl.textContent = '2';
      playCountdownBeep();
      setTimeout(() => {
        countdownEl.textContent = '1';
        playCountdownBeep();
        setTimeout(() => {
          countdownEl.textContent = '';
          countdownEl.classList.remove('active');
          resolve();
        }, 1000);
      }, 1000);
    }, 1000);
  });
}

// Show status message
function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? '#ff4444' : '#feca57';
  if (!isError) {
    setTimeout(() => statusEl.textContent = '', 3000);
  }
}

function showError(msg) {
  const el = document.createElement('div');
  el.className = 'error';
  el.textContent = msg;
  document.body.prepend(el);
}

// Load and display saved photos (limited to last 6)
async function loadPhotos() {
  try {
    const response = await fetch('/photos');
    let photos = await response.json();
    
    // Show only the last 6 photos
    photos = photos.slice(0, 6);
    
    photoGallery.innerHTML = '';
    if (photos.length === 0) {
      photoGallery.innerHTML = '<p style="color: #666; grid-column: 1/-1;">No photos yet. Take some!</p>';
      return;
    }
    
    photos.forEach(photo => {
      const img = document.createElement('img');
      img.src = `/${photo}`;
      img.alt = photo;
      img.title = photo;
      photoGallery.appendChild(img);
    });
  } catch (err) {
    console.error('Failed to load photos:', err);
  }
}

// Save photo to server
async function savePhoto(base64Image, prefix = 'photo', skipReload = false) {
  try {
    const response = await fetch('/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image, prefix })
    });
    const result = await response.json();
    if (result.success) {
      showStatus('Photo saved!');
      if (!skipReload) {
        loadPhotos();
      }
    } else {
      showStatus('Failed to save photo', true);
    }
  } catch (err) {
    showStatus('Error saving photo', true);
    console.error('Save error:', err);
  }
}

// Filter CSS strings
const filterPresets = {
  none: '',
  vintage: 'sepia(0.8) saturate(1.2) brightness(0.9) contrast(1.1)',
  polaroid: 'brightness(1.2) contrast(0.95) sepia(0.3) saturate(0.9) hue-rotate(-3deg)',
  noir: 'grayscale(1) contrast(1.3) brightness(1.1)'
};

// Add Polaroid frame to canvas
function addPolaroidFrame(sourceCanvas) {
  const padding = 40;
  const bottomPadding = 60;
  const frameWidth = sourceCanvas.width + padding * 2;
  const frameHeight = sourceCanvas.height + padding * 2 + bottomPadding;
  
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = frameWidth;
  frameCanvas.height = frameHeight;
  const ctx = frameCanvas.getContext('2d');
  
  // White background
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, frameWidth, frameHeight);
  
  // Add subtle drop shadow for photo
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  
  // Draw the photo
  ctx.drawImage(sourceCanvas, padding, padding, sourceCanvas.width, sourceCanvas.height);
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Draw Polaroid-style border (slightly darker white for depth)
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(padding - 1, padding - 1, sourceCanvas.width + 2, sourceCanvas.height + 2);
  
  // Add timestamp at bottom (optional Polaroid look)
  const timestamp = new Date().toLocaleDateString();
  ctx.fillStyle = '#999';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(timestamp, frameWidth / 2, frameHeight - 20);
  
  return frameCanvas;
}

function capture() {
  const width = preview.videoWidth;
  const height = preview.videoHeight;
  canvas.width = width;
  canvas.height = height;
  
  // Apply filter to canvas context
  ctx.filter = filterPresets[currentFilter];
  
  // Note: video is mirrored with scaleX(-1), so we flip it back
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(preview, -width, 0, width, height);
  ctx.restore();
  
  // Reset filter for next draw
  ctx.filter = 'none';
  
  return canvas;
}

// Stop current stream
async function stopStream() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

// Start camera with specific device
async function startCamera(deviceId = null) {
  await stopStream();
  
  const constraints = {
    video: deviceId ? { deviceId } : { facingMode: 'user' },
    audio: false
  };
  
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    preview.srcObject = stream;
    currentDeviceId = deviceId;
    showStatus(`Camera ready`);
  } catch (err) {
    showError('Camera access denied. Please allow camera access.');
    console.error('Camera error:', err);
  }
}

// Populate camera dropdown
async function populateCameraList() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    
    cameraList.innerHTML = '';
    videoDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Camera ${index + 1}`;
      if (index === 0) option.selected = true;
      cameraList.appendChild(option);
    });
    
    // Start with first camera
    if (videoDevices.length > 0) {
      await startCamera(videoDevices[0].deviceId);
    } else {
      showStatus('No cameras found', true);
    }
  } catch (err) {
    showError('Could not access camera list.');
    console.error('Enumerate error:', err);
  }
}

// Camera selection change
cameraList.addEventListener('change', async (e) => {
  const deviceId = e.target.value;
  if (deviceId) {
    await startCamera(deviceId);
  }
});

// Refresh camera list
refreshCamerasBtn.addEventListener('click', async () => {
  showStatus('Refreshing cameras...');
  await populateCameraList();
});

// Settings modal
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('active');
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('active');
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('active');
  }
});

// Auto-refresh when devices change (e.g., plugging in a new camera)
if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange) {
  navigator.mediaDevices.addEventListener('devicechange', async () => {
    showStatus('Camera device changed - refreshing...');
    await new Promise(resolve => setTimeout(resolve, 500));
    await populateCameraList();
  });
}

// Filter functions
function applyFilter(filterName) {
  // Update current filter
  currentFilter = filterName;
  
  // Remove all filter classes
  preview.classList.remove('filter-vintage', 'filter-polaroid', 'filter-noir');
  
  // Apply the selected filter
  if (filterName !== 'none') {
    preview.classList.add(`filter-${filterName}`);
  }
  
  // Update active button state
  filterButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterName);
  });
  
  showStatus(`Filter: ${filterName}`);
}

// Set up filter buttons
filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    applyFilter(btn.dataset.filter);
  });
});

// Series is fixed at 3 stacked photos
// Initialize series count
currentCollageCount = seriesCount;

// Single capture with Polaroid frame
capture1Btn.addEventListener('click', async () => {
  capture1Btn.disabled = true;
  capture3Btn.disabled = true;
  
  await showCountdown();
  await triggerFlash();
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const c = capture();
  const framed = addPolaroidFrame(c);
  const base64 = framed.toDataURL('image/jpeg', 0.9);
  await savePhoto(base64, 'single');
  
  capture1Btn.disabled = false;
  capture3Btn.disabled = false;
});

// Series capture: 3 photos stacked vertically
capture3Btn.addEventListener('click', async () => {
  const layout = seriesLayout;
  const totalShots = seriesCount;
  showStatus(`Capturing ${totalShots} photos...`);
  capture3Btn.disabled = true;
  capture1Btn.disabled = true;
  
  const shots = [];
  const width = preview.videoWidth;
  const height = preview.videoHeight;
  const collageTimestamp = Date.now();
  
  // Countdown before first shot
  await showCountdown();
  
  // Take multiple shots with flash before each
  for (let i = 0; i < totalShots; i++) {
    await triggerFlash();
    await new Promise(resolve => setTimeout(resolve, 50));
    const c = capture();
    const base64 = c.toDataURL('image/jpeg', 0.9);
    shots.push(base64);
    
    // Save each individual shot with sequence number (skip reload for now)
    await savePhoto(base64, `series-${collageTimestamp}-${i+1}`, true);
    
    // Wait between shots (no countdown, just delay)
    if (i < totalShots - 1) {
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
  
  // Create merged canvas based on layout
  const merged = document.createElement('canvas');
  merged.width = width * layout.cols;
  merged.height = height * layout.rows;
  const mCtx = merged.getContext('2d');
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  
  for (let i = 0; i < totalShots; i++) {
    const img = new Image();
    const row = Math.floor(i / layout.cols);
    const col = i % layout.cols;
    
    await new Promise(resolve => {
      img.onload = () => {
        tempCtx.save();
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(img, -width, 0, width, height);
        tempCtx.restore();
        mCtx.drawImage(tempCanvas, col * width, row * height, width, height);
        resolve();
      };
      img.src = shots[i];
    });
  }
  
  // Save merged version (this will trigger gallery reload)
  const base64 = merged.toDataURL('image/jpeg', 0.9);
  await savePhoto(base64, `series-${collageTimestamp}-collage`);
  
  capture3Btn.disabled = false;
  capture1Btn.disabled = false;
});

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input/select
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    // Space bar for single capture
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      capture1Btn.click();
    }
    
    // B key for burst capture
    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      capture3Btn.click();
    }
  });
}

// Initialize
async function init() {
  await populateCameraList();
  await loadPhotos();
  setupKeyboardShortcuts();
}

// Start when page loads
document.addEventListener('DOMContentLoaded', init);
