const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Ensure type is set (for legacy tokens or missing type)
    if (!req.user.type) {

      if (req.originalUrl.includes('/vendors')) {
        req.user.type = 'vendor';
      } else if (req.originalUrl.includes('/customers')) {
        req.user.type = 'customer';
      }
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = verifyToken;
