const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const os = require('os');

const app = express();
app.use(cors(), express.json());

// Get the local IP address of the server
function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost'; // fallback
}

const LOCAL_IP = getLocalIPAddress();
console.log('Server IP:', LOCAL_IP);

// MongoDB connection with network IP instead of localhost
// Option 1: Use the server's IP address (recommended for network access)
const MONGO_URL = `mongodb://${LOCAL_IP}:27017/ollama-chat`;

// Option 2: Alternative - bind to all interfaces (uncomment if needed)
// const MONGO_URL = 'mongodb://0.0.0.0:27017/ollama-chat';

console.log('Connecting to MongoDB at:', MONGO_URL);

mongoose.connect(MONGO_URL)
    .then(() => {
        console.log('MongoDB connected successfully');
        console.log(`MongoDB accessible at: ${MONGO_URL}`);
    })
    .catch(err => {
        console.log('MongoDB connection error:', err);
        console.log('Make sure MongoDB is configured to accept connections from network interfaces');
    });

// Schemas
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}, { timestamps: true });

const chatSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'New Chat' },
    messages: [{
        content: String,
        isUser: Boolean,
        timestamp: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Chat = mongoose.model('Chat', chatSchema);

// Auth Routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        
        if (await User.findOne({ username })) return res.status(400).json({ error: 'Username already exists' });
        
        const user = await User.create({ username, password: await bcrypt.hash(password, 10) });
        res.json({ user: { _id: user._id, username: user.username } });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt:', username);
        
        const user = await User.findOne({ username });
        if (!user) {
            console.log('User not found');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('Invalid password');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('Login successful');
        res.json({ user: { _id: user._id, username: user.username } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Chat Routes
app.post('/api/chats', async (req, res) => {
    try {
        const { userId, title } = req.body;
        const chat = await Chat.create({ userId, title: title || 'New Chat' });
        res.json({ chat });
    } catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/chats/:userId', async (req, res) => {
    try {
        const chats = await Chat.find({ userId: req.params.userId }).sort({ updatedAt: -1 });
        res.json({ chats });
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/chats/chat/:chatId', async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.chatId);
        res.json({ chat });
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/chats/:chatId/messages', async (req, res) => {
    try {
        const { content, isUser } = req.body;
        const chat = await Chat.findByIdAndUpdate(
            req.params.chatId,
            { $push: { messages: { content, isUser } } },
            { new: true }
        );
        res.json({ chat });
    } catch (error) {
        console.error('Add message error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        server_ip: LOCAL_IP
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://${LOCAL_IP}:${PORT}`);
    console.log(`Also accessible on http://localhost:${PORT}`);
    console.log('Make sure your MongoDB is configured to accept network connections');
});