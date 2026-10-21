const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const app = express();
const port = Number(process.env.PORT) || 3000;

// Printing via CUPS (`lp`). All optional:
//   PRINTER_NAME   CUPS queue to use (default: system default printer)
//   PRINT_MEDIA    media name, e.g. "jpn_hagaki_100x148mm" or "Postcard" (default: queue default)
//   PRINT_OPTIONS  extra space-separated `-o` options, e.g. "print-quality=5"
const PRINTER_NAME = process.env.PRINTER_NAME || '';
const PRINT_MEDIA = process.env.PRINT_MEDIA || '';
const PRINT_OPTIONS = (process.env.PRINT_OPTIONS || '').split(/\s+/).filter(Boolean);

const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const DATA_URL_PATTERN = /^data:image\/(jpeg|png);base64,/;

// Ensure photos directory exists
const photosDir = path.join(__dirname, 'photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir);
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(photosDir));
app.use(express.json({ limit: '20mb' }));

function isPhoto(filename) {
  return PHOTO_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

function decodeImage(image) {
  if (typeof image !== 'string' || !DATA_URL_PATTERN.test(image)) {
    return null;
  }
  return Buffer.from(image.replace(DATA_URL_PATTERN, ''), 'base64');
}

// Serve gallery page
app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
});

// Serve slideshow page
app.get('/slideshow', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'slideshow.html'));
});

// Serve controller test page
app.get('/controller-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'controller-test.html'));
});

// Random photo endpoint - serves a random photo as raw image
app.get('/random', (req, res) => {
  fs.readdir(photosDir, (err, files) => {
    if (err) {
      return res.status(404).send('No photos found');
    }

    const photos = files.filter(isPhoto);
    if (photos.length === 0) {
      return res.status(404).send('No photos found');
    }

    const randomPhoto = photos[Math.floor(Math.random() * photos.length)];
    res.sendFile(path.join(photosDir, randomPhoto));
  });
});

// Save photo endpoint
app.post('/save', (req, res) => {
  const { image, prefix } = req.body || {};
  const buffer = decodeImage(image);
  if (!buffer) {
    return res.status(400).json({ error: 'Expected a JPEG or PNG data URL in "image"' });
  }

  // Only allow simple file name characters so the prefix can't escape photosDir
  const safePrefix = String(prefix || 'photo').replace(/[^a-zA-Z0-9_-]/g, '') || 'photo';
  const filename = `${safePrefix}-${Date.now()}.jpg`;
  const filePath = path.join(photosDir, filename);

  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to save photo' });
    }
    res.json({
      success: true,
      filename,
      url: `/${filename}`
    });
  });
});

// List photos endpoint
app.get('/photos', (req, res) => {
  fs.readdir(photosDir, (err, files) => {
    if (err) {
      return res.json([]);
    }
    res.json(files.filter(isPhoto).sort().reverse());
  });
});

// Print endpoint - sends a print-ready image (already cropped to the paper's
// aspect ratio by the browser) to CUPS. No browser print dialog involved.
app.post('/print', (req, res) => {
  const buffer = decodeImage((req.body || {}).image);
  if (!buffer) {
    return res.status(400).json({ error: 'Expected a JPEG or PNG data URL in "image"' });
  }

  const tmpFile = path.join(os.tmpdir(), `photobooth-print-${Date.now()}.jpg`);
  fs.writeFile(tmpFile, buffer, (writeErr) => {
    if (writeErr) {
      return res.status(500).json({ error: 'Failed to prepare print file' });
    }

    const args = ['-t', 'Photobooth'];
    if (PRINTER_NAME) args.push('-d', PRINTER_NAME);
    if (PRINT_MEDIA) args.push('-o', `media=${PRINT_MEDIA}`);
    // The image already has the exact paper aspect ratio; "fill" makes CUPS
    // scale it edge to edge so no white border remains.
    args.push('-o', 'print-scaling=fill');
    PRINT_OPTIONS.forEach(opt => args.push('-o', opt));
    args.push(tmpFile);

    execFile('lp', args, { timeout: 15000 }, (err, stdout, stderr) => {
      fs.unlink(tmpFile, () => {});
      if (err) {
        if (err.code === 'ENOENT') {
          return res.status(501).json({ error: '`lp` not found - install CUPS (sudo apt install cups)' });
        }
        console.error('Print failed:', stderr || err.message);
        return res.status(500).json({ error: (stderr || err.message).trim() });
      }
      console.log('Print job submitted:', stdout.trim());
      res.json({ success: true, job: stdout.trim() });
    });
  });
});

// Print status endpoint - shows which printer the server would use
app.get('/print/status', (req, res) => {
  execFile('lpstat', ['-d'], { timeout: 5000 }, (err, stdout) => {
    if (err) {
      return res.json({ available: false, printer: PRINTER_NAME || null });
    }
    const defaultPrinter = (stdout.match(/destination:\s*(\S+)/) || [])[1] || null;
    res.json({
      available: true,
      printer: PRINTER_NAME || defaultPrinter,
      media: PRINT_MEDIA || null
    });
  });
});

function exitOnListenError(err) {
  console.error(`Could not start server on port ${port}: ${err.message}`);
  process.exit(1);
}

// Express 5 passes listen errors to the callback instead of throwing
const server = app.listen(port, (err) => {
  if (err) return exitOnListenError(err);
  console.log(`Photobooth running at http://localhost:${port}`);
  console.log(`Photos saved to: ${photosDir}`);
  console.log(`Printing to: ${PRINTER_NAME || 'system default printer'}${PRINT_MEDIA ? ` (media=${PRINT_MEDIA})` : ''}`);
});

server.on('error', exitOnListenError);
