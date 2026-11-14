"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxPoller = void 0;
const db_js_1 = require("../config/db.js");
const broker_js_1 = require("../config/broker.js");
const index_js_1 = require("../config/index.js");
class OutboxPoller {
    static isRunning = false;
    static timer = null;
    /**
     * Starts the Outbox CDC Poller background worker
     */
    static start(pollIntervalMs) {
        if (this.isRunning)
            return;
        this.isRunning = true;
        const interval = pollIntervalMs || index_js_1.config.outboxPollIntervalMs || 2000;
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
    static stop() {
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
    static async processOutboxBatch(batchSize = 50) {
        const client = await db_js_1.pool.connect();
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
            const processedIds = [];
            for (const record of records) {
                const routingKey = record.event_type === 'ACCIDENT_REPORT_CREATED'
                    ? broker_js_1.EventBroker.ROUTING_KEY_REPORT_CREATED
                    : broker_js_1.EventBroker.ROUTING_KEY_REPORT_UPDATED;
                const success = await broker_js_1.EventBroker.publish(routingKey, {
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
                await client.query(`UPDATE report_outbox
           SET processed = TRUE, processed_at = NOW()
           WHERE id = ANY($1::uuid[])`, [processedIds]);
                processedCount = processedIds.length;
            }
            await client.query('COMMIT');
            if (processedCount > 0) {
                console.log(`[Outbox Poller] Successfully published and marked ${processedCount} outbox event(s).`);
            }
        }
        catch (err) {
            await client.query('ROLLBACK');
            console.error('[Outbox Poller Error] Failed to process batch:', err);
        }
        finally {
            client.release();
        }
        return processedCount;
    }
}
exports.OutboxPoller = OutboxPoller;
