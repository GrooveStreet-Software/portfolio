const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT) || 5173;
const clients = new Set();

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

const liveReload = `
<script>
(function () {
  if (window.__liveReload) return;
  window.__liveReload = true;
  var es = new EventSource('/__reload');
  es.onmessage = function (e) {
    if (e.data === 'reload') location.reload();
  };
})();
</script>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const isStatic = req.url.includes('static=1');

  if (url === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.write('\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let filePath = path.join(root, url === '/' ? 'index.html' : url);
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const type = mime[ext] || 'application/octet-stream';
      if (ext === '.html') {
        const html = isStatic
          ? data.toString()
          : data.toString().replace('</body>', liveReload + '\n</body>');
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        res.end(html);
      } else {
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        res.end(data);
      }
    });
  });
});

let timer;
try {
  fs.watch(root, { recursive: true }, (event, file) => {
    if (!file || file.includes('node_modules') || file.includes('.git')) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      clients.forEach(client => client.write('data: reload\n\n'));
    }, 120);
  });
} catch (e) {
  console.warn('Live reload watching unavailable:', e.message);
}

server.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
});
