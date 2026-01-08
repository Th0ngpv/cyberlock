require('dotenv').config();

const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const app = express();

const session = require('express-session');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');


const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || 'questions';
const COLLECTION_NAME = process.env.MONGO_COLLECTION || 'slides';

const CATEGORIES = [
  'authentication',
  'malware',
  'network_security',
  'password_security',
  'phishing',
  'social_engineering'
];

function createDefaultProgress() {
  const categories = {};

  CATEGORIES.forEach(cat => {
    categories[cat] = {
      quiz: false,
      cards: false,
      test: false,
      testScore: 0,
      testMaxScore: 0
    };
  });

  return {
    quizzesCompleted: 0,
    totalScore: 0,
    totalAttempts: 0,
    completedAt: [],
    categories
  };
}

let questionsDB = null;
let cyberwiseDB = null;

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();

    questionsDB = client.db('questions');
    cyberwiseDB = client.db('cyberwise');

    console.log('Connected to MongoDB (questions + cyberwise)');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}


app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // true only if HTTPS
}));


app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API endpoint to get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const collection = questionsDB.collection(COLLECTION_NAME);
    const categories = await collection.distinct('category');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// API endpoint to get questions by multiple categories
app.post('/api/questions/multiple', async (req, res) => {
  try {
    const { categories } = req.body;
    console.log('Fetching questions for categories:', categories);
    const collection = questionsDB.collection(COLLECTION_NAME);
    const questions = await collection.find({ 
      category: { $in: categories } 
    }).toArray();
    console.log('Found questions:', questions.length);
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// API endpoint to get questions by single category
app.get('/api/questions/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const collection = questionsDB.collection(COLLECTION_NAME);
    const questions = await collection.find({ category }).toArray();
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// API endpoint to get all questions (with optional category filter)
app.get('/api/questions', async (req, res) => {
  try {
    const { category } = req.query;
    const collection = questionsDB.collection(COLLECTION_NAME);
    
    let query = {};
    if (category && category !== 'all') {
      query = { category };
    }
    
    const questions = await collection.find(query).toArray();
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// API endpoint to get Firebase configuration
app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  });
});

function hashPassword(password) {
  const salt = crypto.randomBytes(8).toString('hex');
  const iterations = 150000;
  const hashAlg = 'sha256';

  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, 32, hashAlg)
    .toString('hex');

  return `pbkdf2:${hashAlg}:${iterations}$${salt}$${hash}`;
}

function verifyPassword(passwordAttempt, storedPassword) {
  // Format: pbkdf2:sha256:150000$salt$hash
  const [meta, salt, originalHash] = storedPassword.split('$');

  if (!meta || !salt || !originalHash) {
    throw new Error('Invalid password format');
  }

  const [, hashAlg, iterationsStr] = meta.split(':');
  const iterations = parseInt(iterationsStr, 10);

  const hashAttempt = crypto
    .pbkdf2Sync(passwordAttempt, salt, iterations, 32, hashAlg)
    .toString('hex');

  return crypto.timingSafeEqual(
    Buffer.from(hashAttempt, 'hex'),
    Buffer.from(originalHash, 'hex')
  );
}

// POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await cyberwiseDB
      .collection('users')
      .findOne({ email });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = hashPassword(password);

    const user = {
      username: name,
      email,
      password: hashedPassword,
      progress: createDefaultProgress(), // ⭐ KEY FIX
      created_at: new Date(),
      lastLogin: null
    };

    await questionsDB.collection('users').insertOne(user);

    res.json({ message: 'Account created successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await questionsDB
      .collection('users')
      .findOne({ email });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Save session
    req.session.userId = user._id;
    req.session.userName = user.name;

    await questionsDB.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    res.json({
      message: 'Login successful',
      user: {
        name: user.name,
        email: user.email,
        progress: user.progress
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.clearCookie('connect.sid'); // remove session cookie
      res.json({ message: 'Logged out successfully' });
    });
  } else {
    res.json({ message: 'No session to destroy' });
  }
});


// GET /api/auth/status
app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({
      loggedIn: true,
      user: {
        name: req.session.user.name,
        email: req.session.user.email
      }
    });
  }

  res.json({ loggedIn: false });
});

// POST /api/progress/update
app.post('/api/progress/update', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { category, mode, score, maxScore } = req.body;

    const users = questionsDB.collection('users');

    const update = {
      $set: {
        [`progress.categories.${category}.${mode}`]: true,
      },
      $setOnInsert: {
        created_at: new Date(),
      },
    };

    if (mode === 'test') {
      update.$set[`progress.categories.${category}.testScore`] = score;
      update.$set[`progress.categories.${category}.testMaxScore`] = maxScore;
    }

    await users.updateOne(
      { _id: new ObjectId(req.session.userId) },
      update,
      { upsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Progress update error:', err);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// GET /api/progress
app.get('/api/progress', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({});
    }

    const users = questionsDB.collection('users');

    const user = await users.findOne(
      { _id: new ObjectId(req.session.userId) },
      { projection: { progress: 1 } }
    );

    res.json(user?.progress || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({});
  }
});

// GET /api/dashboard
app.get('/api/dashboard', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const users = questionsDB.collection('users');

    const user = await users.findOne(
      { _id: new ObjectId(req.session.userId) },
      {
        projection: {
          username: 1,
          email: 1,
          progress: 1,
          created_at: 1
        }
      }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const categories = user.progress?.categories || {};

    let completed = 0;
    let total = Object.keys(categories).length;

    Object.values(categories).forEach(c => {
      if (c.quiz && c.cards && c.test) completed++;
    });

    res.json({
      user: {
        username: user.username,
        email: user.email,
        joined: user.created_at
      },
      progress: categories,
      stats: {
        completedCategories: completed,
        totalCategories: total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});



// REPLACE THIS HARDCODED VALUE TOO
const PORT = process.env.PORT || 3000;

// Connect to DB and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
