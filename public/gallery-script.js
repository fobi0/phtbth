const photosGrid = document.getElementById('photosGrid');

// Printing and the print preview live in print.js (shared with the photobooth)
function openPrintModal(imageSrc) {
  PhotoPrint.openPreview(imageSrc);
}

document.addEventListener('keydown', (e) => {
  if (!PhotoPrint.isOpen()) return;
  if (e.key === 'Escape') PhotoPrint.action('close');
  if (e.key === 'Enter' || e.key === 'p') PhotoPrint.action('print');
});

let shownPhotos = '';

// Load and display all photos
async function loadAllPhotos() {
  try {
    const response = await fetch('/photos');
    let photos = await response.json();
    
    // Sort newest first
    photos.sort().reverse();

    // The page refreshes every 10s; only rebuild when something changed
    const key = photos.join('|');
    if (key === shownPhotos) return;
    shownPhotos = key;

    if (photos.length === 0) {
      photosGrid.innerHTML = '<div class="empty-message">No photos yet. Go take some fun pictures!</div>';
      return;
    }
    
    photosGrid.innerHTML = '';
    
    photos.forEach((photo, index) => {
      const card = document.createElement('div');
      card.className = 'photo-card';
      card.style.animationDelay = `${index * 0.05}s`;
      
      const img = document.createElement('img');
      img.src = `/${photo}`;
      img.alt = photo;
      img.loading = 'lazy';
      
      const overlay = document.createElement('div');
      overlay.className = 'photo-overlay';
      
      const printBtn = document.createElement('button');
      printBtn.className = 'print-btn';
      printBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9V2H4a2 2 0 0 0-2 2v11h11a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1"/>
          <path d="M9 7h1m-1 4v4m0-4h1m-6 4h4"/>
          <path d="M18 14v4m-2-2h4"/>
          <path d="M22 22l-4-4"/>
          <path d="M16 18l4 4-4 4"/>
        </svg>
      `;
      printBtn.title = 'Print this photo';
      printBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPrintModal(img.src);
      });
      
      const info = document.createElement('div');
      info.className = 'photo-info';
      info.textContent = photo.replace('.jpg', '').replace('.jpeg', '').replace('.png', '');
      
      overlay.appendChild(printBtn);
      overlay.appendChild(info);
      card.appendChild(img);
      card.appendChild(overlay);
      
      // Click on card to view larger
      card.addEventListener('click', () => {
        openPrintModal(img.src);
      });
      
      photosGrid.appendChild(card);
    });
  } catch (err) {
    photosGrid.innerHTML = '<div class="empty-message">Error loading photos. Please try again.</div>';
    console.error('Failed to load photos:', err);
  }
}

// Auto-refresh photos every 10 seconds
let refreshInterval;

function startAutoRefresh() {
  refreshInterval = setInterval(loadAllPhotos, 10000);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  loadAllPhotos();
  startAutoRefresh();
});

// Stop auto-refresh when page is hidden (e.g., tab switched)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
  }
});
