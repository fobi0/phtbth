const photosGrid = document.getElementById('photosGrid');

// Print modal elements
const modal = document.createElement('div');
modal.className = 'print-modal';
modal.innerHTML = `
  <div class="print-modal-content">
    <button class="print-modal-close" id="modalClose">&times;</button>
    <h2>Print Photo</h2>
    <img id="modalImage" src="" alt="Photo to print">
    <div class="print-modal-actions">
      <button class="btn-print" id="btnPrint">Print</button>
      <button class="btn-close" id="btnClose">Close</button>
    </div>
  </div>
`;
document.body.appendChild(modal);

const modalImage = document.getElementById('modalImage');
const modalClose = document.getElementById('modalClose');
const btnPrint = document.getElementById('btnPrint');
const btnClose = document.getElementById('btnClose');
let currentPrintImage = '';

// Close modal
function closeModal() {
  modal.classList.remove('active');
}

modalClose.addEventListener('click', closeModal);
btnClose.addEventListener('click', closeModal);

// Close on background click
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// Print functionality
btnPrint.addEventListener('click', () => {
  if (currentPrintImage) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Photo</title>
        <style>
          body { 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh; 
            margin: 0; 
            background: #f5f5f5; 
          }
          img { 
            max-width: 100%; 
            max-height: 100vh; 
            box-shadow: 0 0 20px rgba(0,0,0,0.2); 
          }
          @media print {
            body { background: white; }
            img { max-width: 100%; max-height: 100%; }
          }
        </style>
      </head>
      <body>
        <img src="${currentPrintImage}" onload="window.print();">
      </body>
      </html>
    `);
    printWindow.document.close();
  }
});

// Open modal with image
function openPrintModal(imageSrc) {
  currentPrintImage = imageSrc;
  modalImage.src = imageSrc;
  modal.classList.add('active');
}

// Load and display all photos
async function loadAllPhotos() {
  try {
    const response = await fetch('/photos');
    let photos = await response.json();
    
    // Sort newest first
    photos.sort().reverse();
    
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
