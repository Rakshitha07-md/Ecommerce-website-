const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Place a new order
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { items, shippingAddress } = req.body;

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      !shippingAddress ||
      !shippingAddress.trim()
    ) {
      return res.status(400).json({
        message: "Products and shipping address are required",
      });
    }

    // Validate products and calculate the total on the server
    const orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      if (
        !mongoose.Types.ObjectId.isValid(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return res.status(400).json({
          message: "Invalid product ID or quantity",
        });
      }

      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({
          message: `Product not found: ${item.productId}`,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}`,
        });
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
      });

      totalAmount += product.price * item.quantity;
    }

    // Reduce product stock
    for (const item of orderItems) {
      const result = await Product.updateOne(
        {
          _id: item.product,
          stock: { $gte: item.quantity },
        },
        {
          $inc: { stock: -item.quantity },
        }
      );

      if (result.modifiedCount !== 1) {
        return res.status(409).json({
          message: `Stock changed for ${item.name}. Please try again.`,
        });
      }
    }

    const order = await Order.create({
      user: req.userId,
      items: orderItems,
      totalAmount,
      shippingAddress: shippingAddress.trim(),
    });

    res.status(201).json({
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error placing order",
      error: error.message,
    });
  }
});

// Get the logged-in user's orders
router.get("/my-orders", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.userId })
      .populate("items.product", "name image")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching orders",
      error: error.message,
    });
  }
});

module.exports = router;