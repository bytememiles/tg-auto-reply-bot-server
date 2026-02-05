/**
 * Telegram webhook handler: auto-reply when group messages contain configured keywords.
 * Deploy to Vercel; set TELEGRAM_BOT_TOKEN in environment variables.
 */

// Keyword → reply text (case-insensitive substring match). Add more pairs as needed.
const KEYWORD_REPLIES = {
  dog: "Hey, idiot!",
};

async function sendTelegramMessage(token, chatId, text, replyToMessageId) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    ...(replyToMessageId != null && { reply_to_message_id: replyToMessageId }),
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram sendMessage failed:", res.status, err);
  }
}

function getReplyForMessage(text) {
  if (!text || typeof text !== "string") return null;
  const lower = text.toLowerCase();
  for (const [keyword, reply] of Object.entries(KEYWORD_REPLIES)) {
    if (lower.includes(keyword.toLowerCase())) return reply;
  }
  return null;
}

module.exports = async function handler(req, res) {
  // Always acknowledge so Telegram doesn't retry
  if (req.method !== "POST") {
    res.status(200).send("OK");
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    res.status(200).send("OK");
    return;
  }

  try {
    const body = req.body || {};
    const message = body.message;

    if (!message?.text) {
      res.status(200).send("OK");
      return;
    }

    if (message.from?.is_bot) {
      res.status(200).send("OK");
      return;
    }

    const replyText = getReplyForMessage(message.text);
    if (!replyText) {
      res.status(200).send("OK");
      return;
    }

    const chatId = message.chat?.id;
    const messageId = message.message_id;
    if (chatId == null) {
      res.status(200).send("OK");
      return;
    }

    await sendTelegramMessage(token, chatId, replyText, messageId);
  } catch (err) {
    console.error("Webhook error:", err);
  }

  res.status(200).send("OK");
}
