const express = require('express');
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path'); // Added for file paths
const app = express();
const PORT = process.env.PORT || 10000;

// Debug helper function
async function debugFileSystem() {
  console.log('========== DEBUG FILE SYSTEM ==========');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('Current directory:', __dirname);
  
  try {
    console.log('Files in current directory:');
    const files = await fs.readdir('.');
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        console.log(`- ${file} (${stats.size} bytes, ${stats.isDirectory() ? 'directory' : 'file'})`);
      } catch (err) {
        console.log(`- ${file} (error getting stats: ${err.message})`);
      }
    }
  } catch (err) {
    console.log('Error reading current directory:', err.message);
  }
  
  try {
    console.log('Files in /data directory:');
    const dataFiles = await fs.readdir('/data');
    for (const file of dataFiles) {
      try {
        const stats = await fs.stat(`/data/${file}`);
        console.log(`- ${file} (${stats.size} bytes, ${stats.isDirectory() ? 'directory' : 'file'})`);
      } catch (err) {
        console.log(`- ${file} (error getting stats: ${err.message})`);
      }
    }
  } catch (err) {
    console.log('Error reading /data directory:', err.message);
  }
  
  // Check file contents
  try {
    const usersData = await fs.readFile('./users.json', 'utf8');
    const users = JSON.parse(usersData);
    console.log(`./users.json: ${usersData.length} chars, ${Object.keys(users).length} users`);
  } catch (err) {
    console.log('./users.json error:', err.message);
  }
  
  try {
    const tweetsData = await fs.readFile('./tweets.json', 'utf8');
    const tweets = JSON.parse(tweetsData);
    console.log(`./tweets.json: ${tweetsData.length} chars, ${tweets.length} tweets`);
  } catch (err) {
    console.log('./tweets.json error:', err.message);
  }
  
  try {
    const usersData = await fs.readFile('/data/users.json', 'utf8');
    const users = JSON.parse(usersData);
    console.log(`/data/users.json: ${usersData.length} chars, ${Object.keys(users).length} users`);
  } catch (err) {
    console.log('/data/users.json error:', err.message);
  }
  
  try {
    const tweetsData = await fs.readFile('/data/tweets.json', 'utf8');
    const tweets = JSON.parse(tweetsData);
    console.log(`/data/tweets.json: ${tweetsData.length} chars, ${tweets.length} tweets`);
  } catch (err) {
    console.log('/data/tweets.json error:', err.message);
  }
  
  console.log('========== END DEBUG ==========');
}

// Use persistent disk storage for production
const ORIGINAL_USERS_FILE = './users.json';  // Original from GitHub, never modified
const ORIGINAL_TWEETS_FILE = './tweets.json'; // Original from GitHub, never modified

// Files for new data
const NEW_USERS_FILE = process.env.NODE_ENV === 'production' 
  ? '/data/newusers.json' 
  : './newusers.json';
  
const NEW_TWEETS_FILE = process.env.NODE_ENV === 'production'
  ? '/data/newtweets.json'
  : './newtweets.json';

// Log the file paths being used
console.log('Using file paths:');
console.log('- ORIGINAL_USERS_FILE:', ORIGINAL_USERS_FILE);
console.log('- ORIGINAL_TWEETS_FILE:', ORIGINAL_TWEETS_FILE);
console.log('- NEW_USERS_FILE:', NEW_USERS_FILE);
console.log('- NEW_TWEETS_FILE:', NEW_TWEETS_FILE);

app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from public
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Add an upload page for importing data
app.get('/admin/upload', (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Import Data to Render</title>
    <style>
      body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; }
      .container { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
      button { padding: 10px 15px; background: #4CAF50; color: white; border: none; cursor: pointer; }
      #result { margin-top: 20px; padding: 10px; background: #f5f5f5; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <h1>Import Data to Render</h1>
    
    <div class="container">
      <h2>Select Files</h2>
      <form id="uploadForm">
        <div>
          <label for="usersFile">users.json:</label>
          <input type="file" id="usersFile" name="usersFile">
        </div>
        <div style="margin-top: 10px;">
          <label for="tweetsFile">tweets.json:</label>
          <input type="file" id="tweetsFile" name="tweetsFile">
        </div>
        <button type="button" onclick="importData()" style="margin-top: 15px;">Import Data</button>
      </form>
    </div>
    
    <div id="result"></div>
    
    <script>
      async function importData() {
        document.getElementById('result').textContent = 'Importing data...';
        
        const data = {};
        
        // Read users file if selected
        const usersFile = document.getElementById('usersFile').files[0];
        if (usersFile) {
          try {
            const usersText = await usersFile.text();
            data.users = JSON.parse(usersText);
            console.log(\`Loaded \${Object.keys(data.users).length} users\`);
          } catch (error) {
            document.getElementById('result').textContent = \`Error parsing users.json: \${error.message}\`;
            return;
          }
        }
        
        // Read tweets file if selected
        const tweetsFile = document.getElementById('tweetsFile').files[0];
        if (tweetsFile) {
          try {
            const tweetsText = await tweetsFile.text();
            data.tweets = JSON.parse(tweetsText);
            console.log(\`Loaded \${data.tweets.length} tweets\`);
          } catch (error) {
            document.getElementById('result').textContent = \`Error parsing tweets.json: \${error.message}\`;
            return;
          }
        }
        
        if (!data.users && !data.tweets) {
          document.getElementById('result').textContent = 'No files selected';
          return;
        }
        
        try {
          // Send to server
          const response = await fetch('/admin/import-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          });
          
          const result = await response.json();
          document.getElementById('result').textContent = 'Import result:\\n' + JSON.stringify(result, null, 2);
        } catch (error) {
          document.getElementById('result').textContent = \`Error sending data: \${error.message}\`;
        }
      }
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

// In-memory storage (will be loaded from/saved to files)
let users = {};
let tweets = [];
let classrooms = [];
let announcements = [];

// Variables to track original data
let originalUsers = {};
let originalTweetIds = new Set();

// Function to save data to JSON files - only saves NEW data, not original
async function saveData() {
  console.log('Saving data to JSON files...');
  try {
    // Only save new users (we don't modify the original users.json)
    let newUsers = {};
    for (const [handle, userData] of Object.entries(users)) {
      // Skip any users that were in the original file - we only save new ones
      if (!originalUsers[handle.toLowerCase()]) {
        newUsers[handle.toLowerCase()] = userData;
      }
    }
    
    await fs.writeFile(NEW_USERS_FILE, JSON.stringify(newUsers, null, 2));
    console.log(`Saved ${Object.keys(newUsers).length} new users to ${NEW_USERS_FILE}`);
    
    // Only save new tweets (we don't modify the original tweets.json)
    const newTweets = tweets.filter(tweet => !originalTweetIds.has(tweet.id));
    await fs.writeFile(NEW_TWEETS_FILE, JSON.stringify(newTweets, null, 2));
    console.log(`Saved ${newTweets.length} new tweets to ${NEW_TWEETS_FILE}`);
    
    await fs.writeFile('classrooms.json', JSON.stringify(classrooms, null, 2));
    await fs.writeFile('announcements.json', JSON.stringify(announcements, null, 2));
    console.log('Data auto-saved to JSON files');
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

// Ensure data files exist
async function ensureDataFilesExist() {
  try {
    // Check if new users file exists, create if not
    try {
      await fs.access(NEW_USERS_FILE);
      console.log(`${NEW_USERS_FILE} exists`);
    } catch {
      console.log(`${NEW_USERS_FILE} not found, creating empty file`);
      await fs.writeFile(NEW_USERS_FILE, JSON.stringify({}));
    }
    
    // Check if new tweets file exists, create if not
    try {
      await fs.access(NEW_TWEETS_FILE);
      console.log(`${NEW_TWEETS_FILE} exists`);
    } catch {
      console.log(`${NEW_TWEETS_FILE} not found, creating empty file`);
      await fs.writeFile(NEW_TWEETS_FILE, JSON.stringify([]));
    }
  } catch (err) {
    console.error('Error ensuring data files exist:', err);
  }
}

// Function to load data from JSON files with better error handling
async function loadData() {
  try {
    // First load original users (from GitHub)
    try {
      const originalUsersData = await fs.readFile(ORIGINAL_USERS_FILE, 'utf8');
      originalUsers = JSON.parse(originalUsersData);
      console.log(`Loaded ${Object.keys(originalUsers).length} original users from ${ORIGINAL_USERS_FILE}`);
      
      // Start with original users
      users = {...originalUsers};
    } catch (error) {
      console.log(`${ORIGINAL_USERS_FILE} not found or invalid, starting with empty users`);
      originalUsers = {};
      users = {};
    }
    
    // Then load new users and merge them in
    try {
      const newUsersData = await fs.readFile(NEW_USERS_FILE, 'utf8');
      const newUsers = JSON.parse(newUsersData);
      console.log(`Loaded ${Object.keys(newUsers).length} new users from ${NEW_USERS_FILE}`);
      
      // Merge new users - they override original users with same handle
      users = {...users, ...newUsers};
      console.log(`Total users after merge: ${Object.keys(users).length}`);
    } catch (error) {
      console.log(`${NEW_USERS_FILE} not found or invalid, continuing with original users only`);
    }
    
    // First load original tweets (from GitHub)
    try {
      const originalTweetsData = await fs.readFile(ORIGINAL_TWEETS_FILE, 'utf8');
      const originalTweets = JSON.parse(originalTweetsData);
      console.log(`Loaded ${originalTweets.length} original tweets from ${ORIGINAL_TWEETS_FILE}`);
      
      // Start with original tweets
      tweets = [...originalTweets];
      
      // Track IDs of original tweets to avoid duplicates later
      originalTweets.forEach(tweet => originalTweetIds.add(tweet.id));
      
      if (originalTweets.length > 0) {
        console.log('First original tweet:', JSON.stringify(originalTweets[0]).substring(0, 200) + '...');
      }
    } catch (error) {
      console.log(`${ORIGINAL_TWEETS_FILE} not found or invalid, starting with empty tweets`);
      tweets = [];
      originalTweetIds = new Set();
    }
    
    // Then load new tweets and merge them in
    try {
      const newTweetsData = await fs.readFile(NEW_TWEETS_FILE, 'utf8');
      const newTweets = JSON.parse(newTweetsData);
      console.log(`Loaded ${newTweets.length} new tweets from ${NEW_TWEETS_FILE}`);
      
      // Add new tweets to the collection
      tweets = [...tweets, ...newTweets];
      console.log(`Total tweets after merge: ${tweets.length}`);
      
      if (newTweets.length > 0) {
        console.log('First new tweet:', JSON.stringify(newTweets[0]).substring(0, 200) + '...');
      }
    } catch (error) {
      console.log(`${NEW_TWEETS_FILE} not found or invalid, continuing with original tweets only`);
    }
    
    // Load classrooms and announcements
    try {
      const classroomsData = await fs.readFile('classrooms.json', 'utf8');
      classrooms = JSON.parse(classroomsData);
      console.log('Classrooms loaded from classrooms.json');
    } catch (error) {
      console.log('classrooms.json not found or invalid, creating empty classrooms array');
      classrooms = [];
      await fs.writeFile('classrooms.json', JSON.stringify(classrooms, null, 2));
    }
    
    try {
      const announcementsData = await fs.readFile('announcements.json', 'utf8');
      announcements = JSON.parse(announcementsData);
      console.log('Announcements loaded from announcements.json');
    } catch (error) {
      console.log('announcements.json not found or invalid, creating empty announcements array');
      announcements = [];
      await fs.writeFile('announcements.json', JSON.stringify(announcements, null, 2));
    }
    
  } catch (err) {
    console.error('Error in loadData function:', err);
  }
}

// Call this before starting your server
debugFileSystem().then(() => {
  ensureDataFilesExist().then(() => {
    loadData().then(() => {
      console.log("Data loading complete, starting server...");
      
      // Debug the loaded data
      console.log(`Loaded ${Object.keys(users).length} users and ${tweets.length} tweets into memory`);
      if (tweets.length > 0) {
        console.log('First tweet:', JSON.stringify(tweets[0]).substring(0, 200) + '...');
      }
      
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
        const roll = Math.random() * 100; // Roll 0-100
        
        if (roll < 33.33) { // ~33.33% chance for small tweet (0-900 views)
          return Math.floor(Math.random() * 901).toString(); // Return as string for consistency
        } else if (roll < 66.66) { // ~33.33% chance for medium tweet (1k-500k)
          const views = Math.floor(Math.random() * 499000) + 1000;
          return Math.floor(views / 1000) + 'K'; // Convert to K format (e.g., 5K)
        } else { // ~33.33% chance for big tweet (500k-100M)
          const views = Math.floor(Math.random() * 99500000) + 500000;
          const millionViews = views / 1000000;
          // Ensure we're dealing with a valid number and format to 1 decimal place
          return (Math.floor(millionViews * 10) / 10).toFixed(1) + 'M'; // Convert to M format with 1 decimal (e.g., 2.5M)
        }
      }

      // Update the /api/tweet endpoint
      app.post('/api/tweet', (req, res) => {
        console.log("Received /api/tweet request:", req.body);
        const { handle, text, imageData, quotedTweet, poll } = req.body;
        if (!handle || (!text && !quotedTweet && !poll)) {
          console.log("Validation failed: Missing handle or content");
          return res.status(400).json({ success: false, error: "Handle and either text, quoted tweet, or poll required" });
        }
        const user = users[handle.toLowerCase()];
        if (user.banned) {
          console.log("User banned:", handle);
          return res.status(403).json({ success: false, error: "Account suspended" });
        }
        const newTweet = {
          id: Date.now(),
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
        };
        tweets.push(newTweet);
        saveData();
        io.emit('new tweet', newTweet);
        console.log("Tweet saved:", newTweet);
        return res.json({ success: true, tweet: newTweet });
      });

      app.post('/api/tweet/reply', (req, res) => {
        const { tweetId, handle, text, imageData } = req.body;
        if (!tweetId || !handle || !text) return res.status(400).json({ success: false, error: "Tweet ID, handle, and reply text required" });
        const tweet = tweets.find(t => t.id === tweetId);
        if (!tweet) return res.status(404).json({ success: false, error: "Tweet not found" });
        const user = users[handle.toLowerCase()];
        if (user.banned) return res.status(403).json({ success: false, error: "Account suspended" });
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
        tweet.replies.push(newReply);
        saveData();
        io.emit('new reply', { tweetId, reply: newReply });
        return res.json({ success: true, reply: newReply });
      });

      app.post('/api/tweet/retweet', (req, res) => {
        const { tweetId, handle } = req.body;
        if (!tweetId || !handle) return res.status(400).json({ success: false, error: "Tweet ID and handle required" });
        const tweet = tweets.find(t => t.id === tweetId);
        if (!tweet) return res.status(404).json({ success: false, error: "Tweet not found" });
        const user = users[handle.toLowerCase()];
        if (user.banned) return res.status(403).json({ success: false, error: "Account suspended" });
        tweet.timestamp = Date.now();
        tweet.last_retweeted_by = handle;
        saveData();
        io.emit('tweet retweeted', tweet);
        return res.json({ success: true, tweet });
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

      // Make API endpoint for getting tweets more robust with better logging
      app.get('/api/tweets', (req, res) => {
        console.log(`GET /api/tweets: Returning ${tweets.length} tweets`);
        
        try {
          if (!Array.isArray(tweets)) {
            console.error('ERROR: tweets is not an array:', typeof tweets);
            return res.json({ tweets: [] });
          }
          
          const enrichedTweets = tweets.map(tweet => {
            console.log(`Processing tweet by ${tweet.handle}`);
            return {
              ...tweet,
              profilePicture: users[tweet.handle.toLowerCase()]?.profilePicture || null,
              verified: users[tweet.handle.toLowerCase()]?.verified || null,
              replies: Array.isArray(tweet.replies) ? tweet.replies.map(reply => ({
                ...reply,
                profilePicture: users[reply.handle?.toLowerCase()]?.profilePicture || null,
                verified: users[reply.handle?.toLowerCase()]?.verified || null
              })) : [],
              quotedTweet: tweet.quotedTweet ? {
                ...tweet.quotedTweet,
                profilePicture: users[tweet.quotedTweet.handle?.toLowerCase()]?.profilePicture || null,
                verified: users[tweet.quotedTweet.handle?.toLowerCase()]?.verified || null
              } : null
            };
          });
          
          const sortedTweets = enrichedTweets.sort((a, b) => b.timestamp - a.timestamp);
          console.log(`Returning ${sortedTweets.length} enriched tweets`);
          
          return res.json({ success: true, tweets: sortedTweets });
        } catch (error) {
          console.error('Error in /api/tweets:', error);
          return res.json({ success: false, tweets: [], error: error.message });
        }
      });

      app.patch('/api/tweet/like', (req, res) => {
        const { id, likes } = req.body;
        console.log(`Like request received for tweet ID: ${id}, likes: ${likes}`);
        
        // Ensure ID is correctly formatted (tweets might store IDs as numbers)
        const tweetId = typeof id === 'string' ? parseInt(id, 10) : id;
        
        const tweet = tweets.find(t => t.id === tweetId);
        if (!tweet) {
          console.log(`Tweet not found with ID: ${tweetId}`);
          return res.status(404).json({ success: false, error: "Tweet not found" });
        }
        
        tweet.likes = likes;
        console.log(`Updated tweet ${tweetId} with ${likes} likes`);
        
        saveData();
        io.emit('tweet liked', tweet);
        return res.json({ success: true, tweet });
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

      app.get('/api/users', (req, res) => {
        const userList = Object.values(users).map(user => ({
          handle: user.handle,
          password: user.password,
          banned: user.banned
        }));
        res.json({ success: true, users: userList });
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

      // Debug endpoint to check and fix data issues
      app.get('/admin/debug', async (req, res) => {
        try {
          await debugFileSystem();
          
          const result = {
            environment: process.env.NODE_ENV || 'development',
            filePaths: {
              usersFile: NEW_USERS_FILE,
              tweetsFile: NEW_TWEETS_FILE
            },
            memoryData: {
              usersCount: Object.keys(users).length,
              tweetsCount: tweets.length,
              firstTweet: tweets.length > 0 ? {
                id: tweets[0].id,
                handle: tweets[0].handle,
                text: tweets[0].text.substring(0, 100) + (tweets[0].text.length > 100 ? '...' : '')
              } : null
            },
            action: req.query.action || null
          };
          
          // Perform requested action if any
          if (req.query.action === 'force-save') {
            await saveData();
            result.actionResult = 'Forced save completed';
          }
          else if (req.query.action === 'reload') {
            await loadData();
            result.actionResult = 'Reloaded data from disk';
            result.memoryData = {
              usersCount: Object.keys(users).length,
              tweetsCount: tweets.length,
              firstTweet: tweets.length > 0 ? {
                id: tweets[0].id,
                handle: tweets[0].handle,
                text: tweets[0].text.substring(0, 100) + (tweets[0].text.length > 100 ? '...' : '')
              } : null
            };
          }
          
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message, stack: error.stack });
        }
      });

      // TEMPORARY ENDPOINT - REMOVE AFTER USING!
      app.post('/admin/import-data', express.json({limit: '50mb'}), async (req, res) => {
        try {
          if (req.body.users) {
            await fs.writeFile(NEW_USERS_FILE, JSON.stringify(req.body.users, null, 2));
            console.log(`Imported ${Object.keys(req.body.users).length} users to ${NEW_USERS_FILE}`);
            users = req.body.users; // Update in-memory data immediately
          }
          
          if (req.body.tweets) {
            await fs.writeFile(NEW_TWEETS_FILE, JSON.stringify(req.body.tweets, null, 2));
            console.log(`Imported ${req.body.tweets.length} tweets to ${NEW_TWEETS_FILE}`);
            tweets = req.body.tweets; // Update in-memory data immediately
          }
          
          // Verify the files were saved correctly
          try {
            const savedUsersData = await fs.readFile(NEW_USERS_FILE, 'utf8');
            const savedUsers = JSON.parse(savedUsersData);
            console.log(`Verified: ${Object.keys(savedUsers).length} users in ${NEW_USERS_FILE}`);
          } catch (err) {
            console.error(`Error verifying ${NEW_USERS_FILE}:`, err);
          }
          
          try {
            const savedTweetsData = await fs.readFile(NEW_TWEETS_FILE, 'utf8');
            const savedTweets = JSON.parse(savedTweetsData);
            console.log(`Verified: ${savedTweets.length} tweets in ${NEW_TWEETS_FILE}`);
          } catch (err) {
            console.error(`Error verifying ${NEW_TWEETS_FILE}:`, err);
          }
          
          res.json({ 
            success: true, 
            message: 'Data imported successfully',
            location: NEW_USERS_FILE,
            usersCount: Object.keys(req.body.users || {}).length,
            tweetsCount: (req.body.tweets || []).length
          });
        } catch (error) {
          console.error('Error importing data:', error);
          res.status(500).json({ success: false, error: error.message });
        }
      });

      // Start the server
      http.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    });
  });
});
