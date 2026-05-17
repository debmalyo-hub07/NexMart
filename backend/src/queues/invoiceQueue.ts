/**
 * InvoiceQueue — in-process async job queue (no Redis required)
 *
 * Uses a simple FIFO queue backed by Node.js async/await.
 * - Jobs are processed with concurrency=3
 * - Auto-retries up to 3 times with exponential backoff
 * - Non-blocking: jobs run in background, never hold up the HTTP response
 * - Production-safe: swap back to BullMQ by changing this file only
 */

import { generateInvoicePdf } from '../services/invoice.service';
import { Order } from '../models/Order';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface InvoiceJobData {
  orderId: string;
  attempts?: number;
}

// ── Simple in-process queue ────────────────────────────────────

const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;

class AsyncJobQueue extends EventEmitter {
  private queue: InvoiceJobData[] = [];
  private running = 0;

  add(data: InvoiceJobData): void {
    this.queue.push({ ...data, attempts: 0 });
    this.tick();
  }

  private tick(): void {
    while (this.running < CONCURRENCY && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.running++;
      this.process(job).finally(() => {
        this.running--;
        this.tick();
      });
    }
  }

  private async process(job: InvoiceJobData): Promise<void> {
    const { orderId } = job;
    const attempt = (job.attempts ?? 0) + 1;

    try {
      logger.info(`📄 Generating invoice for order ${orderId} (attempt ${attempt})`);

      const order = await Order.findById(orderId)
        .populate('customer', 'name email phone')
        .populate('items.product', 'name');

      if (!order) throw new Error(`Order ${orderId} not found`);

      const invoiceUrl = await generateInvoicePdf(
        order as unknown as Parameters<typeof generateInvoicePdf>[0]
      );

      await Order.findByIdAndUpdate(orderId, { invoiceUrl });
      logger.info(`✅ Invoice generated for order ${orderId}: ${invoiceUrl}`);
      this.emit('completed', orderId, invoiceUrl);
    } catch (err) {
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        logger.warn(`⚠️  Invoice job failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${delay / 1000}s...`);
        setTimeout(() => {
          this.queue.push({ orderId, attempts: attempt });
          this.tick();
        }, delay);
      } else {
        logger.error(`❌ Invoice generation failed after ${MAX_ATTEMPTS} attempts for order ${orderId}:`, err);
        this.emit('failed', orderId, err);
      }
    }
  }

  get size(): number { return this.queue.length; }
  get activeCount(): number { return this.running; }
}

// Singleton queue instance
const jobQueue = new AsyncJobQueue();

// ── Public API (same interface as BullMQ version) ─────────────

/**
 * Queue an invoice generation job.
 * Returns immediately — processing happens in background.
 */
export async function queueInvoiceGeneration(orderId: string): Promise<void> {
  // Small delay so the order is fully committed to DB before we query it
  setTimeout(() => jobQueue.add({ orderId }), 1000);
  logger.info(`📬 Invoice generation queued for order ${orderId}`);
}

/**
 * Start the invoice worker (no-op for in-process queue — always running).
 * Kept for API compatibility with server.ts.
 */
export function startInvoiceWorker(): { on: (event: string, cb: (...args: unknown[]) => void) => void } {
  jobQueue.on('failed', (orderId, err) => {
    logger.error(`Invoice permanently failed for order ${orderId}:`, err);
  });
  return jobQueue;
}
