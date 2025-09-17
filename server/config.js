export const cfg = {
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fishgame',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  PORT: +(process.env.PORT || 4000),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};
