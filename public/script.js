// ===========================================================================
// Elements
// ===========================================================================
const preview = document.getElementById('preview');
const capture1Btn = document.getElementById('capture1');
const capture3Btn = document.getElementById('capture3');
const openGalleryBtn = document.getElementById('openGallery');
const cameraList = document.getElementById('cameraList');
const cameraInfo = document.getElementById('cameraInfo');
const statusEl = document.getElementById('status');
const recentPhotosEl = document.getElementById('recentPhotos');
const flashEl = document.getElementById('flash');
const refreshCamerasBtn = document.getElementById('refreshCameras');
const countdownEl = document.getElementById('countdown');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettings');
const printMethodSelect = document.getElementById('printMethod');
const printerInfo = document.getElementById('printerInfo');
const bindingsTable = document.getElementById('bindingsTable');
const resetBindingsBtn = document.getElementById('resetBindings');
const hintBar = document.getElementById('hintBar');
const galleryView = document.getElementById('galleryView');
const galleryGrid = document.getElementById('galleryGrid');
const galleryCount = document.getElementById('galleryCount');
const galleryHintBar = document.getElementById('galleryHintBar');
const gamepadStatusEl = document.getElementById('gamepadStatus');
const filterButtons = document.querySelectorAll('.filter-btn');

const RECENT_COUNT = 6;
const SERIES_COUNT = 3;
// The series collage is composed at the paper's aspect ratio (100 x 148 mm,
// portrait) so it prints edge to edge without cropping.
const SERIES_ASPECT = 148 / 100;

// ===========================================================================
// Local settings (per kiosk browser)
// ===========================================================================
function loadSetting(key, fallback) {
  try {
    const raw = localStorage.getItem(`photobooth.${key}`);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(`photobooth.${key}`, JSON.stringify(value));
  } catch (e) {
    // Storage unavailable - setting only lasts for this page load
  }
}

// ===========================================================================
// Sounds
// ===========================================================================
let audioContext;

function playBeep(frequency = 800, duration = 0.1) {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
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
  } catch (e) {
    // No audio available - sounds are optional
  }
}

function playShutter() {
  playBeep(1000, 0.05);
  setTimeout(() => playBeep(800, 0.1), 50);
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// ===========================================================================
// Status, flash, countdown
// ===========================================================================
let statusTimer = null;

function showStatus(msg, isError = false) {
  clearTimeout(statusTimer);
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', isError);
  statusEl.classList.add('visible');
  statusTimer = setTimeout(() => statusEl.classList.remove('visible'), isError ? 6000 : 2500);
}

async function triggerFlash() {
  flashEl.classList.add('active');
  playShutter();
  await wait(150);
  flashEl.classList.remove('active');
}

async function showCountdown() {
  countdownEl.classList.add('active');
  for (const n of ['3', '2', '1']) {
    countdownEl.textContent = n;
    // Restart the pulse animation for every number
    countdownEl.style.animation = 'none';
    void countdownEl.offsetWidth;
    countdownEl.style.animation = '';
    playBeep(600, 0.08);
    await wait(1000);
  }
  countdownEl.textContent = '';
  countdownEl.classList.remove('active');
}

// ===========================================================================
// Camera
// ===========================================================================
let stream = null;
let currentDeviceId = null;
let cameraRestartTimer = null;

function streamIsLive() {
  return !!stream && stream.getVideoTracks().some(t => t.readyState === 'live');
}

function stopStream() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

async function startCamera(deviceId = null) {
  stopStream();

  const video = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 }
  };
  if (deviceId) {
    video.deviceId = { exact: deviceId };
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
  } catch (err) {
    if (deviceId && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
      // Saved camera is gone - use whatever is available
      return startCamera(null);
    }
    console.error('Camera error:', err);
    showStatus(err.name === 'NotAllowedError'
      ? 'Camera access denied - please allow camera access'
      : `Camera error: ${err.message}`, true);
    return false;
  }

  preview.srcObject = stream;
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  currentDeviceId = settings.deviceId || deviceId;
  cameraInfo.textContent = `${track.label || 'Camera'}: ${settings.width}x${settings.height} @ ${Math.round(settings.frameRate || 0)} fps`;
  console.log('Camera started:', cameraInfo.textContent);

  // A USB camera that drops out (loose cable, power saving) ends the track.
  // Note: 'ended' does not fire for our own track.stop() calls.
  track.addEventListener('ended', () => {
    console.warn('Camera track ended');
    showStatus('Camera lost - reconnecting...', true);
    scheduleCameraRecovery();
  });
  return true;
}

// Fill the dropdown; returns the list of video devices
async function refreshCameraList() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter(d => d.kind === 'videoinput');

  cameraList.innerHTML = '';
  videoDevices.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.text = device.label || `Camera ${index + 1}`;
    option.selected = device.deviceId === currentDeviceId;
    cameraList.appendChild(option);
  });
  return videoDevices;
}

// Make sure a live stream is running, preferring the camera chosen in settings
async function ensureCamera() {
  const devices = await refreshCameraList();
  const preferred = loadSetting('cameraId', null);
  const preferredPresent = devices.some(d => d.deviceId === preferred);
  const currentPresent = devices.some(d => d.deviceId === currentDeviceId);

  if (!streamIsLive() || !currentPresent || (preferredPresent && currentDeviceId !== preferred)) {
    if (devices.length === 0) {
      stopStream();
      showStatus('No camera found - plug in a camera', true);
      return;
    }
    await startCamera(preferredPresent ? preferred : null);
    await refreshCameraList();
  }
}

function scheduleCameraRecovery(delay = 1500) {
  clearTimeout(cameraRestartTimer);
  cameraRestartTimer = setTimeout(async () => {
    await ensureCamera();
    if (!streamIsLive()) {
      scheduleCameraRecovery(5000); // keep trying until the camera is back
    }
  }, delay);
}

async function initCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showStatus('Camera API not available - open via http://localhost', true);
    return;
  }
  // Start first: device labels/ids are only available after permission is granted
  await startCamera(loadSetting('cameraId', null));
  await refreshCameraList();

  // React to cameras being plugged in or out
  navigator.mediaDevices.addEventListener('devicechange', () => {
    console.log('Media devices changed');
    scheduleCameraRecovery(800);
  });
}

cameraList.addEventListener('change', async () => {
  const deviceId = cameraList.value;
  if (deviceId) {
    saveSetting('cameraId', deviceId);
    await startCamera(deviceId);
  }
});

refreshCamerasBtn.addEventListener('click', async () => {
  showStatus('Refreshing cameras...');
  await ensureCamera();
});

// ===========================================================================
// Filters
// ===========================================================================
const FILTERS = ['none', 'vintage', 'polaroid', 'noir'];
const FILTER_NAMES = { none: 'Normal', vintage: 'Vintage', polaroid: 'Polaroid', noir: 'Noir' };
const filterPresets = {
  none: 'none',
  vintage: 'sepia(0.8) saturate(1.2) brightness(0.9) contrast(1.1)',
  polaroid: 'brightness(1.2) contrast(0.95) sepia(0.3) saturate(0.9) hue-rotate(-3deg)',
  noir: 'grayscale(1) contrast(1.3) brightness(1.1)'
};
let currentFilter = 'none';

function applyFilter(filterName) {
  currentFilter = filterName;
  preview.style.filter = filterPresets[filterName];
  filterButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterName);
  });
}

function cycleFilter(step) {
  const index = FILTERS.indexOf(currentFilter);
  applyFilter(FILTERS[(index + step + FILTERS.length) % FILTERS.length]);
  playBeep(600, 0.03);
}

filterButtons.forEach(btn => {
  btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
});

// ===========================================================================
// Capture
// ===========================================================================
let isCapturing = false;

// Saved photos are mirrored like the preview (what guests saw is what they get).
// Set to false to save the true, un-mirrored camera image instead.
const MIRROR_PHOTOS = true;

// Grab the current frame with the active filter. Returns a new canvas.
function captureFrame() {
  const width = preview.videoWidth;
  const height = preview.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.filter = filterPresets[currentFilter];
  if (MIRROR_PHOTOS) {
    // The preview's mirroring is only CSS; drawImage gets the raw frame
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(preview, 0, 0, width, height);
  return canvas;
}

// Draw `source` into the target rect, cropping it centered to fill the rect
function drawCover(ctx, source, dx, dy, dw, dh) {
  const scale = Math.max(dw / source.width, dh / source.height);
  const sw = dw / scale;
  const sh = dh / scale;
  ctx.drawImage(source, (source.width - sw) / 2, (source.height - sh) / 2, sw, sh, dx, dy, dw, dh);
}

async function savePhoto(base64Image, prefix) {
  try {
    const response = await fetch('/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image, prefix })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    return result.filename;
  } catch (err) {
    console.error('Save error:', err);
    showStatus(`Could not save photo: ${err.message}`, true);
    return null;
  }
}

function setCapturing(active) {
  isCapturing = active;
  document.body.classList.toggle('capturing', active);
  capture1Btn.disabled = active;
  capture3Btn.disabled = active;
  openGalleryBtn.disabled = active;
}

function cameraReady() {
  if (preview.videoWidth > 0 && streamIsLive()) return true;
  showStatus('Camera not ready yet', true);
  return false;
}

async function takeSinglePhoto() {
  if (isCapturing || !cameraReady()) return;
  setCapturing(true);
  try {
    await showCountdown();
    await triggerFlash();
    const shot = captureFrame();
    const saved = await savePhoto(shot.toDataURL('image/jpeg', 0.92), 'single');
    if (saved) {
      showStatus('Photo saved!');
      await loadRecentPhotos();
    }
  } finally {
    setCapturing(false);
  }
}

async function takeSeries() {
  if (isCapturing || !cameraReady()) return;
  setCapturing(true);
  try {
    const timestamp = Date.now();
    const shots = [];

    await showCountdown();
    for (let i = 0; i < SERIES_COUNT; i++) {
      await triggerFlash();
      const shot = captureFrame();
      shots.push(shot);
      await savePhoto(shot.toDataURL('image/jpeg', 0.92), `series-${timestamp}-${i + 1}`);
      if (i < SERIES_COUNT - 1) {
        showStatus(`${i + 1} of ${SERIES_COUNT} - next one coming!`);
        await wait(1200);
      }
    }

    // Stack the shots vertically. They already have the same orientation as
    // single photos, so they are drawn as-is (no second flip).
    const width = shots[0].width;
    const slotHeight = Math.round(width * SERIES_ASPECT / SERIES_COUNT);
    const merged = document.createElement('canvas');
    merged.width = width;
    merged.height = slotHeight * SERIES_COUNT;
    const mCtx = merged.getContext('2d');
    shots.forEach((shot, i) => drawCover(mCtx, shot, 0, i * slotHeight, width, slotHeight));

    const saved = await savePhoto(merged.toDataURL('image/jpeg', 0.92), `series-${timestamp}-collage`);
    if (saved) {
      showStatus('Series saved!');
      await loadRecentPhotos();
    }
  } finally {
    setCapturing(false);
  }
}

capture1Btn.addEventListener('click', () => runAction('capture'));
capture3Btn.addEventListener('click', () => runAction('series'));
openGalleryBtn.addEventListener('click', () => runAction('gallery'));

// ===========================================================================
// Photos: recent strip + gallery mode
// ===========================================================================
let galleryPhotos = [];
let gallerySelected = 0;
let isGalleryMode = false;

async function fetchPhotos() {
  try {
    const response = await fetch('/photos');
    const photos = await response.json();
    return photos.sort().reverse(); // newest first (file names contain timestamps)
  } catch (err) {
    console.error('Failed to load photos:', err);
    return [];
  }
}

async function loadRecentPhotos() {
  const photos = (await fetchPhotos()).slice(0, RECENT_COUNT);
  recentPhotosEl.innerHTML = '';
  if (photos.length === 0) {
    recentPhotosEl.innerHTML = '<p class="empty">No photos yet.<br>Take some!</p>';
    return;
  }
  photos.forEach(photo => {
    const img = document.createElement('img');
    img.src = `/${photo}`;
    img.alt = photo;
    img.title = 'Print this photo';
    img.addEventListener('click', () => openPrintPreview(photo));
    recentPhotosEl.appendChild(img);
  });
}

async function openGallery() {
  isGalleryMode = true;
  galleryView.hidden = false;
  document.body.classList.add('gallery-open');
  galleryPhotos = await fetchPhotos();
  galleryCount.textContent = `(${galleryPhotos.length})`;
  galleryGrid.innerHTML = '';

  if (galleryPhotos.length === 0) {
    galleryGrid.innerHTML = '<p class="empty">No photos yet. Take some!</p>';
  }
  galleryPhotos.forEach((photo, index) => {
    const img = document.createElement('img');
    img.src = `/${photo}`;
    img.alt = photo;
    img.loading = 'lazy';
    img.addEventListener('click', () => {
      selectGalleryPhoto(index);
      openPrintPreview(photo);
    });
    galleryGrid.appendChild(img);
  });
  selectGalleryPhoto(0);
  renderHints();
}

function closeGallery() {
  isGalleryMode = false;
  galleryView.hidden = true;
  document.body.classList.remove('gallery-open');
  galleryGrid.innerHTML = '';
  renderHints();
}

function selectGalleryPhoto(index) {
  if (galleryPhotos.length === 0) return;
  gallerySelected = Math.max(0, Math.min(index, galleryPhotos.length - 1));
  const images = galleryGrid.querySelectorAll('img');
  images.forEach((img, i) => img.classList.toggle('selected', i === gallerySelected));
  // Only the gallery grid scrolls; the page itself never moves
  images[gallerySelected].scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// Number of columns as actually laid out (counts images in the first row)
function galleryColumns() {
  const images = galleryGrid.querySelectorAll('img');
  if (images.length === 0) return 1;
  const firstTop = images[0].offsetTop;
  let columns = 0;
  for (const img of images) {
    if (img.offsetTop !== firstTop) break;
    columns++;
  }
  return Math.max(columns, 1);
}

function moveGallerySelection(direction) {
  if (galleryPhotos.length === 0) return;
  const columns = galleryColumns();
  const count = galleryPhotos.length;
  let index = gallerySelected;
  if (direction === 'left') index = (index - 1 + count) % count;
  if (direction === 'right') index = (index + 1) % count;
  if (direction === 'up' && index - columns >= 0) index -= columns;
  if (direction === 'down' && index + columns < count) index += columns;
  if (index !== gallerySelected) {
    selectGalleryPhoto(index);
    playBeep(500, 0.03);
  }
}

function openPrintPreview(photo) {
  PhotoPrint.openPreview(`/${photo}`, { filename: photo });
  playBeep(1000, 0.05);
}

// ===========================================================================
// Settings modal
// ===========================================================================
function isSettingsOpen() {
  return settingsModal.classList.contains('active');
}

function openSettings() {
  settingsModal.classList.add('active');
  printMethodSelect.value = PhotoPrint.getMethod();
  renderBindingsTable();
  refreshPrinterInfo();
  ensureCamera();
}

function closeSettings() {
  stopListening();
  settingsModal.classList.remove('active');
  renderHints();
}

async function refreshPrinterInfo() {
  if (PhotoPrint.getMethod() === 'browser') {
    printerInfo.textContent = 'Uses the browser default printer. Start Chrome with --kiosk --kiosk-printing to skip the print dialog.';
    return;
  }
  printerInfo.textContent = 'Checking printer...';
  try {
    const info = await (await fetch('/print/status')).json();
    printerInfo.textContent = info.available
      ? `Printer: ${info.printer || 'none set - run: lpadmin -d <printer>'}${info.media ? ` (media ${info.media})` : ''}`
      : 'CUPS not found on this laptop - will fall back to browser printing.';
  } catch (err) {
    printerInfo.textContent = 'Could not reach the server.';
  }
}

settingsBtn.addEventListener('click', () => runAction('settings'));
closeSettingsBtn.addEventListener('click', closeSettings);
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettings();
});
printMethodSelect.addEventListener('change', () => {
  PhotoPrint.setMethod(printMethodSelect.value);
  refreshPrinterInfo();
});

// ===========================================================================
// Input: actions and bindings
// ===========================================================================
// Every input (keyboard, arcade buttons, on-screen buttons) is turned into one
// of these actions. What an action does depends on the current screen.
const ACTIONS = [
  { id: 'capture', label: 'Single photo / select' },
  { id: 'series', label: 'Photo series' },
  { id: 'gallery', label: 'Gallery on / off' },
  { id: 'print', label: 'Print' },
  { id: 'download', label: 'Download (print preview)' },
  { id: 'nextFilter', label: 'Next filter' },
  { id: 'back', label: 'Back / cancel' },
  { id: 'settings', label: 'Settings' },
  { id: 'up', label: 'Up' },
  { id: 'down', label: 'Down' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' }
];

// keys: KeyboardEvent.code values (independent of keyboard layout)
// buttons: Gamepad API button numbers (see /controller-test)
const DEFAULT_BINDINGS = {
  capture: { keys: ['Space', 'Digit1', 'Numpad1'], buttons: [0] },
  series: { keys: ['KeyB', 'Digit2', 'Numpad2'], buttons: [1] },
  gallery: { keys: ['KeyX', 'KeyG', 'Digit3', 'Numpad3'], buttons: [2] },
  print: { keys: ['KeyP', 'Enter', 'NumpadEnter', 'Digit4', 'Numpad4'], buttons: [4] },
  download: { keys: ['KeyD'], buttons: [] },
  nextFilter: { keys: ['KeyF'], buttons: [3] },
  back: { keys: ['Escape', 'Backspace'], buttons: [8] },
  settings: { keys: ['KeyS'], buttons: [9] },
  up: { keys: ['ArrowUp'], buttons: [12] },
  down: { keys: ['ArrowDown'], buttons: [13] },
  left: { keys: ['ArrowLeft'], buttons: [14] },
  right: { keys: ['ArrowRight'], buttons: [15] }
};

const DIRECTIONS = ['up', 'down', 'left', 'right'];

function cloneBindings(source) {
  return JSON.parse(JSON.stringify(source));
}

function loadBindings() {
  const saved = loadSetting('bindings', null);
  const bindings = cloneBindings(DEFAULT_BINDINGS);
  if (saved && typeof saved === 'object') {
    for (const id of Object.keys(bindings)) {
      if (saved[id] && Array.isArray(saved[id].keys) && Array.isArray(saved[id].buttons)) {
        bindings[id] = { keys: saved[id].keys, buttons: saved[id].buttons };
      }
    }
  }
  return bindings;
}

let bindings = loadBindings();

function actionForKey(code) {
  return ACTIONS.find(a => bindings[a.id].keys.includes(code))?.id || null;
}

function actionForButton(index) {
  return ACTIONS.find(a => bindings[a.id].buttons.includes(index))?.id || null;
}

const KEY_NAMES = {
  Space: 'Space', Enter: 'Enter', NumpadEnter: 'Num Enter', Escape: 'Esc', Backspace: 'Backspace',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→'
};

function keyName(code) {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

function buttonName(index) {
  return `Btn ${index}`;
}

// Short label for hints: first key and first controller button
function bindingLabel(id) {
  const parts = [];
  const b = bindings[id];
  if (b.keys.length) parts.push(keyName(b.keys[0]));
  if (b.buttons.length) parts.push(buttonName(b.buttons[0]));
  return parts.join(' / ');
}

function hint(label, text) {
  return `<span class="hint"><kbd>${label}</kbd>${text}</span>`;
}

function renderHints() {
  hintBar.innerHTML = [
    hint(bindingLabel('capture'), 'Photo'),
    hint(bindingLabel('series'), 'Series'),
    hint(`${keyName(bindings.left.keys[0] || 'ArrowLeft')} ${keyName(bindings.right.keys[0] || 'ArrowRight')} / Stick`, 'Filter'),
    hint(bindingLabel('gallery'), 'Gallery & print'),
    hint(bindingLabel('settings'), 'Settings')
  ].join('');

  galleryHintBar.innerHTML = [
    hint('Arrows / Stick', 'Choose'),
    hint(bindingLabel('print'), 'Print'),
    hint(bindingLabel('back'), 'Back to camera')
  ].join('');

  PhotoPrint.setBindingLabels({
    print: bindingLabel('capture'),
    download: bindingLabel('series'),
    back: bindingLabel('back')
  });
}

// ---- Rebinding in the settings modal ----
let listeningFor = null; // action id waiting for a key / button

function renderBindingsTable() {
  bindingsTable.innerHTML = '';
  ACTIONS.forEach(action => {
    const row = document.createElement('div');
    row.className = 'binding-row';

    const name = document.createElement('span');
    name.className = 'binding-name';
    name.textContent = action.label;
    row.appendChild(name);

    const chips = document.createElement('span');
    chips.className = 'binding-chips';
    bindings[action.id].keys.forEach(code => {
      chips.appendChild(bindingChip(keyName(code), () => removeBinding(action.id, 'keys', code)));
    });
    bindings[action.id].buttons.forEach(index => {
      chips.appendChild(bindingChip(buttonName(index), () => removeBinding(action.id, 'buttons', index), true));
    });

    const add = document.createElement('button');
    add.className = 'binding-add';
    add.textContent = listeningFor === action.id ? 'Press a key or button… (Esc cancels)' : '+';
    add.classList.toggle('listening', listeningFor === action.id);
    add.addEventListener('click', () => {
      listeningFor = listeningFor === action.id ? null : action.id;
      renderBindingsTable();
    });
    chips.appendChild(add);

    row.appendChild(chips);
    bindingsTable.appendChild(row);
  });
}

function bindingChip(text, onRemove, isButton = false) {
  const chip = document.createElement('button');
  chip.className = `binding-chip${isButton ? ' is-button' : ''}`;
  chip.textContent = text;
  chip.title = 'Click to remove';
  chip.addEventListener('click', onRemove);
  return chip;
}

function removeBinding(actionId, type, value) {
  bindings[actionId][type] = bindings[actionId][type].filter(v => v !== value);
  saveSetting('bindings', bindings);
  renderBindingsTable();
  renderHints();
}

// Assign a key / button to the action we are listening for. A key or button
// can only do one thing, so it is removed from any other action.
function addBinding(type, value) {
  const actionId = listeningFor;
  listeningFor = null;
  for (const id of Object.keys(bindings)) {
    bindings[id][type] = bindings[id][type].filter(v => v !== value);
  }
  bindings[actionId][type].push(value);
  saveSetting('bindings', bindings);
  renderBindingsTable();
  renderHints();
}

function stopListening() {
  if (listeningFor) {
    listeningFor = null;
    renderBindingsTable();
  }
}

resetBindingsBtn.addEventListener('click', () => {
  bindings = cloneBindings(DEFAULT_BINDINGS);
  saveSetting('bindings', bindings);
  listeningFor = null;
  renderBindingsTable();
  renderHints();
});

// ---- Action dispatcher ----
// `repeat` is true for auto-repeat of a held direction.
function runAction(id, repeat = false) {
  // 1. Print preview on top of everything
  if (PhotoPrint.isOpen()) {
    if (repeat) return;
    if (id === 'capture' || id === 'print') PhotoPrint.action('print');
    else if (id === 'series' || id === 'download') PhotoPrint.action('download');
    else if (id === 'back' || id === 'gallery') PhotoPrint.action('close');
    return;
  }

  // 2. Settings
  if (isSettingsOpen()) {
    if (!repeat && (id === 'back' || id === 'settings')) closeSettings();
    return;
  }

  // 3. Nothing interrupts a running countdown / capture
  if (isCapturing) return;

  // 4. Gallery
  if (isGalleryMode) {
    if (DIRECTIONS.includes(id)) {
      moveGallerySelection(id);
    } else if (repeat) {
      return;
    } else if (id === 'capture' || id === 'print') {
      if (galleryPhotos[gallerySelected]) openPrintPreview(galleryPhotos[gallerySelected]);
    } else if (id === 'gallery' || id === 'back') {
      closeGallery();
      playBeep(800, 0.05);
    } else if (id === 'settings') {
      openSettings();
    }
    return;
  }

  // 5. Camera screen
  if (repeat) return;
  switch (id) {
    case 'capture': takeSinglePhoto(); break;
    case 'series': takeSeries(); break;
    case 'gallery':
    case 'print':
      openGallery();
      playBeep(800, 0.05);
      break;
    case 'nextFilter':
    case 'right':
    case 'up':
      cycleFilter(1);
      break;
    case 'left':
    case 'down':
      cycleFilter(-1);
      break;
    case 'settings':
      openSettings();
      playBeep(700, 0.05);
      break;
  }
}

// ---- Keyboard ----
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (listeningFor) {
      e.preventDefault();
      if (e.code === 'Escape') stopListening();
      else addBinding('keys', e.code);
      return;
    }

    // Let dropdowns in the settings work normally
    const tag = e.target.tagName;
    if ((tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') && e.code !== 'Escape') {
      return;
    }

    const id = actionForKey(e.code);
    if (!id) return;
    // preventDefault also stops Space/Enter from "clicking" a focused button,
    // which used to trigger actions twice
    e.preventDefault();
    if (e.repeat && !DIRECTIONS.includes(id)) return;
    runAction(id, e.repeat);
  });
}

// ---- Gamepad / arcade controller ----
const AXIS_ON = 0.5;   // stick counts as pushed above this
const AXIS_OFF = 0.3;  // ... and as released below this (hysteresis against jitter)
const REPEAT_DELAY = 450;
const REPEAT_INTERVAL = 160;

const gamepadState = {
  index: null,
  prevButtons: [],
  stick: { up: false, down: false, left: false, right: false },
  held: {} // direction -> next auto-repeat time
};

// Prefer the DragonRise arcade encoder, otherwise take any connected gamepad
function pickGamepad() {
  const pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean);
  return pads.find(p => /dragonrise/i.test(p.id)) || pads[0] || null;
}

function updateGamepadIndicator(pad) {
  const connected = !!pad;
  if (gamepadStatusEl.classList.contains('connected') === connected) return;
  gamepadStatusEl.classList.toggle('connected', connected);
  gamepadStatusEl.title = connected
    ? `Controller ready: ${pad.id}`
    : 'No controller detected - press any controller button';
  if (connected) {
    console.log('Gamepad connected:', pad.id);
    showStatus('Controller connected');
  }
}

function onGamepadButton(index) {
  if (listeningFor) {
    addBinding('buttons', index);
    return;
  }
  const id = actionForButton(index);
  if (id) {
    runAction(id);
  } else {
    console.log(`Unbound gamepad button: ${index}`);
  }
}

function updateStickDirection(direction, value) {
  const was = gamepadState.stick[direction];
  const now = was ? value > AXIS_OFF : value > AXIS_ON;
  gamepadState.stick[direction] = now;
  return now;
}

function pollGamepad(time) {
  const pad = pickGamepad();
  updateGamepadIndicator(pad);

  if (pad) {
    const pressed = pad.buttons.map(b => b.pressed || b.value > 0.5);
    if (pad.index !== gamepadState.index) {
      // New controller: ignore buttons that are already held down
      gamepadState.index = pad.index;
      gamepadState.prevButtons = pressed;
    }

    // Edge detection: act on press, never on hold. The previous state is
    // never reset elsewhere, so opening/closing a dialog cannot make a
    // still-held button fire a second time.
    pressed.forEach((isDown, i) => {
      if (isDown && !gamepadState.prevButtons[i]) onGamepadButton(i);
    });
    gamepadState.prevButtons = pressed;

    // Joystick (axes 0/1) acts like the direction keys, with auto-repeat
    const x = pad.axes[0] || 0;
    const y = pad.axes[1] || 0;
    const active = {
      left: updateStickDirection('left', -x),
      right: updateStickDirection('right', x),
      up: updateStickDirection('up', -y),
      down: updateStickDirection('down', y)
    };
    for (const direction of DIRECTIONS) {
      if (!active[direction]) {
        delete gamepadState.held[direction];
      } else if (!(direction in gamepadState.held)) {
        gamepadState.held[direction] = time + REPEAT_DELAY;
        if (listeningFor) continue; // the stick is not rebindable
        runAction(direction);
      } else if (time >= gamepadState.held[direction]) {
        gamepadState.held[direction] = time + REPEAT_INTERVAL;
        if (!listeningFor) runAction(direction, true);
      }
    }
  } else {
    gamepadState.index = null;
  }

  requestAnimationFrame(pollGamepad);
}

function setupGamepad() {
  window.addEventListener('gamepadconnected', (e) => console.log('gamepadconnected:', e.gamepad.id));
  window.addEventListener('gamepaddisconnected', (e) => {
    console.log('gamepaddisconnected:', e.gamepad.id);
    showStatus('Controller disconnected', true);
  });
  requestAnimationFrame(pollGamepad);
}

// ===========================================================================
// Kiosk niceties
// ===========================================================================
// Hide the mouse cursor when it is not being used
let cursorTimer = null;
document.addEventListener('mousemove', () => {
  document.body.classList.remove('hide-cursor');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 3000);
});

// Don't keep focus on clicked buttons; Space/Enter belong to the bindings
document.addEventListener('click', (e) => {
  const button = e.target.closest('button');
  if (button && !settingsModal.contains(button)) button.blur();
});

// ===========================================================================
// Init
// ===========================================================================
async function init() {
  renderHints();
  setupKeyboard();
  setupGamepad();
  await Promise.all([initCamera(), loadRecentPhotos()]);
}

document.addEventListener('DOMContentLoaded', init);
