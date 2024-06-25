const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { exec } = require('child_process');
const XLSX = require('xlsx');

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({ dest: 'uploads/' });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/video", (req, res) => {
  const range = req.headers.range;
  if (!range) {
    return res.status(400).send("Requires Range header");
  }

  const videoPath = path.join(__dirname, 'public', req.query.video);
  const videoSize = fs.statSync(videoPath).size;

  const CHUNK_SIZE = 10 ** 6;
  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

  const contentLength = end - start + 1;
  const headers = {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mp4",
  };

  res.writeHead(206, headers);
  const videoStream = fs.createReadStream(videoPath, { start, end });
  videoStream.pipe(res);
});

// Save-frame route for shop scene
app.post('/save-frame', upload.single('frame'), (req, res) => {
  const tempPath = req.file.path;
  const targetPath = path.join(__dirname, 'uploads', 'frame.png');

  fs.rename(tempPath, targetPath, err => {
    if (err) return res.status(500).json({ error: err.message });

    exec('python detectItems.py', (err, stdout, stderr) => {
      if (err) {
        console.error(`exec error: ${err}`);
        return res.status(500).json({ error: 'Failed to run detectItems.py' });
      }

      const sheetsDir = path.join(__dirname, 'sheets');
      fs.readdir(sheetsDir, (err, files) => {
        if (err) throw err;

        for (const file of files) {
          fs.unlink(path.join(sheetsDir, file), err => {
            if (err) throw err;
          });
        }

        exec('python scrape.py', (err, stdout, stderr) => {
          if (err) {
            console.error(`exec error: ${err}`);
            return res.status(500).json({ error: 'Failed to run scrape.py' });
          }

          fs.readdir(sheetsDir, (err, files) => {
            if (err) throw err;

            const productData = [];

            files.forEach(file => {
              const filePath = path.join(sheetsDir, file);
              const workbook = XLSX.readFile(filePath);
              const sheetName = workbook.SheetNames[0];
              const sheet = workbook.Sheets[sheetName];
              const jsonData = XLSX.utils.sheet_to_json(sheet);

              jsonData[0].Product_ID = path.basename(file, '.xlsx'); // Set product ID from filename

              productData.push(jsonData[0]);
            });

            res.json({ message: 'Frame saved successfully', products: productData });
          });
        });
      });
    });
  });
});

// New route for saving cropped frame
app.post('/save-cropped-frame', upload.single('frame'), (req, res) => {
  const tempPath = req.file.path;
  const imgsDir = path.join(__dirname, 'imgs');

  // Ensure imgs directory exists
  if (!fs.existsSync(imgsDir)) {
    fs.mkdirSync(imgsDir);
  }

  // Clear the imgs directory before saving new frame
  fs.readdir(imgsDir, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(imgsDir, file), err => {
        if (err) throw err;
      });
    }
    const sheetsDir = path.join(__dirname, 'sheets');
    fs.readdir(sheetsDir, (err, files) => {
      if (err) throw err;

      for (const file of files) {
        fs.unlink(path.join(sheetsDir, file), err => {
          if (err) throw err;
        });
      }
    });

    const targetPath = path.join(imgsDir, 'frame.png');

    fs.rename(tempPath, targetPath, err => {
      if (err) {
        console.error("Error renaming file:", err);
        return res.status(500).json({ error: err.message });
      }

      // Run scrape.py after saving frame.png
      exec('python scrape.py', (err, stdout, stderr) => {
        if (err) {
          console.error(`exec error: ${err}`);
          return res.status(500).json({ error: 'Failed to run scrape.py' });
        }

        fs.readdir(sheetsDir, (err, files) => {
          if (err) throw err;

          const productData = [];

          files.forEach(file => {
            const filePath = path.join(sheetsDir, file);
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            jsonData[0].Product_ID = path.basename(file, '.xlsx'); // Set product ID from filename

            productData.push(jsonData[0]);
          });

          res.json({ message: 'Cropped frame saved successfully', products: productData });
        });
      });
    });
  });
});


app.post('/wishlist/add', (req, res) => {
  const { productId } = req.body;
  const sheetsDir = path.join(__dirname, 'sheets');
  const wishlistDir = path.join(__dirname, 'wishlist');

  if (!fs.existsSync(wishlistDir)) {
    fs.mkdirSync(wishlistDir);
  }

  const sourceFile = path.join(sheetsDir, `${productId}.xlsx`);
  const targetFile = path.join(wishlistDir, `${productId}.xlsx`);

  fs.copyFile(sourceFile, targetFile, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Failed to add to wishlist' });
    }

    res.json({ success: true });
  });
});

app.post('/wishlist/remove', (req, res) => {
  const { productId } = req.body;
  const wishlistDir = path.join(__dirname, 'wishlist');
  const targetFile = path.join(wishlistDir, `${productId}.xlsx`);

  fs.unlink(targetFile, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Failed to remove from wishlist' });
    }

    res.json({ success: true });
  });
});

// Endpoint to fetch wishlist items
app.get('/wishlist-items', (req, res) => {
  const wishlistDir = path.join(__dirname, 'wishlist');
  fs.readdir(wishlistDir, (err, files) => {
    if (err) {
      console.error('Error reading wishlist directory:', err);
      return res.status(500).json({ error: 'Failed to read wishlist' });
    }

    const wishlistItems = [];
    files.forEach(file => {
      const filePath = path.join(wishlistDir, file);
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      wishlistItems.push({ ...jsonData[0], id: path.basename(file, '.xlsx') }); // Add id as Product_ID (sheet name)
    });

    res.json(wishlistItems);
  });
});

// Endpoint to remove item from wishlist
app.get('/remove-from-wishlist', (req, res) => {
  const productId = req.query.productId;

  if (!productId) {
    return res.status(400).json({ error: 'Missing productId parameter' });
  }

  const filePath = path.join(__dirname, 'wishlist', `${productId}.xlsx`);
  
  // Remove file
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error removing file from wishlist:', err);
      return res.status(500).json({ success: false, error: 'Failed to remove item from wishlist' });
    }

    res.json({ success: true }); // Send success response
  });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
