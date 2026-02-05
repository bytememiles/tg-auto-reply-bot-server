/**
 * Upstash Redis helpers: chat history (last 5 messages, TTL 5 min) and vulgar_count per user (TTL 24h).
 * Uses @upstash/redis with Redis.fromEnv(). Env: KV_REST_API_URL + KV_REST_API_TOKEN (from Vercel Storage).
 */

const CHAT_HISTORY_SIZE = 5;
const CHAT_HISTORY_TTL_SECONDS = 5 * 60; // 5 minutes
const VULGAR_COUNT_TTL_SECONDS = 24 * 60 * 60; // 24 hours

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

/**
 * Append a message to chat history. Trim to last CHAT_HISTORY_SIZE. Set TTL.
 * @param {string|number} chatId
 * @param {string} username - display name (e.g. message.from.username || message.from.first_name)
 * @param {string} text
 */
async function appendChatHistory(chatId, username, text) {
  const client = getRedis();
  if (!client) return;
  const key = `chat:${chatId}`;
  const line = `${username || "?"}: ${(text || "").slice(0, 200)}`;
  try {
    await client.lpush(key, line);
    await client.ltrim(key, 0, CHAT_HISTORY_SIZE - 1);
    await client.expire(key, CHAT_HISTORY_TTL_SECONDS);
  } catch (err) {
    console.error("appendChatHistory error:", err);
  }
}

/**
 * Get last N messages (newest first in Redis; we return newest last for prompt context).
 * @param {string|number} chatId
 * @returns {Promise<string[]>}
 */
async function getChatHistory(chatId) {
  const client = getRedis();
  if (!client) return [];
  const key = `chat:${chatId}`;
  try {
    const list = await client.lrange(key, 0, CHAT_HISTORY_SIZE - 1);
    return Array.isArray(list) ? list.reverse() : []; // newest last for prompt
  } catch (err) {
    console.error("getChatHistory error:", err);
    return [];
  }
}

/**
 * Get vulgar reply count for user (returns 0 if missing).
 * @param {string|number} userId
 * @returns {Promise<number>}
 */
async function getVulgarCount(userId) {
  const client = getRedis();
  if (!client) return 0;
  const key = `vulgar_count:${userId}`;
  try {
    const v = await client.get(key);
    return typeof v === "number" ? v : 0;
  } catch (err) {
    console.error("getVulgarCount error:", err);
    return 0;
  }
}

/**
 * Increment vulgar reply count for user. Sets TTL 24h.
 * @param {string|number} userId
 */
async function incrVulgarCount(userId) {
  const client = getRedis();
  if (!client) return;
  const key = `vulgar_count:${userId}`;
  try {
    await client.incr(key);
    await client.expire(key, VULGAR_COUNT_TTL_SECONDS);
  } catch (err) {
    console.error("incrVulgarCount error:", err);
  }
}

const VULGAR_THRESHOLD = 3;

/**
 * Whether user is in "frequent vulgar/mean" group: in env list OR count >= threshold.
 * @param {string|number} userId - Telegram message.from.id
 * @returns {Promise<boolean>}
 */
async function isFrequentVulgar(userId) {
  const envList = process.env.FREQUENT_VULGAR_USER_IDS;
  if (envList && typeof envList === "string") {
    const ids = envList
      .split(",")
      .map((s) => String(s).trim())
      .filter(Boolean);
    if (ids.includes(String(userId))) return true;
  }
  const count = await getVulgarCount(userId);
  return count >= VULGAR_THRESHOLD;
}

module.exports = {
  appendChatHistory,
  getChatHistory,
  getVulgarCount,
  incrVulgarCount,
  isFrequentVulgar,
};
