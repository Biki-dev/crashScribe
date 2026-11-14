import amqplib, { Channel } from 'amqplib';
import { config } from './index.js';

export interface EventMessage {
  id: string;
  aggregate_id: string;
  event_type: string;
  payload: any;
  created_at: string;
}

export type EventHandler = (msg: EventMessage) => Promise<void>;

export class EventBroker {
  private static connection: any = null;
  private static channel: Channel | null = null;
  private static inMemorySubscribers: Map<string, EventHandler[]> = new Map();
  private static isConnecting = false;

  public static readonly EXCHANGE = 'crashscribe.events';
  public static readonly QUEUE_ANALYTICS = 'analytics.accident.ingest';
  public static readonly ROUTING_KEY_REPORT_CREATED = 'accident.report.created';
  public static readonly ROUTING_KEY_REPORT_UPDATED = 'accident.report.updated';

  /**
   * Initializes RabbitMQ channel or fallback in-memory bus
   */
  static async initialize(): Promise<void> {
    if (!config.useRabbitMQ) {
      console.log('[Analytics Broker] In-memory mode active (RabbitMQ not configured/disabled).');
      return;
    }

    if (this.connection && this.channel) return;
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      console.log(`[Analytics Broker] Connecting to RabbitMQ at ${config.rabbitmqUrl}...`);
      const conn = await amqplib.connect(config.rabbitmqUrl);
      const ch = await conn.createChannel();

      this.connection = conn;
      this.channel = ch;

      await ch.assertExchange(this.EXCHANGE, 'topic', { durable: true });
      await ch.assertQueue(this.QUEUE_ANALYTICS, { durable: true });
      await ch.bindQueue(this.QUEUE_ANALYTICS, this.EXCHANGE, 'accident.report.*');

      console.log('[Analytics Broker] RabbitMQ consumer channel initialized.');

      conn.on('error', (err: any) => {
        console.warn('[Analytics Broker Warning] Connection error:', err.message);
        this.channel = null;
        this.connection = null;
      });

      conn.on('close', () => {
        console.warn('[Analytics Broker Warning] Connection closed.');
        this.channel = null;
        this.connection = null;
      });
    } catch (err: any) {
      console.warn(`[Analytics Broker Fallback] RabbitMQ not reachable (${err.message}). Using in-memory bus.`);
      this.channel = null;
      this.connection = null;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Subscribes a worker callback to event queue/topic
   */
  static async subscribe(topicPattern: string, handler: EventHandler): Promise<() => void> {
    // 1. In-memory subscription
    if (!this.inMemorySubscribers.has(topicPattern)) {
      this.inMemorySubscribers.set(topicPattern, []);
    }
    const handlers = this.inMemorySubscribers.get(topicPattern)!;
    handlers.push(handler);

    // 2. RabbitMQ subscription if active
    if (this.channel) {
      try {
        await this.channel.consume(this.QUEUE_ANALYTICS, async (msg) => {
          if (!msg) return;
          try {
            const parsed = JSON.parse(msg.content.toString());
            await handler(parsed);
            this.channel?.ack(msg);
          } catch (procErr) {
            console.error('[Analytics Broker Message Processing Error]', procErr);
            this.channel?.nack(msg, false, true); // Requeue
          }
        });
      } catch (subErr) {
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
  static async dispatchInMemory(routingKey: string, message: EventMessage): Promise<void> {
    const handlers = [
      ...(this.inMemorySubscribers.get(routingKey) || []),
      ...(this.inMemorySubscribers.get('accident.report.*') || []),
      ...(this.inMemorySubscribers.get('*') || []),
    ];

    for (const handler of handlers) {
      await handler(message);
    }
  }

  static async close(): Promise<void> {
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
