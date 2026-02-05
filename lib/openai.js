/**
 * OpenAI helper: getReply(category, recentMessages, currentMessage, isFrequentVulgar)
 * Returns a short reply string or "NOREPLY". Requires OPENAI_API_KEY.
 */

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const NOREPLY = "NOREPLY";

function buildSystemPrompt(category, isFrequentVulgar) {
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
    let vulgar =
      "Max 15 words. Mocking/roasting tone. Call out the behavior (keyboard warrior, edge lord, dehumanizing language). No serious lecture. ";
    if (isFrequentVulgar) {
      vulgar +=
        "This user has triggered vulgar/mean replies several times recently; reply with a slightly sterner, more direct tone. ";
    }
    vulgar +=
      "If the message is not actually insulting someone (e.g. just talking about a pet), respond NOREPLY. " +
      norule;
    return base + vulgar;
  }
  return base + "Max 15 words. " + norule;
}

function buildUserMessage(recentMessages, currentMessage) {
  const lines =
    Array.isArray(recentMessages) && recentMessages.length
      ? recentMessages.join("\n")
      : "(no recent messages)";
  return `Recent messages (newest last):\n${lines}\n\nCurrent message: ${currentMessage || ""}`;
}

/**
 * Call OpenAI chat completions. Returns reply text or NOREPLY. Throws on API/network failure.
 * @param {string} category - 'bot-positive' | 'bot-negative' | 'vulgar'
 * @param {string[]} recentMessages - last 5 messages (newest last)
 * @param {string} currentMessage
 * @param {boolean} isFrequentVulgar - for vulgar category, use sterner tone
 * @returns {Promise<string>} - reply text or "NOREPLY"
 */
async function getReply(
  category,
  recentMessages,
  currentMessage,
  isFrequentVulgar,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey });

  const systemContent = buildSystemPrompt(category, !!isFrequentVulgar);
  const userContent = buildUserMessage(recentMessages, currentMessage);

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

module.exports = {
  getReply,
  NOREPLY,
};
