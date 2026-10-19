
const express = require("express");
const Product = require("../models/Product");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

// 1. Get all products - public
router.get("/", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Get a single product - public
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(400).json({ message: "Invalid product ID" });
  }
});

// 3. Add a product - admin only
router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const product = await Product.create(req.body);

    res.status(201).json({
      message: "Product added successfully",
      product,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 4. Update a product - admin only
router.put("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 5. Delete a product - admin only
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: "Invalid product ID" });
  }
});

module.exports = router;
