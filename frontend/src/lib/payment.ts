/**
 * The backend payment-verify route is POST /orders/:id/payment/verify,
 * where :id is the Mongo order _id (returned as data.orderId by POST /orders).
 * Single source of truth — the old inline '/orders/verify-payment' string
 * 404'd after the customer had already paid.
 */
export function paymentVerifyPath(orderId: string): string {
  return `/orders/${orderId}/payment/verify`;
}
