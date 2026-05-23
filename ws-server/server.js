/**
 * WebSocket Server for DR Screening Real-time Notifications
 * 
 * Handles:
 * - Doctor connections with JWT authentication
 * - Broadcasting new exam notifications
 * - Broadcasting urgent alert notifications
 * - Internal HTTP endpoint for PHP to trigger broadcasts
 */

require('dotenv').config();
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');

// Configuration
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-ws-api-key';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Logger
const log = {
    levels: { debug: 0, info: 1, warn: 2, error: 3 },
    currentLevel: 1,
    
    init() {
        this.currentLevel = this.levels[LOG_LEVEL] || 1;
    },
    
    format(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        if (data) {
            return `${prefix} ${message} ${JSON.stringify(data)}`;
        }
        return `${prefix} ${message}`;
    },
    
    debug(msg, data) {
        if (this.currentLevel <= 0) console.log(this.format('debug', msg, data));
    },
    info(msg, data) {
        if (this.currentLevel <= 1) console.log(this.format('info', msg, data));
    },
    warn(msg, data) {
        if (this.currentLevel <= 2) console.warn(this.format('warn', msg, data));
    },
    error(msg, data) {
        if (this.currentLevel <= 3) console.error(this.format('error', msg, data));
    }
};

log.init();

// Connected clients storage
// Map of doctorId -> Set of WebSocket connections
const clients = new Map();

// Stats
const stats = {
    totalConnections: 0,
    totalMessages: 0,
    startTime: Date.now()
};

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        return decoded;
    } catch (err) {
        log.debug('JWT verification failed', { error: err.message });
        return null;
    }
}

/**
 * Add client connection
 */
function addClient(doctorId, centerId, ws) {
    if (!clients.has(doctorId)) {
        clients.set(doctorId, new Set());
    }
    clients.get(doctorId).add(ws);
    
    // Store metadata on the websocket
    ws.doctorId = doctorId;
    ws.centerId = centerId;
    ws.isAlive = true;
    
    stats.totalConnections++;
    log.info(`Client connected: doctor=${doctorId}, center=${centerId}, total=${getClientCount()}`);
}

/**
 * Remove client connection
 */
function removeClient(ws) {
    if (ws.doctorId && clients.has(ws.doctorId)) {
        clients.get(ws.doctorId).delete(ws);
        if (clients.get(ws.doctorId).size === 0) {
            clients.delete(ws.doctorId);
        }
        log.info(`Client disconnected: doctor=${ws.doctorId}, total=${getClientCount()}`);
    }
}

/**
 * Get total client count
 */
function getClientCount() {
    let count = 0;
    for (const [, sockets] of clients) {
        count += sockets.size;
    }
    return count;
}

/**
 * Broadcast message to specific doctors
 */
function broadcastToDoctors(doctorIds, message) {
    let sent = 0;
    for (const doctorId of doctorIds) {
        if (clients.has(doctorId)) {
            for (const ws of clients.get(doctorId)) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(message));
                    sent++;
                }
            }
        }
    }
    stats.totalMessages += sent;
    return sent;
}

/**
 * Broadcast message to all doctors in a center
 */
function broadcastToCenter(centerId, message) {
    let sent = 0;
    for (const [doctorId, sockets] of clients) {
        for (const ws of sockets) {
            if (ws.centerId === centerId && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
                sent++;
            }
        }
    }
    stats.totalMessages += sent;
    return sent;
}

/**
 * Broadcast message to all connected clients
 */
function broadcastAll(message) {
    let sent = 0;
    for (const [, sockets] of clients) {
        for (const ws of sockets) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
                sent++;
            }
        }
    }
    stats.totalMessages += sent;
    return sent;
}

// Create HTTP server (for internal API)
const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    const parsedUrl = url.parse(req.url, true);
    
    // Health check
    if (req.method === 'GET' && parsedUrl.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            clients: getClientCount(),
            uptime: Math.floor((Date.now() - stats.startTime) / 1000),
            totalConnections: stats.totalConnections,
            totalMessages: stats.totalMessages
        }));
        return;
    }
    
    // Internal broadcast endpoint
    if (req.method === 'POST' && parsedUrl.pathname === '/broadcast') {
        // Verify API key
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== INTERNAL_API_KEY) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }
        
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { type, doctorIds, centerId, message } = data;
                
                let sent = 0;
                
                if (doctorIds && Array.isArray(doctorIds)) {
                    sent = broadcastToDoctors(doctorIds, { type, ...message });
                } else if (centerId) {
                    sent = broadcastToCenter(parseInt(centerId, 10), { type, ...message });
                } else {
                    sent = broadcastAll({ type, ...message });
                }
                
                log.info(`Broadcast: type=${type}, sent=${sent}`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, sent }));
                
            } catch (err) {
                log.error('Broadcast error', { error: err.message });
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }
    
    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    log.debug(`New connection from ${ip}`);
    
    // Set up ping-pong for connection health
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    // Handle messages
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'auth':
                    // Authenticate with JWT
                    const payload = verifyToken(message.token);
                    if (payload) {
                        addClient(payload.user_id, payload.center_id, ws);
                        ws.send(JSON.stringify({
                            type: 'authenticated',
                            userId: payload.user_id,
                            role: payload.role
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Authentication failed'
                        }));
                        ws.close(4001, 'Authentication failed');
                    }
                    break;
                    
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
                    
                default:
                    log.debug('Unknown message type', { type: message.type });
            }
            
        } catch (err) {
            log.error('Message parse error', { error: err.message });
        }
    });
    
    // Handle disconnection
    ws.on('close', (code, reason) => {
        removeClient(ws);
        log.debug(`Connection closed: code=${code}, reason=${reason}`);
    });
    
    // Handle errors
    ws.on('error', (err) => {
        log.error('WebSocket error', { error: err.message });
        removeClient(ws);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to DR Screening WebSocket Server',
        serverTime: new Date().toISOString()
    }));
});

// Heartbeat interval (every 30 seconds)
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            log.debug('Terminating inactive connection');
            removeClient(ws);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

// Start server
server.listen(PORT, HOST, () => {
    log.info(`WebSocket server running on ws://${HOST}:${PORT}`);
    log.info(`Internal API running on http://${HOST}:${PORT}`);
    log.info('Endpoints:');
    log.info('  GET  /health    - Health check');
    log.info('  POST /broadcast - Send notification (requires X-API-Key header)');
});

// Graceful shutdown
process.on('SIGINT', () => {
    log.info('Shutting down...');
    wss.clients.forEach((ws) => {
        ws.close(1001, 'Server shutting down');
    });
    server.close(() => {
        log.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    log.info('SIGTERM received, shutting down...');
    server.close(() => {
        process.exit(0);
    });
});
