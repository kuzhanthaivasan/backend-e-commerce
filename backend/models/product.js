

// models/product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  gram: { type: Number, default: 0 },
  peopleCategory: { type: String, required: true },
  productCategory: { type: String, required: true },
  productType: { type: String, required: true },
  priceRange: { type: String, required: true },
  stock: { type: Number, required: true },
  metalType: { type: String, enum: ['gold', 'silver'], default: ' ' },
  customOption: { type: String, default: '' },
  images: [{ 
    type: String,  // Base64 encoded image string
    default: []    // Default to an empty array
  }],
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;