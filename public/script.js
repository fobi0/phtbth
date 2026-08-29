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
const cameraSection = document.querySelector('.camera-section');
const sidebar = document.querySelector('.sidebar');

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

// Track currently selected photo index for printing
let currentSelectedPhotoIndex = -1;
let galleryPhotos = [];

// Gallery mode state
let isGalleryMode = false;

// Load and display saved photos
// In gallery mode, load ALL photos for printing
// In photobooth mode, still show only last 6 in sidebar
async function loadPhotos(loadAll = false) {
  try {
    const response = await fetch('/photos');
    let photos = await response.json();
    
    // Sort by filename (newest first, since filenames include timestamps)
    photos.sort().reverse();
    
    // In gallery mode, show ALL photos; otherwise show last 6
    if (!loadAll && !isGalleryMode) {
      photos = photos.slice(0, 6);
    }
    
    galleryPhotos = photos;
    
    photoGallery.innerHTML = '';
    if (photos.length === 0) {
      photoGallery.innerHTML = '<p style="color: #666; grid-column: 1/-1;">No photos yet. Take some!</p>';
      currentSelectedPhotoIndex = -1;
      return;
    }
    
    photos.forEach((photo, index) => {
      const img = document.createElement('img');
      img.src = `/${photo}`;
      img.alt = photo;
      img.title = photo;
      img.dataset.index = index;
      img.className = 'gallery-img';
      img.addEventListener('click', () => selectPhoto(index));
      photoGallery.appendChild(img);
    });
    
    // Select the first photo by default
    if (photos.length > 0) {
      selectPhoto(0);
    }
  } catch (err) {
    console.error('Failed to load photos:', err);
  }
}

// Select a photo in the gallery
function selectPhoto(index) {
  currentSelectedPhotoIndex = index;
  
  // Update UI to show selection
  const images = photoGallery.querySelectorAll('.gallery-img');
  images.forEach((img, i) => {
    img.classList.toggle('selected', i === index);
  });
  
  // Scroll the selected image into view
  const selectedImg = photoGallery.querySelector(`[data-index="${index}"]`);
  if (selectedImg) {
    selectedImg.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
  
  showStatus(`Selected photo ${index + 1} of ${galleryPhotos.length}`);
  return index;
}

// Print preview modal state
let printPreviewModal = null;
let printPreviewImg = null;

// Create print preview modal
function createPrintPreviewModal() {
  if (printPreviewModal) return;
  
  printPreviewModal = document.createElement('div');
  printPreviewModal.id = 'printPreviewModal';
  printPreviewModal.className = 'modal print-preview-modal';
  printPreviewModal.innerHTML = `
    <div class="modal-content print-preview-content">
      <h2>Print Preview</h2>
      <div class="print-preview-image-container">
        <img id="printPreviewImg" src="" alt="Print Preview" />
      </div>
      <div class="print-preview-controls">
        <button id="printConfirmBtn" class="btn-print">Print Photo</button>
        <button id="downloadBtn" class="btn-download">Download Photo</button>
      </div>
      <p class="print-hint">Note: Print requires browser confirmation. Use Download for direct save.</p>
    </div>
  `;
  document.body.appendChild(printPreviewModal);
  
  printPreviewImg = document.getElementById('printPreviewImg');
  const printConfirmBtn = document.getElementById('printConfirmBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  
  printConfirmBtn.addEventListener('click', () => {
    window.print();
    closePrintPreview();
  });
  
  downloadBtn.addEventListener('click', downloadSelectedPhoto);
}

// Download the selected photo directly
function downloadSelectedPhoto() {
  if (currentSelectedPhotoIndex < 0 || currentSelectedPhotoIndex >= galleryPhotos.length) {
    showStatus('No photo selected', true);
    playBeep(400, 0.1);
    return;
  }
  
  const photoName = galleryPhotos[currentSelectedPhotoIndex];
  
  // Create a temporary anchor to trigger download
  const link = document.createElement('a');
  link.href = `/${photoName}`;
  link.download = photoName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  closePrintPreview();
  showStatus(`Downloaded: ${photoName}`);
  playBeep(1200, 0.05);
}

// Close print preview modal
function closePrintPreview() {
  if (printPreviewModal) {
    printPreviewModal.classList.remove('active');
  }
  // Reset button state
  buttonWasPressed = {};
}

// Show print preview for selected photo
function showPrintPreview() {
  if (currentSelectedPhotoIndex < 0 || currentSelectedPhotoIndex >= galleryPhotos.length) {
    showStatus('No photo selected', true);
    playBeep(400, 0.1);
    return;
  }
  
  const photoName = galleryPhotos[currentSelectedPhotoIndex];
  
  // Create modal if it doesn't exist
  createPrintPreviewModal();
  
  // Set the image source
  printPreviewImg.src = `/${photoName}`;
  printPreviewImg.alt = photoName;
  
  // Show the modal
  printPreviewModal.classList.add('active');
  
  // Reset button state tracking for clean input
  buttonWasPressed = {};
  
  // Focus the print button for controller navigation
  setTimeout(() => {
    const printBtn = document.getElementById('printConfirmBtn');
    if (printBtn) printBtn.focus();
  }, 100);
  
  showStatus('Press Print or Download');
  playBeep(1000, 0.05);
}

// Print the currently selected photo (legacy function, now shows preview)
function printSelectedPhoto() {
  showPrintPreview();
}

// Toggle between photobooth mode and gallery mode
async function toggleGalleryMode() {
  isGalleryMode = !isGalleryMode;
  
  if (isGalleryMode) {
    // Switch to gallery mode
    cameraSection.style.display = 'none';
    sidebar.classList.add('fullscreen');
    sidebar.style.display = 'block';
    showStatus('Gallery mode - Loading all photos...');
    
    // Reload photos to show ALL images in gallery mode
    await loadPhotos(true);
    
    if (galleryPhotos.length > 0) {
      showStatus(`Gallery mode - Use joystick to navigate ${galleryPhotos.length} photos`);
      selectPhoto(0);
    } else {
      showStatus('Gallery mode - No photos yet. Take some!');
    }
  } else {
    // Switch back to photobooth mode
    cameraSection.style.display = 'block';
    sidebar.classList.remove('fullscreen');
    sidebar.style.display = '';
    showStatus('Photobooth mode - Use joystick to change filters');
    
    // Reload photos to show only last 6 in sidebar
    await loadPhotos(false);
  }
  
  playBeep(800, 0.05);
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

// Gamepad support for arcade controller
let currentGamepad = null;
let gamepadButtons = {};
let gamepadAxes = {};

// Gamepad button mapping for photobooth
const GAMEPAD_MAPPING = {
  SINGLE_PHOTO: 0,    // Typically button 0 (A/South)
  BURST_PHOTO: 1,    // Typically button 1 (B/East)
  TOGGLE_MODE: 2,    // Typically button 2 (X/West) - Toggle gallery/photobooth
  FILTER_NEXT: 2,    // Typically button 2 (X/West) - fallback
  FILTER_PREV: 3,    // Typically button 3 (Y/North)
  PRINT: 4,          // Typically button 4 (L1/Left Trigger)
  SETTINGS: 9,       // Typically button 9 (Start)
  BACK: 8           // Typically button 8 (Select/Back)
};

// Configurable button mapping (can be customized)
let gamepadConfig = {
  singlePhoto: GAMEPAD_MAPPING.SINGLE_PHOTO,
  burstPhoto: GAMEPAD_MAPPING.BURST_PHOTO,
  toggleMode: GAMEPAD_MAPPING.TOGGLE_MODE,
  filterNext: GAMEPAD_MAPPING.FILTER_NEXT,
  filterPrev: GAMEPAD_MAPPING.FILTER_PREV,
  print: GAMEPAD_MAPPING.PRINT,
  settings: GAMEPAD_MAPPING.SETTINGS,
  back: GAMEPAD_MAPPING.BACK
};

// Button state tracking to handle press/release
let buttonWasPressed = {};

// Setup gamepad support
function setupGamepad() {
  // Listen for gamepad connection events
  window.addEventListener('gamepadconnected', (e) => {
    console.log('Gamepad connected:', e.gamepad.id);
    currentGamepad = e.gamepad;
    showStatus(`Controller connected: ${e.gamepad.id}`);
    updateGamepadIndicator(true);
  });

  window.addEventListener('gamepaddisconnected', (e) => {
    console.log('Gamepad disconnected:', e.gamepad.id);
    currentGamepad = null;
    showStatus('Controller disconnected', true);
    buttonWasPressed = {};
    updateGamepadIndicator(false);
  });

  // Main game loop for polling gamepad state
  function gamepadLoop() {
    const gamepads = navigator.getGamepads();
    
    // Find our gamepad (prefer DragonRise or any connected one)
    for (const gp of gamepads) {
      if (gp && (gp.id.includes('DragonRise') || gp.mapping === 'standard' || gamepadButtons[gp.index])) {
        currentGamepad = gp;
        gamepadButtons[gp.index] = true;
        break;
      }
    }

    // Process gamepad input if connected
    if (currentGamepad) {
      processGamepadInput(currentGamepad);
    }

    requestAnimationFrame(gamepadLoop);
  }

  // Start the gamepad polling loop
  gamepadLoop();
}

// Process gamepad input
function processGamepadInput(gamepad) {
  // Process buttons
  for (let i = 0; i < gamepad.buttons.length; i++) {
    const button = gamepad.buttons[i];
    const isPressed = button.pressed || button.value > 0.5;
    
    // Check if button state changed from not pressed to pressed
    if (isPressed && !buttonWasPressed[i]) {
      handleGamepadButtonDown(i);
    }
    
    buttonWasPressed[i] = isPressed;
  }

  // Process axes (for D-pad or joystick navigation)
  for (let i = 0; i < gamepad.axes.length; i++) {
    gamepadAxes[i] = gamepad.axes[i];
    handleGamepadAxis(i, gamepad.axes[i]);
  }
}

// Handle gamepad button press
function handleGamepadButtonDown(buttonIndex) {
  console.log(`Gamepad button ${buttonIndex} pressed`);
  
  // If print preview is open, handle print/download/close
  if (printPreviewModal && printPreviewModal.classList.contains('active')) {
    if (buttonIndex === gamepadConfig.singlePhoto) {
      // Button 0 (A) = Print (requires browser confirmation)
      const printBtn = document.getElementById('printConfirmBtn');
      if (printBtn) printBtn.click();
      playBeep(1200, 0.05);
    } else if (buttonIndex === gamepadConfig.burstPhoto) {
      // Button 1 (B) = Download (direct, no confirmation)
      const downloadBtn = document.getElementById('downloadBtn');
      if (downloadBtn) downloadBtn.click();
      playBeep(1000, 0.05);
    } else if (buttonIndex === gamepadConfig.back) {
      // Button 8 (Back/Select) = Close preview
      closePrintPreview();
      playBeep(800, 0.05);
    }
    return;
  }
  
  // If in gallery mode, only allow print, back, and toggle
  if (isGalleryMode) {
    if (buttonIndex === gamepadConfig.print) {
      printSelectedPhoto();
    } else if (buttonIndex === gamepadConfig.toggleMode || buttonIndex === gamepadConfig.back) {
      toggleGalleryMode();
    }
    return;
  }
  
  // Single photo capture
  if (buttonIndex === gamepadConfig.singlePhoto) {
    if (!capture1Btn.disabled) {
      capture1Btn.click();
      playBeep(1000, 0.05);
    }
  }
  
  // Burst photo capture (3 photos)
  else if (buttonIndex === gamepadConfig.burstPhoto) {
    if (!capture3Btn.disabled) {
      capture3Btn.click();
      playBeep(800, 0.05);
    }
  }
  
  // Toggle gallery mode
  else if (buttonIndex === gamepadConfig.toggleMode) {
    toggleGalleryMode();
  }
  
  // Cycle to next filter
  else if (buttonIndex === gamepadConfig.filterNext) {
    cycleFilter('next');
    playBeep(600, 0.05);
  }
  
  // Cycle to previous filter
  else if (buttonIndex === gamepadConfig.filterPrev) {
    cycleFilter('prev');
    playBeep(600, 0.05);
  }
  
  // Print selected photo
  else if (buttonIndex === gamepadConfig.print) {
    toggleGalleryMode(); // In photobooth mode, print button also toggles to gallery
  }
  
  // Open settings
  else if (buttonIndex === gamepadConfig.settings) {
    settingsBtn.click();
    playBeep(700, 0.05);
  }
  
  // Close settings / go back
  else if (buttonIndex === gamepadConfig.back) {
    closeSettingsBtn.click();
    playBeep(500, 0.05);
  }
  
  // Log other buttons for debugging
  else {
    console.log(`Unhandled gamepad button: ${buttonIndex}`);
  }
}

// Track axis deadzone to prevent drift
const AXIS_DEADZONE = 0.3;

// Track last axis values for threshold detection
let lastAxisValues = {};

// Handle gamepad axis movement
function handleGamepadAxis(axisIndex, value) {
  // Store current value for next frame
  gamepadAxes[axisIndex] = value;
  
  // Apply deadzone to prevent drift
  if (Math.abs(value) < AXIS_DEADZONE) {
    value = 0;
  }

  const lastValue = lastAxisValues[axisIndex] || 0;

  // Mode-specific axis handling
  if (isGalleryMode) {
    // In gallery mode: 
    // Axis 0 (horizontal): navigate left/right through photos
    // Axis 1 (vertical): scroll gallery container up/down
    if (axisIndex === 0) {
      // Horizontal: next/prev photo
      if (value > 0.5 && lastValue <= 0.5) {
        navigateGallery('next');
        playBeep(500, 0.03);
      } else if (value < -0.5 && lastValue >= -0.5) {
        navigateGallery('prev');
        playBeep(500, 0.03);
      }
    }
    if (axisIndex === 1) {
      // Vertical: navigate up/down through grid
      if (value > 0.5 && lastValue <= 0.5) {
        // Down: select photo below
        navigateGallery('down');
        playBeep(500, 0.03);
      } else if (value < -0.5 && lastValue >= -0.5) {
        // Up: select photo above
        navigateGallery('up');
        playBeep(500, 0.03);
      }
    }
  } else {
    // In photobooth mode: use axes for filter navigation
    if (axisIndex === 0) {
      // Horizontal: next/prev filter
      if (value > 0.5 && lastValue <= 0.5) {
        cycleFilter('next');
        playBeep(600, 0.03);
      } else if (value < -0.5 && lastValue >= -0.5) {
        cycleFilter('prev');
        playBeep(600, 0.03);
      }
    }
    if (axisIndex === 1) {
      // Vertical: could be used for something else, or also filter nav
      if (value < -0.5 && lastValue >= -0.5) {
        cycleFilter('next');
        playBeep(600, 0.03);
      } else if (value > 0.5 && lastValue <= 0.5) {
        cycleFilter('prev');
        playBeep(600, 0.03);
      }
    }
  }
  
  // Store current value for next frame
  lastAxisValues[axisIndex] = value;
}

// Navigate through the photo gallery
function navigateGallery(direction) {
  if (galleryPhotos.length === 0) {
    showStatus('No photos in gallery', true);
    return;
  }
  
  let newIndex;
  if (direction === 'next') {
    newIndex = (currentSelectedPhotoIndex + 1) % galleryPhotos.length;
  } else if (direction === 'prev') {
    newIndex = (currentSelectedPhotoIndex - 1 + galleryPhotos.length) % galleryPhotos.length;
  } else if (direction === 'up' || direction === 'down') {
    // Calculate grid navigation
    newIndex = navigateGalleryGrid(direction);
  }
  
  if (newIndex !== undefined) {
    selectPhoto(newIndex);
  }
}

// Navigate gallery grid up/down based on current selection
function navigateGalleryGrid(direction) {
  if (galleryPhotos.length === 0) return undefined;
  
  // Get the grid container to calculate columns
  const grid = photoGallery;
  if (!grid) return undefined;
  
  // Get computed style to find number of columns
  const gridStyle = window.getComputedStyle(grid);
  const gridTemplateColumns = gridStyle.getPropertyValue('grid-template-columns');
  
  // Count the number of columns by splitting the template
  const columns = gridTemplateColumns.split(' ').filter(col => col !== '0px').length;
  
  if (columns <= 0) {
    // Fallback: if we can't determine columns, use simple next/prev
    return direction === 'down' 
      ? (currentSelectedPhotoIndex + 1) % galleryPhotos.length
      : (currentSelectedPhotoIndex - 1 + galleryPhotos.length) % galleryPhotos.length;
  }
  
  const row = Math.floor(currentSelectedPhotoIndex / columns);
  const col = currentSelectedPhotoIndex % columns;
  
  if (direction === 'down') {
    // Move to same column in next row
    const newRow = row + 1;
    const newIndex = newRow * columns + col;
    if (newIndex < galleryPhotos.length) {
      return newIndex;
    }
    // If we're at the end, wrap or stay
    return currentSelectedPhotoIndex;
  } else if (direction === 'up') {
    // Move to same column in previous row
    const newRow = row - 1;
    if (newRow >= 0) {
      const newIndex = newRow * columns + col;
      return newIndex;
    }
    // If we're at the top, stay
    return currentSelectedPhotoIndex;
  }
  
  return undefined;
}

// Cycle through filters
function cycleFilter(direction) {
  const filters = ['none', 'vintage', 'polaroid', 'noir'];
  const currentIndex = filters.indexOf(currentFilter);
  
  let newIndex;
  if (direction === 'next') {
    newIndex = (currentIndex + 1) % filters.length;
  } else {
    newIndex = (currentIndex - 1 + filters.length) % filters.length;
  }
  
  applyFilter(filters[newIndex]);
}

// Function to set custom button mapping
function setGamepadMapping(mapping) {
  gamepadConfig = { ...gamepadConfig, ...mapping };
}

// Update the gamepad indicator in the UI
function updateGamepadIndicator(connected) {
  const indicator = document.getElementById('gamepadStatus');
  if (indicator) {
    if (connected) {
      indicator.textContent = 'Controller';
      indicator.className = 'gamepad-indicator connected';
      indicator.title = 'Controller connected and ready';
    } else {
      indicator.textContent = '';
      indicator.className = 'gamepad-indicator';
      indicator.title = 'Connect a controller';
    }
  }
}

// Initialize
async function init() {
  await populateCameraList();
  await loadPhotos();
  setupKeyboardShortcuts();
  setupGamepad();
}

// Start when page loads
document.addEventListener('DOMContentLoaded', init);
