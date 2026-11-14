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
     * Initializes RabbitMQ channel or fallback in-memory bus
     */
    static async initialize() {
        if (!index_js_1.config.useRabbitMQ) {
            console.log('[Analytics Broker] In-memory mode active (RabbitMQ not configured/disabled).');
            return;
        }
        if (this.connection && this.channel)
            return;
        if (this.isConnecting)
            return;
        this.isConnecting = true;
        try {
            console.log(`[Analytics Broker] Connecting to RabbitMQ at ${index_js_1.config.rabbitmqUrl}...`);
            const conn = await amqplib_1.default.connect(index_js_1.config.rabbitmqUrl);
            const ch = await conn.createChannel();
            this.connection = conn;
            this.channel = ch;
            await ch.assertExchange(this.EXCHANGE, 'topic', { durable: true });
            await ch.assertQueue(this.QUEUE_ANALYTICS, { durable: true });
            await ch.bindQueue(this.QUEUE_ANALYTICS, this.EXCHANGE, 'accident.report.*');
            console.log('[Analytics Broker] RabbitMQ consumer channel initialized.');
            conn.on('error', (err) => {
                console.warn('[Analytics Broker Warning] Connection error:', err.message);
                this.channel = null;
                this.connection = null;
            });
            conn.on('close', () => {
                console.warn('[Analytics Broker Warning] Connection closed.');
                this.channel = null;
                this.connection = null;
            });
        }
        catch (err) {
            console.warn(`[Analytics Broker Fallback] RabbitMQ not reachable (${err.message}). Using in-memory bus.`);
            this.channel = null;
            this.connection = null;
        }
        finally {
            this.isConnecting = false;
        }
    }
    /**
     * Subscribes a worker callback to event queue/topic
     */
    static async subscribe(topicPattern, handler) {
        // 1. In-memory subscription
        if (!this.inMemorySubscribers.has(topicPattern)) {
            this.inMemorySubscribers.set(topicPattern, []);
        }
        const handlers = this.inMemorySubscribers.get(topicPattern);
        handlers.push(handler);
        // 2. RabbitMQ subscription if active
        if (this.channel) {
            try {
                await this.channel.consume(this.QUEUE_ANALYTICS, async (msg) => {
                    if (!msg)
                        return;
                    try {
                        const parsed = JSON.parse(msg.content.toString());
                        await handler(parsed);
                        this.channel?.ack(msg);
                    }
                    catch (procErr) {
                        console.error('[Analytics Broker Message Processing Error]', procErr);
                        this.channel?.nack(msg, false, true); // Requeue
                    }
                });
            }
            catch (subErr) {
                console.error('[Analytics Broker Consume Error]', subErr);
            }
        }
        return () => {
            const idx = handlers.indexOf(handler);
            if (idx !== -1) {
                handlers.splice(idx, 1);
            }
        };
    }
    /**
     * Dispatches event payload in-memory (useful for tests or direct integration)
     */
    static async dispatchInMemory(routingKey, message) {
        const handlers = [
            ...(this.inMemorySubscribers.get(routingKey) || []),
            ...(this.inMemorySubscribers.get('accident.report.*') || []),
            ...(this.inMemorySubscribers.get('*') || []),
        ];
        for (const handler of handlers) {
            await handler(message);
        }
    }
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
