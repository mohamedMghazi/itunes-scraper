const configuration = () => ({
  port: Number.parseInt(process.env.PORT, 10) || 3001,
  database: {
    uri: process.env.MONGODB_URI,
  },
  itunes: {
    apiUrl: process.env.ITUNES_API_URL || 'https://itunes.apple.com',
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
      : ['http://localhost', 'https://mohamed-ghazi.com'],
  },
});
export default configuration;
