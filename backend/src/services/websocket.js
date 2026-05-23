/**
 * WebSocket Service
 */

const { WebSocketServer, WebSocket } = require('ws');
const { verifyToken } = require('../middleware/auth');

let wss = null;
const clients = new Map(); // doctorId -> Set of connections

function initWebSocket(server) {
    const WS_PORT = parseInt(process.env.WS_PORT || '8080');
    
    try {
        wss = new WebSocketServer({ port: WS_PORT });
        
        // Handle WebSocket server errors
        wss.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`WebSocket port ${WS_PORT} already in use, disabling WebSocket server`);
                wss = null;
            } else {
                console.error('WebSocket server error:', err);
            }
        });
    } catch (err) {
        if (err.code === 'EADDRINUSE') {
            console.error(`WebSocket port ${WS_PORT} already in use, disabling WebSocket server`);
            wss = null;
            return;
        }
        throw err;
    }
    
    wss.on('connection', (ws, req) => {
        console.log('WebSocket: New connection');
        
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                handleMessage(ws, message);
            } catch (err) {
                console.error('WebSocket message error:', err);
            }
        });
        
        ws.on('close', () => {
            removeClient(ws);
        });
        
        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
            removeClient(ws);
        });
        
        // Send welcome
        ws.send(JSON.stringify({
            type: 'welcome',
            message: 'Connected to DR Screening WebSocket',
            serverTime: new Date().toISOString()
        }));
    });
    
    if (wss) {
        // Heartbeat
        setInterval(() => {
            if (wss && wss.clients) {
                wss.clients.forEach((ws) => {
                    if (ws.isAlive === false) {
                        removeClient(ws);
                        return ws.terminate();
                    }
                    ws.isAlive = false;
                    ws.ping();
                });
            }
        }, 30000);
        
        console.log(`WebSocket server running on port ${WS_PORT}`);
    }
}

function handleMessage(ws, message) {
    switch (message.type) {
        case 'auth':
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
    }
}

function addClient(doctorId, centerId, ws) {
    if (!clients.has(doctorId)) {
        clients.set(doctorId, new Set());
    }
    clients.get(doctorId).add(ws);
    ws.doctorId = doctorId;
    ws.centerId = centerId;
    console.log(`WebSocket: Client authenticated (doctor=${doctorId})`);
}

function removeClient(ws) {
    if (ws.doctorId && clients.has(ws.doctorId)) {
        clients.get(ws.doctorId).delete(ws);
        if (clients.get(ws.doctorId).size === 0) {
            clients.delete(ws.doctorId);
        }
    }
}

function broadcastToDoctors(doctorIds, message) {
    let sent = 0;
    for (const doctorId of doctorIds) {
        if (clients.has(doctorId)) {
            // Send to only the first available connection to prevent duplicates
            // If the first connection is closed, the message isn't critical and will be fetched on next page load
            for (const ws of clients.get(doctorId)) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(message));
                    sent++;
                    break; // Send to only one connection per doctor
                }
            }
        }
    }
    return sent;
}


function broadcastToCenter(centerId, message) {
    let sent = 0;
    for (const [, sockets] of clients) {
        for (const ws of sockets) {
            if (ws.centerId === centerId && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
                sent++;
            }
        }
    }
    return sent;
}

function notifyNewExam(centerId, examData) {
    return broadcastToCenter(centerId, {
        type: 'new_exam',
        ...examData
    });
}

function notifyNewAlert(doctorIds, alertData) {
    return broadcastToDoctors(doctorIds, {
        type: 'new_alert',
        ...alertData
    });
}

module.exports = {
    initWebSocket,
    broadcastToDoctors,
    broadcastToCenter,
    notifyNewExam,
    notifyNewAlert
};
