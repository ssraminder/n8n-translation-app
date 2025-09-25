const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');

// Serve static assets
app.use(express.static(publicDir, { extensions: ['html'] }));

// Health endpoint for quick checks
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Fallback to index.html for any other route (SPA-friendly)
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
