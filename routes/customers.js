const router = require('express').Router();
const Customer = require('../models/Customer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);

    const customer = await Customer.findOne({ email });
    if (!customer) {
      console.log('User not found:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      console.log('Invalid password for:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: customer._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful for:', email);
    
    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: customer._id,
        name: customer.name,
        email: customer.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
