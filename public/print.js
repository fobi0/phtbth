// Shared printing for the photobooth and gallery pages.
//
// Every print goes through the same steps:
//   1. The photo is cropped to the exact paper aspect ratio (Hagaki / Postcard,
//      100 x 148 mm) at 300 dpi, so whatever prints is exactly what the
//      preview shows and the printer never has to add white edges.
//   2. The result is rotated to portrait, the way the paper sits in the printer.
//   3. It is printed either
//      - "server":  POST /print, the server hands it to CUPS (`lp`). Silent,
//                   no dialog, no browser flags needed. (default)
//      - "browser": window.print() with a single full-page image. Needs Chrome
//                   started with --kiosk-printing to skip the dialog.
(function () {
  const PAPER = { shortMm: 100, longMm: 148, dpi: 300 };
  const SHORT_PX = Math.round(PAPER.shortMm / 25.4 * PAPER.dpi); // 1181
  const LONG_PX = Math.round(PAPER.longMm / 25.4 * PAPER.dpi);   // 1748
  const METHOD_KEY = 'photobooth.printMethod';
  const PRINT_COOLDOWN_MS = 5000;

  let previewModal = null;
  let previewImg = null;
  let previewStatus = null;
  let current = null; // { src, filename, previewUrl, printUrl }
  let busy = false;
  let lastPrintAt = 0;
  let onCloseCallback = null;

  function getMethod() {
    try {
      return localStorage.getItem(METHOD_KEY) || 'server';
    } catch (e) {
      return 'server';
    }
  }

  function setMethod(method) {
    try {
      localStorage.setItem(METHOD_KEY, method);
    } catch (e) {
      // Storage unavailable - setting only lasts for this page load
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load ${src}`));
      img.src = src;
    });
  }

  // Crop the photo (centered, "cover") to the paper aspect ratio, keeping the
  // photo's own orientation. Returns the canvas.
  function cropToPaper(img) {
    const landscape = img.naturalWidth >= img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = landscape ? LONG_PX : SHORT_PX;
    canvas.height = landscape ? SHORT_PX : LONG_PX;
    const ctx = canvas.getContext('2d');

    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
    return canvas;
  }

  // Rotate a landscape canvas by 90 degrees so it matches the portrait paper.
  function toPortrait(canvas) {
    if (canvas.height >= canvas.width) return canvas;
    const rotated = document.createElement('canvas');
    rotated.width = canvas.height;
    rotated.height = canvas.width;
    const ctx = rotated.getContext('2d');
    ctx.translate(rotated.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, 0, 0);
    return rotated;
  }

  async function prepare(src) {
    const img = await loadImage(src);
    const cropped = cropToPaper(img);
    return {
      previewUrl: cropped.toDataURL('image/jpeg', 0.92),
      printUrl: toPortrait(cropped).toDataURL('image/jpeg', 0.95)
    };
  }

  async function printViaServer(printUrl) {
    const response = await fetch('/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: printUrl })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(result.error || `Print failed (HTTP ${response.status})`);
      err.status = response.status;
      throw err;
    }
    return result;
  }

  // Browser printing: a single full-page fixed image is the only thing on the
  // page, so there is nothing that can overflow onto a second page, and the
  // image stretches to whatever page size the printer driver reports.
  async function printViaBrowser(printUrl) {
    let root = document.getElementById('printRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'printRoot';
      root.innerHTML = '<img alt="">';
      document.body.appendChild(root);
    }
    const img = root.querySelector('img');
    img.src = printUrl;
    await img.decode();

    let pageStyle = document.getElementById('printPageStyle');
    if (!pageStyle) {
      pageStyle = document.createElement('style');
      pageStyle.id = 'printPageStyle';
      document.head.appendChild(pageStyle);
    }
    pageStyle.textContent = `@page { size: ${PAPER.shortMm}mm ${PAPER.longMm}mm; margin: 0; }`;

    document.body.classList.add('print-active');
    try {
      window.print(); // blocks until the dialog closes / the job is spooled
    } finally {
      document.body.classList.remove('print-active');
    }
  }

  async function print(printUrl) {
    if (getMethod() === 'browser') {
      await printViaBrowser(printUrl);
      return 'Sent to printer';
    }
    try {
      await printViaServer(printUrl);
      return 'Printing... this takes about a minute';
    } catch (err) {
      if (err.status === 501) {
        // CUPS is not installed on the server - fall back to the browser
        console.warn(err.message, '- falling back to browser printing');
        await printViaBrowser(printUrl);
        return 'Sent to printer';
      }
      throw err;
    }
  }

  // --- Preview modal ------------------------------------------------------

  function createPreviewModal() {
    if (previewModal) return;
    previewModal = document.createElement('div');
    previewModal.className = 'print-preview';
    previewModal.innerHTML = `
      <div class="print-preview-card">
        <div class="print-preview-paper"><img alt="Print preview"></div>
        <div class="print-preview-status" aria-live="polite"></div>
        <div class="print-preview-actions">
          <button type="button" class="pp-btn pp-print" data-action="print">
            <span class="pp-key" data-binding="print" hidden></span>Print
          </button>
          <button type="button" class="pp-btn pp-download" data-action="download">
            <span class="pp-key" data-binding="download" hidden></span>Download
          </button>
          <button type="button" class="pp-btn pp-cancel" data-action="close">
            <span class="pp-key" data-binding="back" hidden></span>Cancel
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(previewModal);
    previewImg = previewModal.querySelector('img');
    previewStatus = previewModal.querySelector('.print-preview-status');

    previewModal.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (button) {
        action(button.dataset.action);
      } else if (e.target === previewModal) {
        action('close');
      }
    });
  }

  function setStatus(text, kind = '') {
    if (!previewStatus) return;
    previewStatus.textContent = text;
    previewStatus.className = `print-preview-status ${kind}`;
  }

  async function openPreview(src, options = {}) {
    createPreviewModal();
    onCloseCallback = options.onClose || null;
    current = { src, filename: options.filename || src.split('/').pop() };
    previewImg.removeAttribute('src');
    setStatus('Preparing preview...');
    previewModal.classList.add('active');

    try {
      const prepared = await prepare(src);
      if (!current || current.src !== src) return; // closed or replaced meanwhile
      Object.assign(current, prepared);
      previewImg.src = prepared.previewUrl;
      setStatus('');
    } catch (err) {
      setStatus(err.message, 'error');
    }
  }

  function isOpen() {
    return !!previewModal && previewModal.classList.contains('active');
  }

  function close() {
    if (!previewModal) return;
    previewModal.classList.remove('active');
    current = null;
    if (onCloseCallback) {
      const cb = onCloseCallback;
      onCloseCallback = null;
      cb();
    }
  }

  async function doPrint() {
    if (!current || !current.printUrl || busy) return false;
    if (Date.now() - lastPrintAt < PRINT_COOLDOWN_MS) {
      setStatus('Already printing - please wait a moment', 'error');
      return false;
    }
    busy = true;
    setStatus('Sending to printer...');
    try {
      const message = await print(current.printUrl);
      lastPrintAt = Date.now();
      setStatus(message, 'ok');
      setTimeout(() => { if (isOpen()) close(); }, 1500);
      return true;
    } catch (err) {
      console.error('Print error:', err);
      setStatus(`Print failed: ${err.message}`, 'error');
      return false;
    } finally {
      busy = false;
    }
  }

  function doDownload() {
    if (!current) return false;
    const link = document.createElement('a');
    link.href = current.src;
    link.download = current.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    close();
    return true;
  }

  // Run a preview action ('print' | 'download' | 'close'); used by buttons,
  // keyboard and gamepad alike.
  function action(name) {
    if (!isOpen()) return false;
    if (name === 'print') { doPrint(); return true; }
    if (name === 'download') return doDownload();
    if (name === 'close') { if (!busy) close(); return true; }
    return false;
  }

  // Show which key / button triggers each preview action
  function setBindingLabels(labels) {
    createPreviewModal();
    previewModal.querySelectorAll('[data-binding]').forEach(el => {
      const label = labels[el.dataset.binding];
      el.textContent = label || '';
      el.hidden = !label;
    });
  }

  window.PhotoPrint = {
    getMethod,
    setMethod,
    prepare,
    print,
    openPreview,
    isOpen,
    close,
    action,
    setBindingLabels
  };
})();
