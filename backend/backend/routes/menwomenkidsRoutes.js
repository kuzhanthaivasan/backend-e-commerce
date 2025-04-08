const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { Product } = require('../models');

const router = express.Router();

// ====================================================== 
// MULTER CONFIGURATION (for initial file handling) 
// ====================================================== 
const uploadsDir = path.join(__dirname, 'temp-uploads');
const permanentUploadsDir = path.join(__dirname, 'uploads');

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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ====================================================== 
// HELPER FUNCTIONS 
// ====================================================== 
// Helper function to check if a string is base64 encoded 
const isBase64 = (str) => {   
  try {     
    if (!str || typeof str !== 'string') return false;     
    const regex = /^data:image\/[a-z]+;base64,/;     
    return regex.test(str);   
  } catch (err) {     
    return false;   
  } 
};  

// Helper function to convert URL to base64 (useful for external images) 
const urlToBase64 = async (url) => {   
  try {     
    const response = await fetch(url);     
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = response.headers.get('content-type');
    return `data:${mimeType};base64,${base64}`;
  } catch (err) {     
    console.error('Error converting URL to base64:', err);     
    return null;   
  } 
};

// Function to save base64 image to file
const saveBase64Image = (base64Data, uniqueId) => {
  return new Promise((resolve, reject) => {
    try {
      // Extract the MIME type and actual base64 data
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      
      if (!matches || matches.length !== 3) {
        return reject(new Error('Invalid base64 string'));
      }
      
      const mimeType = matches[1];
      const base64 = matches[2];
      const extension = mimeType.split('/')[1];
      const fileName = `img_${uniqueId}.${extension}`;
      const filePath = path.join(permanentUploadsDir, fileName);
      
      // Save the file
      fs.writeFile(filePath, base64, 'base64', (err) => {
        if (err) return reject(err);
        resolve({
          fileName,
          filePath,
          url: `/uploads/${fileName}`
        });
      });
    } catch (err) {
      reject(err);
    }
  });
};

// Function to clean up temporary files 
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

// ====================================================== 
// IMAGE UPLOAD ENDPOINTS 
// ====================================================== 
// Upload image using multipart form data
router.post('/upload/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const tempFilePath = req.file.path;
    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(req.file.originalname);
    const fileName = `img_${uniqueId}${extension}`;
    const destinationPath = path.join(permanentUploadsDir, fileName);

    // Move file from temp to permanent storage
    fs.copyFileSync(tempFilePath, destinationPath);
    
    // Clean up the temporary file
    cleanupTempFiles(tempFilePath);
    
    // Return the URL to access the image
    res.json({
      success: true,
      imageUrl: `/uploads/${fileName}`,
      fileName: fileName
    });
  } catch (error) {
    console.error('Error handling image upload:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload image as base64 string
router.post('/upload/base64', async (req, res) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData || !isBase64(imageData)) {
      return res.status(400).json({ message: 'Invalid or missing base64 image data' });
    }
    
    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const result = await saveBase64Image(imageData, uniqueId);
    
    res.json({
      success: true,
      imageUrl: result.url,
      fileName: result.fileName
    });
  } catch (error) {
    console.error('Error handling base64 image upload:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload image from URL
router.post('/upload/url', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ message: 'No image URL provided' });
    }
    
    // Convert URL to base64
    const base64Data = await urlToBase64(imageUrl);
    
    if (!base64Data) {
      return res.status(400).json({ message: 'Failed to fetch image from URL' });
    }
    
    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const result = await saveBase64Image(base64Data, uniqueId);
    
    res.json({
      success: true,
      imageUrl: result.url,
      fileName: result.fileName,
      originalUrl: imageUrl
    });
  } catch (error) {
    console.error('Error handling URL image upload:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ====================================================== 
// PRODUCT ENDPOINTS WITH IMAGE SUPPORT
// ====================================================== 
// Create a new product with image(s)
router.post('/products', async (req, res) => {
    try {
      const productData = req.body;
      
      // Handle base64 images in the product data if present
      if (productData.imageData && isBase64(productData.imageData)) {
        const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const result = await saveBase64Image(productData.imageData, uniqueId);
        
        // Replace the base64 data with the image URL
        productData.imageData = undefined;
        productData.imageUrl = result.url;
      }
      
      // Handle multiple images if present
      if (productData.imagesData && Array.isArray(productData.imagesData)) {
        const imageUrls = [];
        
        for (const base64Image of productData.imagesData) {
          if (isBase64(base64Image)) {
            const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const result = await saveBase64Image(base64Image, uniqueId);
            imageUrls.push(result.url);
          }
        }
        
        // Replace the base64 data with image URLs
        productData.imagesData = undefined;
        productData.imageUrls = imageUrls;
      }
      
      // Create and save the new product
      const product = new Product(productData);
      await product.save();
      
      res.status(201).json(product);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Update a product with new image(s)
  router.put('/products/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Handle base64 images in the update data if present
      if (updateData.imageData && isBase64(updateData.imageData)) {
        const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const result = await saveBase64Image(updateData.imageData, uniqueId);
        
        // Replace the base64 data with the image URL
        updateData.imageData = undefined;
        updateData.imageUrl = result.url;
      }
      
      // Handle multiple images if present
      if (updateData.imagesData && Array.isArray(updateData.imagesData)) {
        const imageUrls = [];
        
        for (const base64Image of updateData.imagesData) {
          if (isBase64(base64Image)) {
            const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const result = await saveBase64Image(base64Image, uniqueId);
            imageUrls.push(result.url);
          }
        }
        
        // Replace the base64 data with image URLs
        updateData.imagesData = undefined;
        updateData.imageUrls = imageUrls;
      }
      
      // Update the product
      const product = await Product.findByIdAndUpdate(id, updateData, { new: true });
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.json(product);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Get a specific product by ID
  router.get('/products/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.json(product);
    } catch (error) {
      console.error('Error retrieving product:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // ====================================================== 
  // PRODUCT API ENDPOINTS
  // ====================================================== 
  // API endpoint to fetch all products with filtering options
  router.get('/products', async (req, res) => {
    try {
      const { 
        peopleCategory, 
        productCategory, 
        productType, 
        priceRange,
        minPrice,
        maxPrice,
        sortBy 
      } = req.query;
      
      // Building the query object
      const query = {};
      
      // Filter by people category (male, female, kids, unisex)
      if (peopleCategory) {
        query.peopleCategory = peopleCategory;
      }
      
      // Filter by product category (chain, ring, etc.)
      if (productCategory) {
        query.productCategory = productCategory;
      }
      
      // Filter by product type (silver, gold)
      if (productType) {
        query.productType = productType;
      }
      
      // Filter by price range
      if (priceRange) {
        query.priceRange = priceRange;
      }
      
      // Filter by min and max price if provided
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseInt(minPrice);
        if (maxPrice) query.price.$lte = parseInt(maxPrice);
      }
      
      console.log('Database query:', JSON.stringify(query));
      
      // Get products from the database
      let products = await Product.find(query);
      
      console.log(`Found ${products.length} products matching the criteria`);
      
      // Apply sorting
      if (sortBy) {
        switch (sortBy) {
          case 'alpha-asc':
            products.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'alpha-desc':
            products.sort((a, b) => b.name.localeCompare(a.name));
            break;
          case 'price-asc':
            products.sort((a, b) => a.price - b.price);
            break;
          case 'price-desc':
            products.sort((a, b) => b.price - a.price);
            break;
          default:
            // Default sorting by creation date
            products.sort((a, b) => {
              if (a.createdAt && b.createdAt) {
                return new Date(b.createdAt) - new Date(a.createdAt);
              }
              return 0;
            });
        }
      }
      
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Specific endpoint for men's jewelry - FIXED ROUTE PATH
  router.get('/products/category/men', async (req, res) => {
    try {
      const { 
        productCategory, 
        productType, 
        priceRange,
        minPrice,
        maxPrice,
        sortBy 
      } = req.query;
      
      // Building the query object - always filter for male category
      const query = { 
        $and: [
          { $or: [{ peopleCategory: "male" }, { peopleCategory: "Male" }] },
          { $or: [
              { customOption: "None" },
              { customOption: { $exists: false } }
            ] 
          }
        ]
      };
      
      // Additional filters
      if (productCategory) query.productCategory = productCategory;
      if (productType) query.productType = productType;
      if (priceRange) query.priceRange = priceRange;
      
      // Filter by min and max price if provided
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseInt(minPrice);
        if (maxPrice) query.price.$lte = parseInt(maxPrice);
      }
      
      console.log('Men\'s products query:', JSON.stringify(query));
      
      // Get products from the database
      let products = await Product.find(query);
      
      console.log(`Found ${products.length} men's products matching the criteria`);
      
      // Apply sorting
      if (sortBy) {
        switch (sortBy) {
          case 'alpha-asc':
            products.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'alpha-desc':
            products.sort((a, b) => b.name.localeCompare(a.name));
            break;
          case 'price-asc':
            products.sort((a, b) => a.price - b.price);
            break;
          case 'price-desc':
            products.sort((a, b) => b.price - a.price);
            break;
          default:
            // Default sorting
            products.sort((a, b) => {
              if (a.createdAt && b.createdAt) {
                return new Date(b.createdAt) - new Date(a.createdAt);
              }
              return 0;
            });
        }
      }
      
      res.json(products);
    } catch (error) {
      console.error('Error fetching men\'s products:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Endpoint for women's jewelry - FIXED ROUTE PATH
  router.get('/products/category/women', async (req, res) => {
    try {
      const { 
        productCategory, 
        productType, 
        priceRange,
        minPrice,
        maxPrice,
        sortBy 
      } = req.query;
      
       
    const query = { 
      $and: [
        { $or: [{ peopleCategory: "female" }, { peopleCategory: "Female" }] },
        { $or: [
            { customOption: "None" },
            { customOption: { $exists: false } }
          ] 
        }
      ]
    };
    
      
      // Additional filters
      if (productCategory) query.productCategory = productCategory;
      if (productType) query.productType = productType;
      if (priceRange) query.priceRange = priceRange;
      
      // Filter by min and max price if provided
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseInt(minPrice);
        if (maxPrice) query.price.$lte = parseInt(maxPrice);
      }
      
      let products = await Product.find(query);
      
      // Apply sorting
      if (sortBy) {
        switch (sortBy) {
          case 'alpha-asc':
            products.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'alpha-desc':
            products.sort((a, b) => b.name.localeCompare(a.name));
            break;
          case 'price-asc':
            products.sort((a, b) => a.price - b.price);
            break;
          case 'price-desc':
            products.sort((a, b) => b.price - a.price);
            break;
          default:
            products.sort((a, b) => {
              if (a.createdAt && b.createdAt) {
                return new Date(b.createdAt) - new Date(a.createdAt);
              }
              return 0;
            });
        }
      }
      
      res.json(products);
    } catch (error) {
      console.error('Error fetching women\'s products:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Endpoint for kids' jewelry - FIXED ROUTE PATH
  router.get('/products/category/kids', async (req, res) => {
    try {
      const { 
        productCategory, 
        productType, 
        priceRange,
        minPrice,
        maxPrice,
        sortBy 
      } = req.query;
      const query = { 
        $and: [
          { $or: [{ peopleCategory: "kids" }, { peopleCategory: "Kids" }] },
          { $or: [
              { customOption: "None" },
              { customOption: { $exists: false } }
            ] 
          }
        ]
      };
      
      
      // Additional filters
      if (productCategory) query.productCategory = productCategory;
      if (productType) query.productType = productType;
      if (priceRange) query.priceRange = priceRange;
      
      // Filter by min and max price if provided
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseInt(minPrice);
        if (maxPrice) query.price.$lte = parseInt(maxPrice);
      }
      
      let products = await Product.find(query);
      
      // Apply sorting
      if (sortBy) {
        switch (sortBy) {
          case 'alpha-asc':
            products.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'alpha-desc':
            products.sort((a, b) => b.name.localeCompare(a.name));
            break;
          case 'price-asc':
            products.sort((a, b) => a.price - b.price);
            break;
          case 'price-desc':
            products.sort((a, b) => b.price - a.price);
            break;
          default:
            products.sort((a, b) => {
              if (a.createdAt && b.createdAt) {
                return new Date(b.createdAt) - new Date(a.createdAt);
              }
              return 0;
            });
        }
      }
      
      res.json(products);
    } catch (error) {
      console.error('Error fetching kids\' products:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Endpoint for unisex jewelry - FIXED ROUTE PATH
  router.get('/products/category/unisex', async (req, res) => {
    try {
      const { 
        productCategory, 
        productType, 
        priceRange,
        minPrice,
        maxPrice,
        sortBy 
      } = req.query;
      
      const query = { $or: [{ peopleCategory: "unisex" }, { peopleCategory: "Unisex" }] };
      
      // Additional filters
      if (productCategory) query.productCategory = productCategory;
      if (productType) query.productType = productType;
      if (priceRange) query.priceRange = priceRange;
      
      // Filter by min and max price if provided
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseInt(minPrice);
        if (maxPrice) query.price.$lte = parseInt(maxPrice);
      }
      
      let products = await Product.find(query);
      
      // Apply sorting
      if (sortBy) {
        switch (sortBy) {
          case 'alpha-asc':
            products.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'alpha-desc':
            products.sort((a, b) => b.name.localeCompare(a.name));
            break;
          case 'price-asc':
            products.sort((a, b) => a.price - b.price);
            break;
          case 'price-desc':
            products.sort((a, b) => b.price - a.price);
            break;
          default:
            products.sort((a, b) => {
              if (a.createdAt && b.createdAt) {
                return new Date(b.createdAt) - new Date(a.createdAt);
              }
              return 0;
            });
        }
      }
      
      res.json(products);
    } catch (error) {
      console.error('Error fetching unisex products:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Endpoint for couples jewelry - FIXED ROUTE PATH
  router.get('/products/category/couples', async (req, res) => {
    try {
      const { 
        productCategory, 
        productType, 
        priceRange,
        minPrice,
        maxPrice,
        sortBy 
      } = req.query;
      
      const query = { 
        $and: [
          { $or: [{ peopleCategory: "Couples" }, { peopleCategory: "couples" }] },
          { $or: [
              { customOption: "None" },
              { customOption: { $exists: false } }
            ] 
          }
        ]
      };
      
      
      // Additional filters
      if (productCategory) query.productCategory = productCategory;
      if (productType) query.productType = productType;
      if (priceRange) query.priceRange = priceRange;
      
      // Filter by min and max price if provided
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseInt(minPrice);
        if (maxPrice) query.price.$lte = parseInt(maxPrice);
      }
      
      console.log('Couples products query:', JSON.stringify(query));
      
      let products = await Product.find(query);
      
      console.log(`Found ${products.length} couples products matching the criteria`);
      
      // Apply sorting
      if (sortBy) {
        switch (sortBy) {
          case 'alpha-asc':
            products.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'alpha-desc':
            products.sort((a, b) => b.name.localeCompare(a.name));
            break;
          case 'price-asc':
            products.sort((a, b) => a.price - b.price);
            break;
          case 'price-desc':
            products.sort((a, b) => b.price - a.price);
            break;
          default:
            products.sort((a, b) => {
              if (a.createdAt && b.createdAt) {
                return new Date(b.createdAt) - new Date(a.createdAt);
              }
              return 0;
            });
        }
      }
      
      res.json(products);
    } catch (error) {
      console.error('Error fetching couples products:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Test endpoint to verify API functionality
  router.get('/test', (req, res) => {
    res.json({ message: 'API is working correctly' });
  });
  
  // Diagnostic endpoint to check all products and DB status
  router.get('/diagnostic', async (req, res) => {
    try {
      const allProducts = await Product.find({});
      const productsByCategory = {
        male: await Product.countDocuments({ peopleCategory: "male" }),
        female: await Product.countDocuments({ peopleCategory: "female" }),
        kids: await Product.countDocuments({ peopleCategory: "kids" }),
        unisex: await Product.countDocuments({ peopleCategory: "unisex" }),
        couples: await Product.countDocuments({ peopleCategory: "couples" }),
      };
      
      const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
      
      res.json({
        dbStatus,
        totalProducts: allProducts.length,
        productsByCategory,
        sampleProduct: allProducts.length > 0 ? allProducts[0] : null
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  module.exports = router;