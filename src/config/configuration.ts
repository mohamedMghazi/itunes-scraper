const configuration = () => ({
  port: Number.parseInt(process.env.PORT, 10) || 3000,
  database: {
    uri: process.env.MONGODB_URI,
  },
  itunes: {
    apiUrl: process.env.ITUNES_API_URL || 'https://itunes.apple.com',
  },
});
export default configuration;
