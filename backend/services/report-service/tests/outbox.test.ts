import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { pool } from '../src/config/db.js';
import { EventBroker } from '../src/config/broker.js';
import { OutboxPoller } from '../src/services/outbox.service.js';

describe('Step 1.6: Message Broker & Outbox Poller CDC', () => {
  beforeAll(async () => {
    await EventBroker.initialize();
  });

  afterAll(async () => {
    OutboxPoller.stop();
    await EventBroker.close();
    await pool.end();
  });

  it('should publish messages via EventBroker in-memory bus or RabbitMQ', async () => {
    let receivedPayload: any = null;

    const unsubscribe = EventBroker.subscribe(
      EventBroker.ROUTING_KEY_REPORT_CREATED,
      async (content) => {
        receivedPayload = content;
      }
    );

    const testEvent = {
      testId: randomUUID(),
      district: 'Kamrup Metropolitan',
      timestamp: new Date().toISOString(),
    };

    const published = await EventBroker.publish(
      EventBroker.ROUTING_KEY_REPORT_CREATED,
      testEvent
    );

    expect(published).toBe(true);
    // Allow small tick for in-memory / broker delivery
    await new Promise((r) => setTimeout(r, 50));

    expect(receivedPayload).toBeDefined();
    expect(receivedPayload?.testId).toBe(testEvent.testId);
    unsubscribe();
  });

  it('should pick up unprocessed report_outbox rows with SKIP LOCKED, publish them, and mark as processed', async () => {
    const reportId = randomUUID();
    const eventId = randomUUID();

    // 1. Insert an unprocessed outbox row directly into the database
    await pool.query(
      `INSERT INTO report_outbox (id, aggregate_id, event_type, payload, processed)
       VALUES ($1, $2, $3, $4, FALSE)`,
      [
        eventId,
        reportId,
        'ACCIDENT_REPORT_CREATED',
        JSON.stringify({
          id: reportId,
          district: 'Kamrup Metropolitan',
          police_station: 'Dispur PS',
          severity: 'FATAL',
        }),
      ]
    );

    // 2. Capture the published event
    let capturedEvent: any = null;
    const unsub = EventBroker.subscribe(
      EventBroker.ROUTING_KEY_REPORT_CREATED,
      async (event) => {
        if (event.id === eventId) {
          capturedEvent = event;
        }
      }
    );

    // 3. Trigger manual batch processing of OutboxPoller
    const processedCount = await OutboxPoller.processOutboxBatch(10);
    expect(processedCount).toBeGreaterThanOrEqual(1);

    // 4. Verify the event was published and received
    await new Promise((r) => setTimeout(r, 50));
    expect(capturedEvent).toBeDefined();
    expect(capturedEvent?.aggregate_id).toBe(reportId);
    expect(capturedEvent?.payload?.severity).toBe('FATAL');

    // 5. Verify the DB record has processed = TRUE and processed_at is set
    const res = await pool.query(
      `SELECT processed, processed_at FROM report_outbox WHERE id = $1`,
      [eventId]
    );
    expect(res.rows[0].processed).toBe(true);
    expect(res.rows[0].processed_at).not.toBeNull();

    unsub();
  });
});
