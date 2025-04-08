const express = require('express');
const path = require('path');
const fs = require('fs');
const { Order } = require('../models');

const router = express.Router();

// File Upload Route
router.post('/upload', (req, res) => {
  const upload = req.app.locals.upload;
  
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ 
        success: false, 
        message: 'File upload error', 
        error: err.message 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    res.json({
      success: true,
      fileId: req.file.filename,
      fileUrl: `http://localhost:5010/api/files/${req.file.filename}`
    });
  });
});

// File Retrieval Route
router.get('/files/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  
  // Check if file exists
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ 
      success: false, 
      message: 'File not found' 
    });
  }
});

// Order Saving Route
router.post('/orders', async (req, res) => {
    try {
      const {
        orderData,
        orderSummary,
        customerDetails,
        paymentDetails
      } = req.body;
  
      // Validate input
      if (!orderData || !Array.isArray(orderData) || orderData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Order data is required and must be an array'
        });
      }
  
      // Calculate total amount with proper numeric handling
      let totalAmount = 0;
      const processedOrderData = orderData.map(item => {
        // Ensure price is a valid number
        const priceString = String(item.price || 0).replace(/[^\d.-]/g, '');
        const price = parseFloat(priceString) || 0;
        
        // Ensure quantity is a valid number
        const quantity = parseInt(item.quantity) || 1;
        
        // Calculate item total with proper precision
        const itemTotal = price * quantity;
        totalAmount += itemTotal;
        
        return {
          ...item,
          price: price,
          quantity: quantity,
          total: `₹ ${itemTotal.toFixed(2)}`
        };
      });
  
      // Ensure totalAmount has proper precision for storage
      totalAmount = Number(totalAmount.toFixed(2));
  
      // Create new order with validated data
      const newOrder = new Order({
        orderData: processedOrderData,
        orderSummary: orderSummary || {},
        customerDetails: customerDetails || {},
        paymentDetails: paymentDetails || {},
        totalAmount,
        status: 'Pending',
        createdAt: new Date()
      });
  
      // Save order to database
      const savedOrder = await newOrder.save();
  
      res.status(201).json({
        success: true,
        message: 'Order saved successfully',
        orderId: savedOrder._id
      });
    } catch (error) {
      console.error('Order saving error:', error);
      
      // More specific error handling
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error saving order',
        error: error.message
      });
    }
  });


  
// Order Retrieval Routes
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error retrieving orders',
      error: error.message 
    });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error retrieving order',
      error: error.message 
    });
  }
});

module.exports = router;