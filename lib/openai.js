/**
 * OpenAI helpers: getReply (category + current message), getReplyNoisyUser (batch evil/vulgar), getReplyBotIdentity ("contains bot").
 * All return a short reply string or "NOREPLY". Requires OPENAI_API_KEY.
 */

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const NOREPLY = "NOREPLY";

function buildSystemPrompt(category) {
  const base =
    "You are a Telegram group bot. Reply in one short sentence only. ";
  const norule =
    "If the message doesn't need a reply (e.g. off-topic, not about the bot, or not actually insulting in context), respond with exactly: NOREPLY.";
  if (category === "bot-positive") {
    return (
      base +
      "Max 15 words. Reply with a single short thank you. Friendly and modest. No emoji overload. " +
      norule
    );
  }
  if (category === "bot-negative") {
    return (
      base +
      "Max 20 words. Either a calm warning (e.g. only admins can remove) OR one reason the bot exists (keeps chat friendly). Firm but not aggressive. " +
      norule
    );
  }
  if (category === "vulgar") {
    return (
      base +
      "Max 15 words. Mocking/roasting tone. Call out the behavior (keyboard warrior, edge lord, dehumanizing language). No serious lecture. " +
      "If the message is not actually insulting someone (e.g. just talking about a pet), respond NOREPLY. " +
      norule
    );
  }
  return base + "Max 15 words. " + norule;
}

/**
 * Call OpenAI for standard trigger categories. No chat history; current message only.
 * @param {string} category - 'bot-positive' | 'bot-negative' | 'vulgar'
 * @param {string} currentMessage
 * @returns {Promise<string>} - reply text or "NOREPLY"
 */
async function getReply(category, currentMessage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey });

  const systemContent = buildSystemPrompt(category);
  const userContent = `Current message: ${currentMessage || ""}`;

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    max_tokens: 60,
    temperature: 0.7,
  });

  const content = response.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  if (text.toUpperCase() === NOREPLY) return NOREPLY;
  return text || NOREPLY;
}

const NOISY_SYSTEM_PROMPT =
  "You are a Telegram group bot that roasts channel breakers and spammy users. " +
  "Someone is bombing the chat with multiple messages in a short time (channel eater / breaker). " +
  "Reply in one short sentence only. Use an evil, vulgar, mocking tone. Be harsh and aggressive. " +
  "Max 20 words. No NOREPLY — always reply with a roast.";

/**
 * Generate one evil/vulgar reply for a batch of messages from a noisy user.
 * @param {Array<{ text: string, messageId?: number, ts?: number }>} recentMessages - oldest first
 * @returns {Promise<string>} - reply text (never NOREPLY)
 */
async function getReplyNoisyUser(recentMessages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const lines =
    Array.isArray(recentMessages) && recentMessages.length
      ? recentMessages.map((m) => (m && m.text) || "").filter(Boolean)
      : [];
  const userContent =
    lines.length > 0
      ? `Their recent messages (oldest to newest):\n${lines.join("\n")}`
      : "They sent a burst of messages.";

  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: NOISY_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    max_tokens: 60,
    temperature: 0.8,
  });

  const content = response.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  return text || "Take that spam somewhere else.";
}

const BOT_IDENTITY_SYSTEM_PROMPT =
  "You are a Telegram group bot. Someone is asking about the bot (who are you, what does this bot do, how stressful, etc.). " +
  "Reply in one short sentence only. Be informative and firm. Explain briefly that you are a watchdog/auto-reply bot that responds to certain keywords and keeps the chat friendly. " +
  "Max 25 words. If the message is not really about the bot, respond with exactly: NOREPLY.";

/**
 * Answer bot-identity queries (message contains 'bot').
 * @param {string} currentMessage
 * @returns {Promise<string>} - reply text or "NOREPLY"
 */
async function getReplyBotIdentity(currentMessage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: BOT_IDENTITY_SYSTEM_PROMPT },
      { role: "user", content: `Message: ${currentMessage || ""}` },
    ],
    max_tokens: 80,
    temperature: 0.6,
  });

  const content = response.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  if (text.toUpperCase() === NOREPLY) return NOREPLY;
  return text || NOREPLY;
}

module.exports = {
  getReply,
  getReplyNoisyUser,
  getReplyBotIdentity,
  NOREPLY,
};
