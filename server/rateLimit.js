const buckets = new WeakMap();

/**
 * Token-bucket rate limiter for Socket.IO socket connections.
 * @param {Object} socket - Socket instance
 * @param {number} [cost=1] - Cost of the operation
 * @param {number} [capacity=30] - Max burst capacity
 * @param {number} [refillPerSec=15] - Token refill rate per second
 * @returns {boolean} True if permitted, false if throttled
 */
function allow(socket, cost = 1, capacity = 30, refillPerSec = 15) {
  if (!socket || typeof socket !== 'object') return true;
  const now = Date.now();
  let b = buckets.get(socket);
  if (!b) {
    b = { tokens: capacity, last: now };
    buckets.set(socket, b);
  }
  b.tokens = Math.min(capacity, b.tokens + ((now - b.last) / 1000) * refillPerSec);
  b.last = now;
  if (b.tokens < cost) return false;
  b.tokens -= cost;
  return true;
}

module.exports = { allow };
