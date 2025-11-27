// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

// HOME PAGE
router.get('/', (req, res) => {
  res.render('home', { currentUserName: req.session.userName || '' });
});

// LOGIN PAGE
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/habits');
  res.render('login', { error: '' });
});

// REGISTER PAGE
router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/habits');
  res.render('register', { error: '' });
});

// REGISTER SUBMIT
router.post('/register', async (req, res) => {
  const { name, email, password, password2 } = req.body;

  try {
    if (!name || !email || !password || !password2) {
      return res.render('register', { error: 'Please fill in all fields.' });
    }

    if (password !== password2) {
      return res.render('register', { error: 'Passwords do not match.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.render('register', { error: 'Email is already registered.' });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash: hash,
    });

    // login right after register
    req.session.userId = user._id.toString();
    req.session.userName = user.name;

    res.redirect('/habits');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Something went wrong. Please try again.' });
  }
});

// LOGIN SUBMIT
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    req.session.userId = user._id.toString();
    req.session.userName = user.name;

    res.redirect('/habits');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Something went wrong. Please try again.' });
  }
});

// LOGOUT
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
