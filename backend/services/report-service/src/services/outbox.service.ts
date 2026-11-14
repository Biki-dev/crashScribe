import { pool } from '../config/db.js';
import { EventBroker } from '../config/broker.js';
import { config } from '../config/index.js';

export class OutboxPoller {
  private static isRunning = false;
  private static timer: NodeJS.Timeout | null = null;

  /**
   * Starts the Outbox CDC Poller background worker
   */
  static start(pollIntervalMs?: number): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const interval = pollIntervalMs || config.outboxPollIntervalMs || 2000;
    console.log(`[Outbox Poller] CDC worker started (Polling every ${interval}ms)`);

    this.timer = setInterval(async () => {
      await this.processOutboxBatch();
    }, interval);

    // Initial immediate poll
    this.processOutboxBatch().catch((err) => {
      console.error('[Outbox Poller Initial Batch Error]', err);
    });
  }

  /**
   * Stops the Outbox CDC Poller
   */
  static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[Outbox Poller] CDC worker stopped.');
  }

  /**
   * Fetches unprocessed outbox records, locks them, publishes to broker, and marks processed
   */
  static async processOutboxBatch(batchSize: number = 50): Promise<number> {
    const client = await pool.connect();
    let processedCount = 0;

    try {
      // 1. Fetch unprocessed rows using SKIP LOCKED to prevent multi-worker concurrency collisions
      await client.query('BEGIN');

      const fetchQuery = `
        SELECT id, aggregate_id, event_type, payload, created_at
        FROM report_outbox
        WHERE processed = FALSE
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `;

      const result = await client.query(fetchQuery, [batchSize]);
      const records = result.rows;

      if (records.length === 0) {
        await client.query('COMMIT');
        return 0;
      }

      // 2. Publish each event message to Event Broker
      const processedIds: string[] = [];

      for (const record of records) {
        const routingKey =
          record.event_type === 'ACCIDENT_REPORT_CREATED'
            ? EventBroker.ROUTING_KEY_REPORT_CREATED
            : EventBroker.ROUTING_KEY_REPORT_UPDATED;

        const success = await EventBroker.publish(routingKey, {
          id: record.id,
          aggregate_id: record.aggregate_id,
          event_type: record.event_type,
          payload: record.payload,
          created_at: record.created_at.toISOString(),
        });

        if (success) {
          processedIds.push(record.id);
        }
      }

      // 3. Mark processed records in database
      if (processedIds.length > 0) {
        await client.query(
          `UPDATE report_outbox
           SET processed = TRUE, processed_at = NOW()
           WHERE id = ANY($1::uuid[])`,
          [processedIds]
        );
        processedCount = processedIds.length;
      }

      await client.query('COMMIT');

      if (processedCount > 0) {
        console.log(`[Outbox Poller] Successfully published and marked ${processedCount} outbox event(s).`);
      }
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[Outbox Poller Error] Failed to process batch:', err);
    } finally {
      client.release();
    }

    return processedCount;
  }
}
