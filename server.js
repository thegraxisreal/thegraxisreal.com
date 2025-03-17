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

// Update file paths to use the persistent disk
const USERS_FILE = process.env.NODE_ENV === 'production' 
  ? '/data/users.json' 
  : './users.json';
  
const TWEETS_FILE = process.env.NODE_ENV === 'production'
  ? '/data/tweets.json'
  : './tweets.json';

// Log the actual paths being used
console.log('Using file paths:');
console.log('- USERS_FILE:', USERS_FILE);
console.log('- TWEETS_FILE:', TWEETS_FILE);

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

// Function to save data to JSON files
async function saveData() {
  console.log('Saving data to JSON files...');
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    console.log(`Saved ${Object.keys(users).length} users to ${USERS_FILE}`);
    
    await fs.writeFile(TWEETS_FILE, JSON.stringify(tweets, null, 2));
    console.log(`Saved ${tweets.length} tweets to ${TWEETS_FILE}`);
    
    await fs.writeFile('classrooms.json', JSON.stringify(classrooms, null, 2));
    await fs.writeFile('announcements.json', JSON.stringify(announcements, null, 2));
    console.log('Data auto-saved to JSON files');
    
    // Verify the files were saved correctly
    try {
      const savedUsersData = await fs.readFile(USERS_FILE, 'utf8');
      const savedUsers = JSON.parse(savedUsersData);
      console.log(`Verified: ${Object.keys(savedUsers).length} users in ${USERS_FILE}`);
    } catch (err) {
      console.error(`Error verifying ${USERS_FILE}:`, err);
    }
    
    try {
      const savedTweetsData = await fs.readFile(TWEETS_FILE, 'utf8');
      const savedTweets = JSON.parse(savedTweetsData);
      console.log(`Verified: ${savedTweets.length} tweets in ${TWEETS_FILE}`);
    } catch (err) {
      console.error(`Error verifying ${TWEETS_FILE}:`, err);
    }
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

// Ensure data files exist on the persistent disk
async function ensureDataFilesExist() {
  try {
    // Check if users file exists, create if not
    try {
      await fs.access(USERS_FILE);
    } catch {
      await fs.writeFile(USERS_FILE, JSON.stringify({}));
      console.log(`Created empty ${USERS_FILE}`);
    }
    
    // Check if tweets file exists, create if not
    try {
      await fs.access(TWEETS_FILE);
    } catch {
      await fs.writeFile(TWEETS_FILE, JSON.stringify([]));
      console.log(`Created empty ${TWEETS_FILE}`);
    }
  } catch (err) {
    console.error('Error ensuring data files exist:', err);
  }
}

// Function to load data from JSON files with better error handling
async function loadData() {
  try {
    // Check if users.json exists, if not create empty object
    try {
      const usersData = await fs.readFile(USERS_FILE, 'utf8');
      users = JSON.parse(usersData);
      console.log(`Loaded ${Object.keys(users).length} users from ${USERS_FILE}`);
    } catch (error) {
      console.log(`${USERS_FILE} not found or invalid, creating empty users object`);
      users = {};
      await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    }
    
    // Check if tweets.json exists, if not create empty array
    try {
      const tweetsData = await fs.readFile(TWEETS_FILE, 'utf8');
      tweets = JSON.parse(tweetsData);
      console.log(`Loaded ${tweets.length} tweets from ${TWEETS_FILE}`);
      // Log the first tweet for debugging
      if (tweets.length > 0) {
        console.log('First tweet:', JSON.stringify(tweets[0]).substring(0, 200) + '...');
      }
      
      // ONLY add a sample tweet if the file was newly created (not if it exists but is empty)
      // This prevents overwriting user-uploaded files
    } catch (error) {
      console.log(`${TWEETS_FILE} not found or invalid, creating empty tweets array`);
      tweets = [];
      await fs.writeFile(TWEETS_FILE, JSON.stringify(tweets, null, 2));
      
      // Only add sample tweet if we had to create a new file
      console.log('Adding a sample tweet to the newly created tweets file...');
      const sampleTweet = {
        id: Date.now(),
        handle: "system",
        text: "Welcome to our platform! This is a sample tweet to get you started.",
        timestamp: Date.now(),
        likes: 0,
        replies: [],
        views: "123",
        profilePicture: null 
      };
      tweets.push(sampleTweet);
      await fs.writeFile(TWEETS_FILE, JSON.stringify(tweets, null, 2));
      console.log('Added sample tweet:', sampleTweet);
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

// Add this function to copy from GitHub files on first run
async function initializeFromGitHub() {
  try {
    // Check if persistent files exist
    let needsUsersCopy = false;
    let needsTweetsCopy = false;
    
    try {
      await fs.access(USERS_FILE);
      console.log(`${USERS_FILE} already exists`);
    } catch {
      needsUsersCopy = true;
    }
    
    try {
      await fs.access(TWEETS_FILE);
      console.log(`${TWEETS_FILE} already exists`);
    } catch {
      needsTweetsCopy = true;
    }
    
    // Copy users if needed
    if (needsUsersCopy) {
      console.log('Copying users from GitHub version');
      const githubUsers = await fs.readFile('./users.json', 'utf8');
      await fs.writeFile(USERS_FILE, githubUsers);
    }
    
    // Copy tweets if needed
    if (needsTweetsCopy) {
      console.log('Copying tweets from GitHub version');
      const githubTweets = await fs.readFile('./tweets.json', 'utf8');
      await fs.writeFile(TWEETS_FILE, githubTweets);
    }
  } catch (err) {
    console.error('Error initializing from GitHub:', err);
  }
}

// Call this before starting your server
debugFileSystem().then(() => {
  ensureDataFilesExist().then(() => {
    // Start your server here
    // Load data before starting the server
    initializeFromGitHub().then(() => {
      loadData().then(() => {  // Make sure loadData completes before continuing
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
            return Math.floor(Math.random() * 901);
          } else if (roll < 66.66) { // ~33.33% chance for medium tweet (1k-500k)
            const views = Math.floor(Math.random() * 499000) + 1000;
            return Math.floor(views / 1000) + 'K';
          } else { // ~33.33% chance for big tweet (500k-100M)
            const views = Math.floor(Math.random() * 99500000) + 500000;
            return Math.floor(views / 1000000) + 'M';
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
                usersFile: USERS_FILE,
                tweetsFile: TWEETS_FILE
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
              await fs.writeFile(USERS_FILE, JSON.stringify(req.body.users, null, 2));
              console.log(`Imported ${Object.keys(req.body.users).length} users`);
            }
            
            if (req.body.tweets) {
              await fs.writeFile(TWEETS_FILE, JSON.stringify(req.body.tweets, null, 2));
              console.log(`Imported ${req.body.tweets.length} tweets`);
            }
            
            res.json({ success: true, message: 'Data imported successfully' });
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
});
