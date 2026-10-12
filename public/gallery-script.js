const photosGrid = document.getElementById('photosGrid');

// Print modal elements - use same class names as script.js for consistency
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
      <button class="print-modal-close" id="modalClose">&times;</button>
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
  const modalClose = document.getElementById('modalClose');
  
  // Close modal on X button click
  if (modalClose) {
    modalClose.addEventListener('click', closePrintPreview);
  }
  
  // Setup background click handler
  setupPrintPreviewHandlers();
  
  printConfirmBtn.addEventListener('click', () => {
    document.body.classList.add('printing');
    
    setTimeout(() => {
      window.print();
    }, 100);
    
    setTimeout(() => {
      document.body.classList.remove('printing');
      closePrintPreview();
    }, 2000);
  });
  
  // Download function for gallery
  downloadBtn.addEventListener('click', () => {
    if (!printPreviewImg || !printPreviewImg.src) return;
    const link = document.createElement('a');
    link.href = printPreviewImg.src;
    link.download = printPreviewImg.src.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    closePrintPreview();
  });
}

// Close print preview modal
function closePrintPreview() {
  if (printPreviewModal) {
    printPreviewModal.classList.remove('active');
  }
}

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePrintPreview();
  }
});

// Close on background click
function setupPrintPreviewHandlers() {
  if (printPreviewModal) {
    printPreviewModal.addEventListener('click', (e) => {
      if (e.target === printPreviewModal) {
        closePrintPreview();
      }
    });
  }
}

// Open modal with image
function openPrintModal(imageSrc) {
  createPrintPreviewModal();
  if (printPreviewImg) {
    printPreviewImg.src = imageSrc;
    printPreviewModal.classList.add('active');
  }
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
