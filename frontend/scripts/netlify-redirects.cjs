// Keep API requests and protected upload cookies on the frontend origin.
const fs = require('node:fs');
const backend = new URL(process.env.BACKEND_URL || 'http://invalid.local');
if (backend.protocol !== 'https:' || backend.pathname !== '/' || backend.search || backend.hash || backend.username || backend.password) {
  throw new Error('Set BACKEND_URL to your HTTPS Render origin, e.g. https://cswdo-backend.onrender.com');
}
fs.writeFileSync('build/_redirects', [
  `/api/* ${backend.origin}/api/:splat 200!`,
  `/media/* ${backend.origin}/media/:splat 200!`,
  '/* /index.html 200',
  '',
].join('\n'));
