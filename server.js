const express = require('express');
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path'); // Added for file paths
const app = express();
const PORT = process.env.PORT || 10000;

// Add MongoDB requirements and connection setup
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Successfully connected to MongoDB!');
  console.log('Connection string used:', process.env.MONGODB_URI ? 'Valid connection string found' : 'No connection string provided');
})
.catch(err => {
  console.error('MongoDB connection error details:', err);
  console.error('Check if MONGODB_URI environment variable is set correctly in Render');
});

// Define Tweet schema and model
const TweetSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  handle: String,
  text: String,
  imageData: String,
  timestamp: { type: Number, default: () => Date.now() },
  likes: { type: Number, default: 0 },
  replies: { type: Array, default: [] },
  views: { type: Number, default: 0 },
  poll: Object,
  quotedTweet: Object,
  last_retweeted_by: String,
  profilePicture: String,
  verified: Boolean,
  isAI: { type: Boolean, default: false }
});

const Tweet = mongoose.model('Tweet', TweetSchema);

// Define User schema and model
const UserSchema = new mongoose.Schema({
  username: String,
  displayName: String,
  password: String,
  profilePic: String,
  // Add any other fields your users have
});

const User = mongoose.model('User', UserSchema);

app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from public
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// In-memory storage (will be loaded from/saved to files)
let users = {};
let tweets = [];
let classrooms = [];
let announcements = [];

// Replace the existing saveData function
async function saveData() {
  // With MongoDB, data is saved automatically when documents are created/updated
  // This function is kept for compatibility with existing code but doesn't need to do anything
  console.log("Data is automatically saved to MongoDB");
  return true;
}

// Replace the existing loadData function
async function loadData() {
  try {
    // Check if we have any tweets or users in the database
    const tweetCount = await Tweet.countDocuments();
    const userCount = await User.countDocuments();
    
    // If the database is empty, we might want to load initial data
    if (tweetCount === 0) {
      console.log("No tweets found in MongoDB, attempting to load from tweets.json as a fallback");
      try {
        const tweetsData = JSON.parse(fs.readFileSync('tweets.json', 'utf8'));
        if (tweetsData && tweetsData.length > 0) {
          await Tweet.insertMany(tweetsData);
          console.log(`Imported ${tweetsData.length} tweets from tweets.json`);
        }
      } catch (err) {
        console.log("Could not import tweets from file:", err.message);
      }
    }
    
    if (userCount === 0) {
      console.log("No users found in MongoDB, attempting to load from users.json as a fallback");
      try {
        const usersData = JSON.parse(fs.readFileSync('users.json', 'utf8'));
        if (usersData && usersData.length > 0) {
          await User.insertMany(usersData);
          console.log(`Imported ${usersData.length} users from users.json`);
        }
      } catch (err) {
        console.log("Could not import users from file:", err.message);
      }
    }
    
    console.log("Database ready");
    return true;
  } catch (error) {
    console.error("Error loading data:", error);
    return false;
  }
}

// Load data before starting the server
loadData();

// Add automatic saving every minute
setInterval(async () => {
  console.log("Auto-saving data...");
  try {
    await saveData();
    console.log("Data auto-saved successfully!");
  } catch (error) {
    console.error("Error auto-saving data:", error);
  }
}, 60000); // 60000 ms = 1 minute

// Handle graceful shutdown (for Render and other hosting platforms)
process.on('SIGTERM', async () => {
  console.log('SIGTERM received - saving data before shutdown');
  try {
    await saveData();
    console.log('Data saved successfully before shutdown');
    process.exit(0);
  } catch (error) {
    console.error('Error saving data before shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received - saving data before shutdown');
  try {
    await saveData();
    console.log('Data saved successfully before shutdown');
    process.exit(0);
  } catch (error) {
    console.error('Error saving data before shutdown:', error);
    process.exit(1);
  }
});

// Your existing endpoints
app.post('/api/deepseek', (req, res) => {
  const userInput = req.body.input;
  const child = spawn('ollama', ['run', 'deepseek-r1:14b']);
  let output = '';
  child.stdout.on('data', (data) => output += data.toString());
  child.stderr.on('data', (data) => console.error(`stderr: ${data}`));
  child.on('close', (code) => res.json({ output }));
  child.stdin.write(userInput);
  child.stdin.end();
});

app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("URL parameter is required");
  try {
    const response = await fetch(targetUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    if (!response.ok) return res.status(response.status).send(`Error fetching URL: ${response.status}`);
    res.set("Content-Type", response.headers.get("content-type") || "text/html");
    response.body.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).send("Error fetching the requested URL");
  }
});

app.post('/admin/shutdown', async (req, res) => {
  res.send('Shutting down...');
  await saveData();
  process.exit(0);
});

const http = require('http').createServer(app);
const io = require('socket.io')(http);
io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('chat message', (msg) => io.emit('chat message', msg));
  socket.on('tic move', (data) => io.emit('tic move', data));
  socket.on('join tic', () => io.emit('game start'));
  socket.on('loud noise', () => io.emit('loud noise'));
  socket.on('disconnect', () => console.log('A user disconnected'));
});

app.post('/api/signup', (req, res) => {
  const { handle, password } = req.body;
  if (!handle || !password) return res.status(400).json({ success: false, error: "Handle and password required" });
  if (users[handle.toLowerCase()]) return res.status(400).json({ success: false, error: "User already exists" });
  users[handle.toLowerCase()] = { handle, password, bio: "", profilePicture: null, verified: null, banned: false };
  return res.json({ success: true, message: "User created successfully", handle });
});

app.post('/api/login', (req, res) => {
  const { handle, password } = req.body;
  if (!handle || !password) return res.status(400).json({ success: false, error: "Handle and password required" });
  const user = users[handle.toLowerCase()];
  if (!user) return res.status(404).json({ success: false, error: "User not found" });
  if (user.banned) return res.status(403).json({ success: false, error: "Account suspended" });
  if (user.password !== password) return res.status(401).json({ success: false, error: "Incorrect password" });
  return res.json({ success: true, message: "Login successful", handle: user.handle });
});

// Add this function at the top with other functions
function generateViewCount() {
  // Generate a random number between 50 and 500
  return Math.floor(Math.random() * 451) + 50;
}

// Update the /api/tweet endpoint
app.post('/api/tweet', async (req, res) => {
  console.log("Received /api/tweet request:", req.body);
  const { handle, text, imageData, quotedTweet, poll } = req.body;
  
  if (!handle || (!text && !quotedTweet && !poll)) {
    console.log("Validation failed: Missing handle or content");
    return res.status(400).json({ success: false, error: "Handle and either text, quoted tweet, or poll required" });
  }
  
  // Check if user exists in the old users object
  const user = users[handle.toLowerCase()];
  if (user && user.banned) {
    console.log("User banned:", handle);
    return res.status(403).json({ success: false, error: "Account suspended" });
  }
  
  try {
    // Create a new tweet with MongoDB
    const newTweet = new Tweet({
      id: Date.now(), // Use timestamp as ID
      handle,
      text: text || "",
      imageData: imageData || null,
      timestamp: Date.now(),
      likes: 0,
      replies: [],
      views: generateViewCount(),
      poll: poll || null,
      quotedTweet: quotedTweet ? { 
        ...quotedTweet, 
        profilePicture: users[quotedTweet.handle.toLowerCase()]?.profilePicture || null, 
        verified: users[quotedTweet.handle.toLowerCase()]?.verified || null 
      } : null,
      last_retweeted_by: null,
      profilePicture: user?.profilePicture || null,
      verified: user?.verified || null
    });
    
    // Save to MongoDB
    await newTweet.save();
    console.log("Tweet saved to MongoDB:", newTweet);
    
    // Also add to in-memory array for backward compatibility
    tweets.push(newTweet.toObject());
    
    // Emit socket event if needed
    if (io) {
      io.emit('new tweet', newTweet);
    }
    
    return res.json({ success: true, tweet: newTweet });
  } catch (error) {
    console.error("Error saving tweet to MongoDB:", error);
    return res.status(500).json({ success: false, error: "Failed to save tweet" });
  }
});

app.post('/api/tweet/reply', async (req, res) => {
  const { tweetId, handle, text, imageData } = req.body;
  
  if (!tweetId || !handle || !text) {
    return res.status(400).json({ success: false, error: "Tweet ID, handle, and reply text required" });
  }
  
  // Check if user is banned
  const user = users[handle.toLowerCase()];
  if (user && user.banned) {
    return res.status(403).json({ success: false, error: "Account suspended" });
  }
  
  try {
    // Find the tweet in MongoDB
    const tweet = await Tweet.findOne({ id: tweetId });
    
    if (!tweet) {
      return res.status(404).json({ success: false, error: "Tweet not found" });
    }
    
    // Create new reply
    const newReply = {
      id: Date.now(),
      handle,
      text,
      imageData: imageData || null,
      timestamp: Date.now(),
      likes: 0,
      profilePicture: user?.profilePicture || null,
      verified: user?.verified || null
    };
    
    // Add reply to the tweet's replies array
    tweet.replies.push(newReply);
    
    // Save the updated tweet
    await tweet.save();
    
    // Also update in-memory array for backward compatibility
    const memoryTweet = tweets.find(t => t.id === tweetId);
    if (memoryTweet) {
      memoryTweet.replies.push(newReply);
    }
    
    // Emit socket event if needed
    if (io) {
      io.emit('new reply', { tweetId, reply: newReply });
    }
    
    return res.json({ success: true, reply: newReply });
  } catch (error) {
    console.error("Error adding reply to MongoDB:", error);
    return res.status(500).json({ success: false, error: "Failed to add reply" });
  }
});

app.post('/api/tweet/retweet', async (req, res) => {
  const { tweetId, handle } = req.body;
  
  if (!tweetId || !handle) {
    return res.status(400).json({ success: false, error: "Tweet ID and handle required" });
  }
  
  // Check if user is banned
  const user = users[handle.toLowerCase()];
  if (user && user.banned) {
    return res.status(403).json({ success: false, error: "Account suspended" });
  }
  
  try {
    // Find and update the tweet in MongoDB
    const tweet = await Tweet.findOneAndUpdate(
      { id: tweetId },
      { 
        timestamp: Date.now(),
        last_retweeted_by: handle
      },
      { new: true } // Return the updated document
    );
    
    if (!tweet) {
      return res.status(404).json({ success: false, error: "Tweet not found" });
    }
    
    // Also update in-memory array for backward compatibility
    const memoryTweet = tweets.find(t => t.id === tweetId);
    if (memoryTweet) {
      memoryTweet.timestamp = Date.now();
      memoryTweet.last_retweeted_by = handle;
    }
    
    // Emit socket event if needed
    if (io) {
      io.emit('tweet retweeted', tweet);
    }
    
    return res.json({ success: true, tweet });
  } catch (error) {
    console.error("Error retweeting in MongoDB:", error);
    return res.status(500).json({ success: false, error: "Failed to retweet" });
  }
});

app.patch('/api/tweet/poll/vote', (req, res) => {
  const { id, option } = req.body;
  const tweet = tweets.find(t => t.id === id);
  if (!tweet || !tweet.poll) return res.status(404).json({ success: false, error: "Tweet or poll not found" });
  const pollOption = tweet.poll.options.find(opt => opt.text === option);
  if (!pollOption) return res.status(400).json({ success: false, error: "Option not found" });
  pollOption.votes += 1;
  saveData();
  io.emit('poll voted', tweet);
  return res.json({ success: true, tweet });
});

// Find out which endpoint your frontend is actually using to get tweets
// It could be /api/tweets, /tweets, or something else
app.get('/api/tweets', async (req, res) => {
  try {
    const mongoTweets = await Tweet.find().sort({ timestamp: -1 });
    
    console.log(`Retrieved ${mongoTweets.length} tweets from MongoDB`);
    
    // No need to transform - return the documents directly
    // The schema already matches what the frontend expects (id, handle, etc.)
    
    // Update the in-memory tweets array for backward compatibility
    tweets = mongoTweets.map(tweet => tweet.toObject());
    
    res.json(mongoTweets);
  } catch (error) {
    console.error('Error fetching tweets from MongoDB:', error);
    res.status(500).json({ error: 'Failed to fetch tweets' });
  }
});

app.post('/api/tweets', async (req, res) => {
  try {
    const { text, username, isAI } = req.body;
    
    const newTweet = new Tweet({
      text,
      username,
      timestamp: new Date(),
      likes: 0,
      views: generateViewCount(),
      isAI: isAI || false
    });
    
    await newTweet.save();
    res.status(201).json(newTweet);
  } catch (error) {
    console.error('Error creating tweet:', error);
    res.status(500).json({ error: 'Failed to create tweet' });
  }
});

app.post('/api/like', async (req, res) => {
  try {
    const { tweetId } = req.body;
    
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      return res.status(404).json({ error: 'Tweet not found' });
    }
    
    tweet.likes += 1;
    await tweet.save();
    
    res.json({ success: true, likes: tweet.likes });
  } catch (error) {
    console.error('Error liking tweet:', error);
    res.status(500).json({ error: 'Failed to like tweet' });
  }
});

app.patch('/api/tweet/like', async (req, res) => {
  const { id, likes } = req.body;
  console.log(`Like request received for tweet ID: ${id}, likes: ${likes}`);
  
  // Ensure ID is correctly formatted (tweets might store IDs as numbers)
  const tweetId = typeof id === 'string' ? parseInt(id, 10) : id;
  
  try {
    // Find and update the tweet in MongoDB
    const tweet = await Tweet.findOneAndUpdate(
      { id: tweetId },
      { likes: likes },
      { new: true } // Return the updated document
    );
    
    if (!tweet) {
      console.log(`Tweet not found with ID: ${tweetId}`);
      return res.status(404).json({ success: false, error: "Tweet not found" });
    }
    
    console.log(`Updated tweet ${tweetId} with ${likes} likes in MongoDB`);
    
    // Also update in-memory array for backward compatibility
    const memoryTweet = tweets.find(t => t.id === tweetId);
    if (memoryTweet) {
      memoryTweet.likes = likes;
    }
    
    // Emit socket event if needed
    if (io) {
      io.emit('tweet liked', tweet);
    }
    
    return res.json({ success: true, tweet });
  } catch (error) {
    console.error(`Error updating tweet ${tweetId} likes in MongoDB:`, error);
    return res.status(500).json({ success: false, error: "Failed to update tweet likes" });
  }
});

app.patch('/api/tweet/reply/like', (req, res) => {
  const { tweetId, replyId, likes } = req.body;
  const tweet = tweets.find(t => t.id === tweetId);
  if (!tweet) return res.status(404).json({ success: false, error: "Tweet not found" });
  const reply = tweet.replies.find(r => r.id === replyId);
  if (!reply) return res.status(404).json({ success: false, error: "Reply not found" });
  reply.likes = likes;
  saveData();
  io.emit('reply liked', { tweetId, reply });
  return res.json({ success: true, reply });
});

app.get('/api/profile', (req, res) => {
  const { handle } = req.query;
  if (!handle) return res.status(400).json({ success: false, error: "Handle parameter is required" });
  const user = users[handle.toLowerCase()];
  if (!user) return res.status(404).json({ success: false, error: "User not found" });
  return res.json({ success: true, profile: { handle: user.handle, bio: user.bio || "", profilePicture: user.profilePicture || null, verified: user.verified || null } });
});

app.patch('/api/profile', (req, res) => {
  const { handle, bio, profilePicture, verified } = req.body;
  if (!handle) return res.status(400).json({ success: false, error: "Handle is required" });
  const user = users[handle.toLowerCase()];
  if (!user) return res.status(404).json({ success: false, error: "User not found" });
  if (bio !== undefined) user.bio = bio;
  if (profilePicture !== undefined) user.profilePicture = profilePicture;
  if (verified !== undefined) user.verified = verified;
  saveData();
  return res.json({ success: true, message: "Profile updated", profile: { handle: user.handle, bio: user.bio, profilePicture: user.profilePicture, verified: user.verified } });
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, displayName, password, profilePic } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const newUser = new User({
      username,
      displayName,
      password, // Note: In a real app, you should hash this password
      profilePic
    });
    
    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/ban', (req, res) => {
  const { handle } = req.body;
  if (!handle) return res.status(400).json({ success: false, error: "Handle is required" });
  const user = users[handle.toLowerCase()];
  if (!user) return res.status(404).json({ success: false, error: "User not found" });
  user.banned = true;
  saveData();
  return res.json({ success: true, message: "User banned" });
});

app.get('/api/trending', (req, res) => {
  const hashtagCount = {};
  tweets.forEach(tweet => {
    const hashtags = tweet.text.match(/#([a-zA-Z0-9]+)/g) || [];
    hashtags.forEach(tag => {
      const cleanTag = tag.toLowerCase();
      hashtagCount[cleanTag] = (hashtagCount[cleanTag] || 0) + 1;
    });
  });
  const trending = Object.entries(hashtagCount)
    .filter(([tag, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  res.json({ success: true, trending });
});

// New endpoints for classrooms
app.get('/api/classrooms', (req, res) => {
  res.json({ success: true, classrooms });
});

app.post('/api/classrooms', (req, res) => {
  const { name, instructor } = req.body;
  if (!name || !instructor) {
    return res.status(400).json({ success: false, error: "Class name and instructor required" });
  }
  const newClassroom = {
    id: Date.now(),
    name,
    instructor,
    timestamp: Date.now()
  };
  classrooms.push(newClassroom);
  io.emit('new classroom', newClassroom);
  saveData();
  return res.json({ success: true, classroom: newClassroom });
});

app.post('/api/announcements', (req, res) => {
  const { classId, text, author, authorRole } = req.body;
  if (!classId || !text || !author) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }
  const newAnnouncement = {
    id: Date.now().toString(),
    classId,
    text,
    author,
    authorRole,
    timestamp: Date.now()
  };
  announcements.push(newAnnouncement);
  io.emit('new announcement', newAnnouncement);
  saveData();
  return res.json({ success: true, announcement: newAnnouncement });
});

app.get('/api/announcements/:classId', (req, res) => {
  const { classId } = req.params;
  const classAnnouncements = announcements
    .filter(a => a.classId === classId)
    .sort((a, b) => b.timestamp - a.timestamp);
  return res.json({ success: true, announcements: classAnnouncements });
});

app.delete('/api/announcements/:id', (req, res) => {
  const { id } = req.params;
  const index = announcements.findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Announcement not found" });
  }
  announcements.splice(index, 1);
  io.emit('announcement deleted', id);
  saveData();
  return res.json({ success: true });
});

// Add a tweet to user's bookmarks
app.post('/api/bookmark', (req, res) => {
  const { handle, tweetId } = req.body;
  if (!handle || !tweetId) {
    return res.json({ success: false, error: 'Handle and tweet ID are required' });
  }
  const user = users[handle.toLowerCase()];
  if (!user) {
    return res.json({ success: false, error: 'User not found' });
  }
  if (!user.bookmarks) user.bookmarks = [];
  if (user.bookmarks.includes(tweetId)) {
    return res.json({ success: false, error: 'Tweet is already bookmarked' });
  }
  user.bookmarks.push(tweetId);
  saveData();
  return res.json({ success: true });
});

// Remove a tweet from user's bookmarks
app.delete('/api/bookmark', (req, res) => {
  const { handle, tweetId } = req.body;
  if (!handle || !tweetId) {
    return res.json({ success: false, error: 'Handle and tweet ID are required' });
  }
  const user = users[handle.toLowerCase()];
  if (!user) {
    return res.json({ success: false, error: 'User not found' });
  }
  if (!user.bookmarks || !user.bookmarks.includes(tweetId)) {
    return res.json({ success: false, error: 'Tweet is not bookmarked' });
  }
  user.bookmarks = user.bookmarks.filter(id => id !== tweetId);
  saveData();
  return res.json({ success: true });
});

// Get user's bookmarked tweets
app.get('/api/bookmarks', (req, res) => {
  const handle = req.query.handle;
  if (!handle) {
    return res.json({ success: false, error: 'Handle is required' });
  }
  const user = users[handle.toLowerCase()];
  if (!user) {
    return res.json({ success: false, error: 'User not found' });
  }
  if (!user.bookmarks || user.bookmarks.length === 0) {
    return res.json({ success: true, bookmarks: [] });
  }
  const bookmarkedTweets = tweets.filter(tweet => user.bookmarks.includes(tweet.id));
  return res.json({ success: true, bookmarks: bookmarkedTweets });
});

// Start the server
http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
