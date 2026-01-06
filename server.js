require('dotenv').config();

const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const app = express();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || 'questions';
const COLLECTION_NAME = process.env.MONGO_COLLECTION || 'slides';

let db = null;

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API endpoint to get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const collection = db.collection(COLLECTION_NAME);
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
    const collection = db.collection(COLLECTION_NAME);
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
    const collection = db.collection(COLLECTION_NAME);
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
    const collection = db.collection(COLLECTION_NAME);
    
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

// REPLACE THIS HARDCODED VALUE TOO
const PORT = process.env.PORT || 3000;

// Connect to DB and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
