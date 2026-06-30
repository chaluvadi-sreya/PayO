class WebSocketManager {
  constructor() {
    this.clients = new Set();
    this.wss = null;
  }

  initialize(wss) {
    this.wss = wss;
    
    this.wss.on('connection', (ws) => {
      console.log('New WebSocket client connected');
      this.clients.add(ws);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'subscribe') {
            ws.subscribedSymbols = data.symbols || [];
            console.log(`Client subscribed to: ${ws.subscribedSymbols.join(', ')}`);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to crypto market WebSocket',
        timestamp: new Date()
      }));
    });
  }

  broadcastMarketData(data) {
    const message = JSON.stringify({
      type: 'market_update',
      data: data,
      timestamp: new Date()
    });

    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  sendToClient(ws, data) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  }
}

module.exports = new WebSocketManager();