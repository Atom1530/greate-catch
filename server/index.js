import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { cfg } from './config.js';
import User from './models/User.js';
import GameState from './models/GameState.js';
import Message from './models/Message.js';
import { auth } from './middleware/auth.js';

await mongoose.connect(cfg.MONGO_URI);

const app = express();
const http = createServer(app);
const io = new SocketIO(http, { cors: { origin: cfg.CORS_ORIGIN } });

app.use(helmet());
app.use(cors({ origin: cfg.CORS_ORIGIN, credentials:true }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

function sign(u){ return jwt.sign({ id: u._id, username: u.username }, cfg.JWT_SECRET, { expiresIn:'30d' }); }

// --- AUTH ---
app.post('/auth/register', async (req,res)=>{
  const { email, username, password } = req.body || {};
  if (!email || !username || !password) return res.status(400).json({ error:'Missing fields' });
  if (username.length < 3) return res.status(400).json({ error:'Username too short' });
  const exists = await User.findOne({ $or:[{email},{username}] });
  if (exists) return res.status(409).json({ error:'Email or username taken' });
  const passHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, username, passHash });

  // создать пустой GameState
  await GameState.create({ userId:user._id });

  res.json({ token: sign(user), user:{ id:user._id, username:user.username } });
});

app.post('/auth/login', async (req,res)=>{
  const { emailOrUsername, password } = req.body || {};
  const user = await User.findOne({ $or:[{email:emailOrUsername},{username:emailOrUsername}] });
  if (!user) return res.status(401).json({ error:'User not found' });
  const ok = await bcrypt.compare(password, user.passHash);
  if (!ok) return res.status(401).json({ error:'Wrong password' });
  res.json({ token: sign(user), user:{ id:user._id, username:user.username } });
});

app.get('/me', auth, async (req,res)=>{
  const u = await User.findById(req.user.id).lean();
  res.json({ id:u._id, username:u.username, email:u.email });
});

// --- GAME STATE ---
app.get('/state', auth, async (req,res)=>{
  const st = await GameState.findOne({ userId:req.user.id }).lean();
  res.json(st || {});
});

// оптимистичное обновление
app.put('/state', auth, async (req,res)=>{
  const patch = req.body || {};
  const st = await GameState.findOne({ userId:req.user.id });
  if (!st) return res.status(404).json({ error:'state not found' });

  // простой merge разрешённых полей:
  const allow = ['wallet','keepnet','keepnetCap','gear','rigDepthM','locationId','level','progress','inventory','activeBaitId'];
  for (const k of allow) if (patch[k] != null) st[k] = patch[k];

  st.lastSeen = new Date();
  st.rev = (st.rev|0) + 1;
  await st.save();
  res.json({ ok:true, rev:st.rev });
});

// --- Chat history (при загрузке) ---
app.get('/chat/history', auth, async (req,res)=>{
  const { roomId, limit = 50 } = req.query;
  const lim = Math.max(1, Math.min(+limit || 50, 100));
  const rows = await Message.find({ roomId }).sort({ createdAt:-1 }).limit(lim).lean();
  res.json(rows.reverse());
});

// --- SOCKET.IO ---
io.on('connection', (socket)=>{
  let user = null;

  socket.on('auth', (token)=>{
    try { user = jwt.verify(token, cfg.JWT_SECRET); socket.emit('auth:ok'); }
    catch { socket.emit('auth:error'); }
  });

  socket.on('joinRoom', (roomId)=>{
    if (!user) return;
    socket.join(roomId);
    socket.emit('joined', roomId);
  });

  socket.on('leaveRoom', (roomId)=>{
    if (!user) return;
    socket.leave(roomId);
  });

  socket.on('chat:send', async ({ roomId, text })=>{
    if (!user || !roomId || !text) return;
    const msg = await Message.create({ roomId, type:'chat', userId:user.id, username:user.username, text });
    io.to(roomId).emit('chat:new', { ...msg.toObject() });
  });

  socket.on('catch:announce', async ({ roomId, payload })=>{
    if (!user || !roomId) return;
    const msg = await Message.create({ roomId, type:'catch', userId:user.id, username:user.username, payload });
    io.to(roomId).emit('chat:new', { ...msg.toObject() });
  });
});

http.listen(cfg.PORT, ()=> console.log('API on :' + cfg.PORT));
