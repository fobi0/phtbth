const slideImage = document.getElementById('slideImage');
const slideInfo = document.getElementById('slideInfo');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const loadingIndicator = document.getElementById('loadingIndicator');

let photos = [];
let currentIndex = 0;
let isPlaying = true;
let slideInterval;
const SLIDE_INTERVAL = 3000; // 3 seconds per slide
const REFRESH_INTERVAL = 5000; // 5 seconds to check for new photos

// Load photos from server
async function loadPhotos() {
  try {
    const response = await fetch('/photos');
    let newPhotos = await response.json();
    
    // Sort newest first
    newPhotos.sort().reverse();
    
    // Check if we have new photos
    const hasNewPhotos = JSON.stringify(photos) !== JSON.stringify(newPhotos);
    
    if (hasNewPhotos) {
      photos = newPhotos;
      
      if (photos.length === 0) {
        showNoPhotos();
        return;
      }
      
      // If we were on a photo that no longer exists, reset to first
      if (currentIndex >= photos.length) {
        currentIndex = 0;
      }
      
      showSlide(currentIndex);
      hideLoading();
    }
    
    return newPhotos;
  } catch (err) {
    console.error('Failed to load photos:', err);
    showNoPhotos();
    return [];
  }
}

// Show a specific slide
function showSlide(index) {
  if (photos.length === 0) {
    showNoPhotos();
    return;
  }
  
  currentIndex = index;
  slideImage.src = `/${photos[index]}`;
  slideImage.alt = photos[index];
  slideInfo.textContent = photos[index].replace('.jpg', '').replace('.jpeg', '').replace('.png', '');
}

// Show no photos message
function showNoPhotos() {
  loadingIndicator.classList.add('hidden');
  slideImage.parentElement.innerHTML = '<div class="no-photos">No photos yet. Go take some!</div>';
}

// Hide loading indicator
function hideLoading() {
  loadingIndicator.classList.add('hidden');
}

// Start slideshow
function startSlideshow() {
  if (isPlaying) {
    clearInterval(slideInterval);
    slideInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % photos.length;
      showSlide(currentIndex);
    }, SLIDE_INTERVAL);
  }
}

// Stop slideshow
function stopSlideshow() {
  clearInterval(slideInterval);
}

// Toggle play/pause
function togglePlayPause() {
  isPlaying = !isPlaying;
  playPauseBtn.classList.toggle('playing', isPlaying);
  playPauseBtn.title = isPlaying ? 'Pause' : 'Play';
  
  if (isPlaying) {
    startSlideshow();
  } else {
    stopSlideshow();
  }
}

// Auto-refresh photos
function startAutoRefresh() {
  // Load immediately
  loadPhotos().then(() => {
    // Start slideshow if there are photos
    if (photos.length > 0) {
      startSlideshow();
    }
  });
  
  // Then refresh periodically
  setInterval(loadPhotos, REFRESH_INTERVAL);
}

// Event listeners
prevBtn.addEventListener('click', () => {
  if (photos.length === 0) return;
  currentIndex = (currentIndex - 1 + photos.length) % photos.length;
  showSlide(currentIndex);
});

nextBtn.addEventListener('click', () => {
  if (photos.length === 0) return;
  currentIndex = (currentIndex + 1) % photos.length;
  showSlide(currentIndex);
});

playPauseBtn.addEventListener('click', togglePlayPause);

// Keyboard controls
document.addEventListener('keydown', (e) => {
  if (photos.length === 0) return;
  
  switch (e.key) {
    case 'ArrowLeft':
      currentIndex = (currentIndex - 1 + photos.length) % photos.length;
      showSlide(currentIndex);
      break;
    case 'ArrowRight':
      currentIndex = (currentIndex + 1) % photos.length;
      showSlide(currentIndex);
      break;
    case ' ':
      e.preventDefault();
      togglePlayPause();
      break;
    case 'Escape':
      // Could add fullscreen exit or something
      break;
  }
});

// Initialize
loadingIndicator.classList.remove('hidden');
playPauseBtn.classList.add('playing');

// Start everything
startAutoRefresh();
