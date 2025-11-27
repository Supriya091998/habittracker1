// index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');

const app = express();

// --- MIDDLEWARE SETUP ---

// static (css, images)
app.use(express.static(path.join(__dirname, 'public')));

// parse forms / JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// sessions (simple in-memory store is fine for this project)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'super-secret-habit-key',
    resave: false,
    saveUninitialized: false,
  })
);

// view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- MONGODB CONNECTION ---
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/habit_tracker';

mongoose
  .connect(mongoUri)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// --- ROUTES ---
const authRoutes = require('./routes/auth');
const habitRoutes = require('./routes/habits');

app.use('/', authRoutes);
app.use('/', habitRoutes);

// fallback – if someone hits an unknown route
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

