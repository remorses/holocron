FROM --platform=linux/amd64 node:22-slim

WORKDIR /app

COPY . .

RUN echo "const http = require('http');\nhttp.createServer((req, res) => { res.writeHead(200, {'Content-Type': 'text/plain'}); res.end('Hello, world!\\n'); }).listen(8080, () => { console.log('Server running at http://0.0.0.0:3000/'); });" > index.js

EXPOSE 8080

CMD ["node", "index.js"]
