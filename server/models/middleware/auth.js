import jwt from 'jsonwebtoken';
import { cfg } from '../config.js';

export function auth(req, res, next){
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error:'No token' });
  try {
    const payload = jwt.verify(token, cfg.JWT_SECRET);
    req.user = payload; // { id, username }
    next();
  } catch {
    res.status(401).json({ error:'Invalid token' });
  }
}
