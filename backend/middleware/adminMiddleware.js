const adminMiddleware = (req, res, next) => {
  if (!req.userId) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  if (req.userRole !== "admin") {
    return res.status(403).json({
      message: "Admin access required",
    });
  }

  next();
};

module.exports = adminMiddleware;