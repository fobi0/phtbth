const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Ensure photos directory exists
const photosDir = path.join(__dirname, 'photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir);
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(photosDir));
app.use(express.json({ limit: '10mb' }));

// Serve gallery page
app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
});

// Serve slideshow page
app.get('/slideshow', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'slideshow.html'));
});

// Random photo endpoint - serves a random photo as raw image
app.get('/random', (req, res) => {
  fs.readdir(photosDir, (err, files) => {
    if (err) {
      return res.status(404).send('No photos found');
    }
    
    const photos = files.filter(f => 
      f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')
    );
    
    if (photos.length === 0) {
      return res.status(404).send('No photos found');
    }
    
    // Pick a random photo
    const randomPhoto = photos[Math.floor(Math.random() * photos.length)];
    const photoPath = path.join(photosDir, randomPhoto);
    
    // Serve the image file directly
    res.sendFile(photoPath);
  });
});

// Save photo endpoint
app.post('/save', (req, res) => {
  const { image, prefix } = req.body;
  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  const filename = `${prefix || 'photo'}-${Date.now()}.jpg`;
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
    const photos = files
      .filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'))
      .sort()
      .reverse();
    res.json(photos);
  });
});

app.listen(port, () => {
  console.log(`Photobooth running at http://localhost:${port}`);
  console.log(`Photos saved to: ${photosDir}`);
});
