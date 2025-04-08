const express = require('express');
const router = express.Router();
const { Order } = require('../models');

// Get recent orders
router.get('/orders/recent', async (req, res) => {
  try {
    // Add proper sorting, limit and error handling
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json(recentOrders);
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get dashboard summary statistics
router.get('/dashboard/summary', async (req, res) => {
  try {
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    // Get all orders
    const allOrders = await Order.find();
    
    // Calculate previous month date range for growth calculations
    const firstDayOfPrevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const lastDayOfPrevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    
    // Total Sales Calculation
    const totalSales = allOrders.reduce((total, order) => total + (order.totalAmount || 0), 0);
    
    // Monthly Sales Calculation with proper date handling
    const monthlyOrders = allOrders.filter(order => {
      const orderDate = new Date(order.createdAt instanceof Date ? order.createdAt : order.createdAt?.$date || order.createdAt);
      return orderDate >= firstDayOfMonth && orderDate <= lastDayOfMonth;
    });
    
    const monthlySales = monthlyOrders.reduce((total, order) => total + (order.totalAmount || 0), 0);
    
    // Previous month sales for growth calculation
    const prevMonthOrders = allOrders.filter(order => {
      const orderDate = new Date(order.createdAt instanceof Date ? order.createdAt : order.createdAt?.$date || order.createdAt);
      return orderDate >= firstDayOfPrevMonth && orderDate <= lastDayOfPrevMonth;
    });
    
    const prevMonthSales = prevMonthOrders.reduce((total, order) => total + (order.totalAmount || 0), 0);
    
    // Calculate actual growth rates
    const revenueGrowth = prevMonthSales > 0 
      ? ((monthlySales - prevMonthSales) / prevMonthSales * 100).toFixed(1)
      : 0;
    
    const ordersGrowth = prevMonthOrders.length > 0
      ? ((monthlyOrders.length - prevMonthOrders.length) / prevMonthOrders.length * 100).toFixed(1)
      : 0;
    
    // Unique Customers Calculation with proper null handling
    const uniqueCustomers = new Set(
      allOrders
        .map(order => order.customerDetails?.email)
        .filter(email => email)
    );
    
    const uniqueCustomersPrevMonth = new Set(
      prevMonthOrders
        .map(order => order.customerDetails?.email)
        .filter(email => email)
    );
    
    const customersGrowth = uniqueCustomersPrevMonth.size > 0
      ? ((uniqueCustomers.size - uniqueCustomersPrevMonth.size) / uniqueCustomersPrevMonth.size * 100).toFixed(1)
      : 0;
    
    res.json({
      totalSales,
      monthlySales,
      totalOrders: allOrders.length,
      totalCustomers: uniqueCustomers.size,
      revenueGrowth: parseFloat(revenueGrowth),
      ordersGrowth: parseFloat(ordersGrowth),
      customersGrowth: parseFloat(customersGrowth)
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;