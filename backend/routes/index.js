const express = require('express');
const router = express.Router();

const imageRoutes = require('./imageRoutes');
const productRoutes = require('./productRoutes');
const categoryRoutes = require('./categoryRoutes');
const customOptionsRoutes = require('./customOptionsRoutes');
const metalRatesRoutes = require('./metalRatesRoutes');
const Userroutes = require('./Userroutes');
const orderRoutes = require('./orderRoutes');
const dashRoutes = require('./dashRoutes');


// Register all routes with appropriate prefixes
router.use('/upload-image', imageRoutes);
router.use('/products', productRoutes);
router.use('/', categoryRoutes);     // Clean separation
router.use('/customOptions', customOptionsRoutes);
router.use('/metal-rates', metalRatesRoutes);
router.use('/', Userroutes); 
router.use('/', orderRoutes); 
router.use('/', dashRoutes);             // Clear user endpoints
                                        // Clear user endpoints

module.exports = router;
