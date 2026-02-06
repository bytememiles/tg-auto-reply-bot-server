/**
 * Upstash Redis: noisy-user burst cache only.
 * Key: noisy:{chatId}:{userId} → list of { text, messageId, ts }. TTL 90s, max 10 items.
 * Uses @upstash/redis with Redis.fromEnv(). Env: KV_REST_API_URL + KV_REST_API_TOKEN.
 */

const NOISY_BUFFER_MAX = 10;
const NOISY_TTL_SECONDS = 90;

let redis = null;
function getRedis() {
  if (redis === null) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (url && token) {
      try {
        const { Redis } = require("@upstash/redis");
        redis = Redis.fromEnv();
      } catch (e) {
        console.warn("Redis not available:", e.message);
      }
    }
  }
  return redis;
}

function noisyKey(chatId, userId) {
  return `noisy:${chatId}:${userId}`;
}

/**
 * Append a message from a noisy user. Trim to last NOISY_BUFFER_MAX. Set TTL.
 * @param {string|number} chatId
 * @param {string|number} userId
 * @param {string} text
 * @param {number} messageId - Telegram message_id (used for reply_to)
 * @returns {Promise<number>} - count of messages now in buffer (after append)
 */
async function appendNoisyUserMessage(chatId, userId, text, messageId) {
  const client = getRedis();
  if (!client) return 0;
  const key = noisyKey(chatId, userId);
  const entry = JSON.stringify({
    text: (text || "").slice(0, 500),
    messageId,
    ts: Math.floor(Date.now() / 1000),
  });
  try {
    await client.lpush(key, entry);
    await client.ltrim(key, 0, NOISY_BUFFER_MAX - 1);
    await client.expire(key, NOISY_TTL_SECONDS);
    const len = await client.llen(key);
    return len;
  } catch (err) {
    console.error("appendNoisyUserMessage error:", err);
    return 0;
  }
}

/**
 * Get recent messages from noisy-user buffer that are within NOISY_TTL_SECONDS.
 * Returns array of { text, messageId, ts } oldest first. Does not clear the buffer.
 * @param {string|number} chatId
 * @param {string|number} userId
 * @returns {Promise<Array<{ text: string, messageId: number, ts: number }>>}
 */
async function getNoisyUserRecent(chatId, userId) {
  const client = getRedis();
  if (!client) return [];
  const key = noisyKey(chatId, userId);
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - NOISY_TTL_SECONDS;
  try {
    const list = await client.lrange(key, 0, -1);
    if (!Array.isArray(list)) return [];
    const parsed = [];
    for (const item of list) {
      try {
        const o = JSON.parse(item);
        if (o && typeof o.ts === "number" && o.ts >= cutoff) {
          parsed.push({
            text: typeof o.text === "string" ? o.text : "",
            messageId: typeof o.messageId === "number" ? o.messageId : 0,
            ts: o.ts,
          });
        }
      } catch (_) {
        // skip malformed
      }
    }
    // Redis list is newest first (lpush); we want oldest first for prompt
    parsed.sort((a, b) => a.ts - b.ts);
    return parsed;
  } catch (err) {
    console.error("getNoisyUserRecent error:", err);
    return [];
  }
}

/**
 * Clear the noisy-user buffer after sending a reply so we don't double-reply for same burst.
 * @param {string|number} chatId
 * @param {string|number} userId
 */
async function clearNoisyUserBuffer(chatId, userId) {
  const client = getRedis();
  if (!client) return;
  const key = noisyKey(chatId, userId);
  try {
    await client.del(key);
  } catch (err) {
    console.error("clearNoisyUserBuffer error:", err);
  }
}

module.exports = {
  appendNoisyUserMessage,
  getNoisyUserRecent,
  clearNoisyUserBuffer,
  NOISY_TTL_SECONDS,
};
