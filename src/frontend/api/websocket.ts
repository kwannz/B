type MessageHandler = (data: any) => void;
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketMessage {
    type: string;
    data: any;
    timestamp: string;
}

class WebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;
    private connectionType: string;
    private messageHandlers: Map<string, Set<MessageHandler>>;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private pingInterval: number = 30000; // 30 seconds
    private pingTimer: number | null = null;
    private onStatusChange?: (status: ConnectionStatus) => void;

    constructor(connectionType: string) {
        // Use import.meta.env for Vite environment variables
        const wsUrl = import.meta.env.VITE_WS_URL || 'wss://localhost:8000';
        this.url = `${wsUrl}/ws/${connectionType}`;
        this.connectionType = connectionType;
        this.messageHandlers = new Map();
    }

    connect(onStatusChange?: (status: ConnectionStatus) => void) {
        this.onStatusChange = onStatusChange;
        if (this.onStatusChange) this.onStatusChange('connecting');

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.reconnectAttempts = 0;
            if (this.onStatusChange) this.onStatusChange('connected');
            this.startPingInterval();
        };

        this.ws.onclose = () => {
            if (this.onStatusChange) this.onStatusChange('disconnected');
            this.stopPingInterval();
            this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (this.onStatusChange) this.onStatusChange('error');
        };

        this.ws.onmessage = (event) => {
            try {
                const message: WebSocketMessage = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
    }

    private startPingInterval() {
        this.pingTimer = window.setInterval(() => {
            this.send({ type: 'ping' });
        }, this.pingInterval);
    }

    private stopPingInterval() {
        if (this.pingTimer !== null) {
            window.clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    private attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
            window.setTimeout(() => this.connect(this.onStatusChange), delay);
        }
    }

    subscribe(messageType: string, handler: MessageHandler) {
        if (!this.messageHandlers.has(messageType)) {
            this.messageHandlers.set(messageType, new Set());
        }
        this.messageHandlers.get(messageType)?.add(handler);
    }

    unsubscribe(messageType: string, handler: MessageHandler) {
        this.messageHandlers.get(messageType)?.delete(handler);
    }

    private handleMessage(message: WebSocketMessage) {
        const handlers = this.messageHandlers.get(message.type);
        if (handlers) {
            handlers.forEach(handler => handler(message.data));
        }
    }

    send(data: any) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    disconnect() {
        this.stopPingInterval();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Create WebSocket clients for different types of real-time updates
export const tradeSocket = new WebSocketClient('trades');
export const signalSocket = new WebSocketClient('signals');
export const performanceSocket = new WebSocketClient('performance');
export const agentStatusSocket = new WebSocketClient('agent_status');

export default {
    tradeSocket,
    signalSocket,
    performanceSocket,
    agentStatusSocket
};
