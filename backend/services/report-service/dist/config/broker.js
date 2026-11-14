"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBroker = void 0;
const amqplib_1 = __importDefault(require("amqplib"));
const index_js_1 = require("./index.js");
class EventBroker {
    static connection = null;
    static channel = null;
    static inMemorySubscribers = new Map();
    static isConnecting = false;
    static EXCHANGE = 'crashscribe.events';
    static QUEUE_ANALYTICS = 'analytics.accident.ingest';
    static ROUTING_KEY_REPORT_CREATED = 'accident.report.created';
    static ROUTING_KEY_REPORT_UPDATED = 'accident.report.updated';
    /**
     * Initializes RabbitMQ channel and exchanges, or establishes in-memory bus fallback
     */
    static async initialize() {
        if (!index_js_1.config.useRabbitMQ) {
            console.log('[Event Broker] Running in IN_MEMORY mode (RabbitMQ deferred/disabled).');
            return;
        }
        if (this.connection && this.channel) {
            return;
        }
        if (this.isConnecting)
            return;
        this.isConnecting = true;
        try {
            console.log(`[Event Broker] Connecting to RabbitMQ at ${index_js_1.config.rabbitmqUrl}...`);
            const conn = await amqplib_1.default.connect(index_js_1.config.rabbitmqUrl);
            const ch = await conn.createChannel();
            this.connection = conn;
            this.channel = ch;
            // Setup topic exchange
            await ch.assertExchange(this.EXCHANGE, 'topic', { durable: true });
            // Setup analytics queue and bind to accident topics
            await ch.assertQueue(this.QUEUE_ANALYTICS, { durable: true });
            await ch.bindQueue(this.QUEUE_ANALYTICS, this.EXCHANGE, 'accident.report.*');
            console.log('[Event Broker] Connected to RabbitMQ successfully. Topic exchange ready.');
            conn.on('error', (err) => {
                console.warn('[Event Broker Warning] RabbitMQ connection error:', err.message);
                this.channel = null;
                this.connection = null;
            });
            conn.on('close', () => {
                console.warn('[Event Broker Warning] RabbitMQ connection closed.');
                this.channel = null;
                this.connection = null;
            });
        }
        catch (err) {
            console.warn('[Event Broker Notice] Could not connect to RabbitMQ broker:', err.message);
            console.warn('[Event Broker Notice] Falling back to high-reliability In-Memory bus.');
            this.channel = null;
            this.connection = null;
        }
        finally {
            this.isConnecting = false;
        }
    }
    /**
     * Publishes an event message to topic exchange or in-memory subscribers
     */
    static async publish(routingKey, message) {
        if (this.channel) {
            try {
                const buffer = Buffer.from(JSON.stringify(message));
                return this.channel.publish(this.EXCHANGE, routingKey, buffer, {
                    persistent: true,
                    messageId: message.id,
                    timestamp: Date.now(),
                });
            }
            catch (err) {
                console.error('[Event Broker Error] Failed to publish message to RabbitMQ:', err.message);
            }
        }
        // In-memory fallback distribution
        const wildcardKey = routingKey.split('.')[0] + '.*';
        const handlers = [
            ...(this.inMemorySubscribers.get(routingKey) || []),
            ...(this.inMemorySubscribers.get(wildcardKey) || []),
            ...(this.inMemorySubscribers.get('*') || []),
        ];
        for (const handler of handlers) {
            try {
                await handler(message);
            }
            catch (hErr) {
                console.error('[Event Broker In-Memory Subscriber Error]', hErr);
            }
        }
        return true;
    }
    /**
     * Subscribes a consumer callback to a routing key topic
     */
    static subscribe(topic, handler) {
        if (!this.inMemorySubscribers.has(topic)) {
            this.inMemorySubscribers.set(topic, []);
        }
        const handlers = this.inMemorySubscribers.get(topic);
        handlers.push(handler);
        return () => {
            const idx = handlers.indexOf(handler);
            if (idx !== -1) {
                handlers.splice(idx, 1);
            }
        };
    }
    /**
     * Cleans up connections
     */
    static async close() {
        if (this.channel) {
            await this.channel.close();
            this.channel = null;
        }
        if (this.connection) {
            await this.connection.close();
            this.connection = null;
        }
        this.inMemorySubscribers.clear();
    }
}
exports.EventBroker = EventBroker;
