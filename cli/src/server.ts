// server.js
import { WebSocketServer } from 'ws' // Node ≥14 with "type":"module" in package.json
// If you stay in CommonJS, use: const { WebSocketServer } = require('ws');

const PORT = 8080
const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (ws) => {
    console.log('⚡ Client connected')

    ws.on('message', (msg) => {
        console.log('📩', msg.toString())
        ws.send(`Echo: ${msg}`) // simple echo
    })

    ws.on('close', () => console.log('👋 Client disconnected'))
})

console.log(`🚀 WebSocket server running at ws://localhost:${PORT}`)
