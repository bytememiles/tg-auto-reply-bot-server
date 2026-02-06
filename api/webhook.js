/**
 * Telegram webhook handler: auto-reply when group messages contain configured keywords.
 * Deploy to Vercel; set TELEGRAM_BOT_TOKEN in environment variables.
 */

// Keyword → reply text (mocking/roasting tone). Match uses normalized text (leet, spaces, repeats).
const KEYWORD_REPLIES = {
  dog: "Wow, original.",
  idiot: "Keyboard warrior detected.",
  stupid: "That's the best you got?",
  dumb: "Someone's triggered.",
  "shut up": "Cry more.",
  stfu: "Cry more.",
  loser: "That's the best you got?",
  trash: "Keyboard warrior detected.",
  crap: "Language. Did your mom teach you that?",
  wtf: "Easy there, edge lord.",
  wtff: "Easy there, edge lord.",
  bs: "Let's see a source or sit down.",
  bullshit: "Let's see a source or sit down.",
  hate: "Who hurt you?",
  "kill yourself": "Not cool. Get help.",
  kys: "Reported. Be kind.",
  shit: "Language. Did your mom teach you that?",
  shitty: "Language. Did your mom teach you that?",
  fuck: "Easy there, edge lord.",
  fucking: "Easy there, edge lord.",
  fck: "Easy there, edge lord.",
  fcking: "Easy there, edge lord.",
  fuk: "Easy there, edge lord.",
  damn: "Easy there, edge lord.",
  hell: "Easy there, edge lord.",
  asshole: "Someone's triggered.",
  bitch: "That's the best you got?",
  piss: "Language. Did your mom teach you that?",
  "piss off": "Cry more.",
  // When someone asks what the bot is for
  "this bot for":
    "I’m a little watchdog bot 🐶 I jump in when certain spicy words show up to help keep the chat friendly and drama-free.",
  "this bot do":
    "I’m an auto-reply bot 👋 If certain keywords pop up (yeah, those words), I step in to keep things chill.",
  "what is this bot":
    "I’m the “hey maybe don’t say that” bot 🚨 I auto-reply when certain words appear so the chat stays nice and not spicy.",
};

// Trigger keyword sets for OpenAI. Order: bot-positive, bot-negative, vulgar.
const TRIGGER_BOT_POSITIVE = [
  "good bot",
  "thanks bot",
  "love this bot",
  "this bot is great",
  "useful bot",
  "nice bot",
  "great bot",
];
const TRIGGER_BOT_NEGATIVE = [
  "remove bot",
  "delete bot",
  "kill this bot",
  "turn off bot",
  "get rid of bot",
  "shut this bot",
  "disable bot",
  "remove the bot",
  "delete the bot",
];
const TRIGGER_VULGAR = [
  "idiot",
  "stupid",
  "dumb",
  "shut up",
  "stfu",
  "loser",
  "trash",
  "crap",
  "wtf",
  "wtff",
  "bs",
  "bullshit",
  "hate",
  "kill yourself",
  "kys",
  "shit",
  "shitty",
  "fuck",
  "fucking",
  "fck",
  "fcking",
  "fuk",
  "damn",
  "hell",
  "asshole",
  "bitch",
  "piss",
  "piss off",
  "dog",
  "rat",
  "mouse",
];

/** Returns 'bot-positive' | 'bot-negative' | 'vulgar' | null. First match wins. */
function getTriggerCategory(text) {
  if (!text || typeof text !== "string") return null;
  const normalizedInput = normalizeForMatch(text);
  for (const phrase of TRIGGER_BOT_POSITIVE) {
    const n = normalizeForMatch(phrase);
    if (n && normalizedInput.includes(n)) return "bot-positive";
  }
  for (const phrase of TRIGGER_BOT_NEGATIVE) {
    const n = normalizeForMatch(phrase);
    if (n && normalizedInput.includes(n)) return "bot-negative";
  }
  for (const phrase of TRIGGER_VULGAR) {
    const n = normalizeForMatch(phrase);
    if (n && normalizedInput.includes(n)) return "vulgar";
  }
  return null;
}

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

// Leet → letter map for anti-evasion (word-puzzle / leetspeak).
const LEET_MAP = {
  0: "o",
  1: "i",
  3: "e",
  4: "a",
  5: "s",
  7: "t",
  8: "b",
  "@": "a",
  $: "s",
  "!": "i",
};

function normalizeForMatch(text) {
  if (!text || typeof text !== "string") return "";
  let s = text.toLowerCase();
  s = s
    .split("")
    .map((c) => (LEET_MAP[c] !== undefined ? LEET_MAP[c] : c))
    .join("");
  s = s.replace(/[\s.,!?;:'"\-_]+/g, "");
  s = s.replace(/(.)\1+/g, "$1");
  return s;
}

function getReplyForMessage(text) {
  if (!text || typeof text !== "string") return null;
  const normalizedInput = normalizeForMatch(text);
  for (const [keyword, reply] of Object.entries(KEYWORD_REPLIES)) {
    const normalizedKeyword = normalizeForMatch(keyword);
    if (normalizedKeyword && normalizedInput.includes(normalizedKeyword))
      return reply;
  }
  return null;
}

const {
  appendNoisyUserMessage,
  getNoisyUserRecent,
  clearNoisyUserBuffer,
} = require("../lib/kv");
const {
  getReply,
  getReplyNoisyUser,
  getReplyBotIdentity,
  NOREPLY,
} = require("../lib/openai");

const BURST_THRESHOLD = 2;

function getNoisyUserIdsSet() {
  const envList = process.env.NOISY_USER_IDS;
  if (!envList || typeof envList !== "string") return new Set();
  return new Set(
    envList
      .split(",")
      .map((s) => String(s).trim())
      .filter(Boolean),
  );
}

module.exports = async function handler(req, res) {
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

    const chatId = message.chat?.id;
    const messageId = message.message_id;
    const userId = message.from?.id;

    if (chatId == null) {
      res.status(200).send("OK");
      return;
    }

    const noisyUserIds = getNoisyUserIdsSet();

    // 1) Noisy user branch: batch messages, one evil/vulgar reply per burst
    if (noisyUserIds.has(String(userId))) {
      const count = await appendNoisyUserMessage(
        chatId,
        userId,
        message.text,
        messageId,
      );
      if (count >= BURST_THRESHOLD) {
        const batch = await getNoisyUserRecent(chatId, userId);
        if (batch.length >= BURST_THRESHOLD) {
          try {
            const replyText = await getReplyNoisyUser(batch);
            const replyToId =
              batch.length > 0 ? batch[batch.length - 1].messageId : messageId;
            await sendTelegramMessage(token, chatId, replyText, replyToId);
          } catch (openaiErr) {
            console.error("OpenAI getReplyNoisyUser failed:", openaiErr);
          }
          await clearNoisyUserBuffer(chatId, userId);
        }
      }
      res.status(200).send("OK");
      return;
    }

    // 2) Bot-identity: message contains "bot" → analyze and reply
    const normalizedText = normalizeForMatch(message.text);
    if (normalizedText.includes("bot")) {
      try {
        const replyText = await getReplyBotIdentity(message.text);
        if (replyText && replyText.toUpperCase() !== NOREPLY) {
          await sendTelegramMessage(token, chatId, replyText, messageId);
        }
      } catch (openaiErr) {
        console.error("OpenAI getReplyBotIdentity failed:", openaiErr);
        const fallback = getReplyForMessage(message.text);
        if (fallback) {
          await sendTelegramMessage(token, chatId, fallback, messageId);
        }
      }
      res.status(200).send("OK");
      return;
    }

    // 3) Standard triggers (bot-positive, bot-negative, vulgar); no chat history
    const category = getTriggerCategory(message.text);
    if (!category) {
      res.status(200).send("OK");
      return;
    }

    let replyText = null;
    let usedFallback = false;
    try {
      replyText = await getReply(category, message.text);
    } catch (openaiErr) {
      console.error("OpenAI request failed, using static fallback:", openaiErr);
      usedFallback = true;
      replyText = getReplyForMessage(message.text);
    }

    if (usedFallback && replyText) {
      await sendTelegramMessage(token, chatId, replyText, messageId);
      res.status(200).send("OK");
      return;
    }

    if (replyText && replyText.toUpperCase() !== NOREPLY) {
      await sendTelegramMessage(token, chatId, replyText, messageId);
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }

  res.status(200).send("OK");
};
