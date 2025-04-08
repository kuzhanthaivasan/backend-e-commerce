// routes/imageRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Helper functions
const isBase64 = (str) => {
  try {
    if (!str || typeof str !== 'string') return false;
    const regex = /^data:image\/[a-z]+;base64,/;
    return regex.test(str);
  } catch (err) {
    return false;
  }
};

const urlToBase64 = async (url) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Error converting URL to base64:', err);
    return null;
  }
};

const cleanupTempFiles = (filepath) => {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`Cleaned up temporary file: ${filepath}`);
    }
  } catch (err) {
    console.error('Error cleaning up temporary file:', err);
  }
};

// Setup uploads directory
const uploadsDir = path.join(__dirname, '..', 'temp-uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created temporary uploads directory');
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `img_${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Upload image route
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    console.log('Image upload endpoint called');
    
    // Handle file upload via multer
    if (req.file) {
      console.log('File uploaded via multer, converting to base64');
      
      // Read the file and convert to base64
      const filePath = req.file.path;
      const fileData = fs.readFileSync(filePath);
      const base64Image = `data:${req.file.mimetype};base64,${fileData.toString('base64')}`;
      
      // Clean up the temporary file
      cleanupTempFiles(filePath);
      
      return res.json({ 
        imageData: base64Image,
        success: true
      });
    }
    
    // Handle base64 image data
    if (req.body.image) {
      let imageData = req.body.image;
      
      // Handle blob URLs if they're sent directly
      if (imageData.startsWith('blob:')) {
        return res.status(400).json({ 
          message: 'Blob URLs cannot be processed by the server. Please convert the image to base64 or send the file directly.' 
        });
      }
      
      // If it's already base64, just return it
      if (isBase64(imageData)) {
        return res.json({ 
          imageData: imageData,
          success: true
        });
      }
      
      // For any other format, return error
      return res.status(400).json({ message: 'Unsupported image format' });
    }
    
    // No image data provided
    return res.status(400).json({ message: 'No image provided' });
  } catch (err) {
    console.error('Error processing image:', err);
    res.status(500).json({ message: 'Error processing image', error: err.message });
  }
});





//======================================================
// Image Upload Route for Fingerprint Customization
//======================================================

router.post('/upload/fingerprint', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Get path of the temp file
    const tempFilePath = req.file.path;
    
    // Create a unique filename for the final image
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(req.file.originalname);
    const finalFilename = `fingerprint-${uniqueSuffix}${ext}`;
    const finalPath = path.join(uploadsDir, finalFilename);
    
    // Copy the file from temp to uploads directory
    fs.copyFile(tempFilePath, finalPath, (err) => {
      if (err) {
        console.error('Error copying file:', err);
        return res.status(500).json({ message: 'Error saving file', error: err.message });
      }
      
      // Clean up the temp file
      cleanupTempFiles(tempFilePath);
      
      // Return the image path
      res.status(200).json({
        message: 'Fingerprint image uploaded successfully',
        uploadedFile: finalFilename,
        imageUrl: `/uploads/${finalFilename}`
      });
    });
  } catch (err) {
    console.error('Error in fingerprint upload:', err);
    res.status(500).json({ 
      message: 'Server error during file upload',
      error: err.message
    });
  }
});



//======================================================
// Base64 Image Processing Route
//======================================================

router.post('/upload/base64', async (req, res) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData || !isBase64(imageData)) {
      return res.status(400).json({ message: 'Invalid base64 image data' });
    }
    
    // Create a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const finalFilename = `base64-${uniqueSuffix}.png`;
    
    // Save the base64 image
    try {
      const savedFilename = await saveBase64Image(imageData, finalFilename);
      
      res.status(200).json({
        message: 'Base64 image uploaded successfully',
        uploadedFile: savedFilename,
        imageUrl: `/uploads/${savedFilename}`
      });
    } catch (saveErr) {
      console.error('Error saving base64 image:', saveErr);
      res.status(500).json({ 
        message: 'Error saving base64 image', 
        error: saveErr.message 
      });
    }
  } catch (err) {
    console.error('Error in base64 upload:', err);
    res.status(500).json({ 
      message: 'Server error during base64 processing',
      error: err.message
    });
  }
});

module.exports = router;