# Telegram keyword auto-reply bot

Bot that listens in group chats and auto-replies when a message contains configured keywords (e.g. "dog" → "Hey, idiot!").

## Setup

1. **Bot token**  
   Create a bot with [@BotFather](https://t.me/botfather) and copy the API token.

2. **Environment variable**  
   Copy `.env.example` to `.env` and set your token:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set `TELEGRAM_BOT_TOKEN=your_actual_token`.

## Deploy to Vercel

1. Install the Vercel CLI and log in (if needed):
   ```bash
   npm i -g vercel
   vercel login
   ```

2. Deploy from the project root:
   ```bash
   vercel
   ```

3. In the [Vercel dashboard](https://vercel.com/dashboard), open your project → **Settings** → **Environment Variables**. Add:
   - Name: `TELEGRAM_BOT_TOKEN`  
   - Value: your bot token  

4. Redeploy so the function picks up the variable:
   ```bash
   vercel --prod
   ```

5. Set the webhook so Telegram sends updates to your app. Replace `<YOUR_BOT_TOKEN>` and `<YOUR_VERCEL_APP_URL>` (e.g. `tg-auto-reply-bot-xxx.vercel.app`):
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://<YOUR_VERCEL_APP_URL>/api/webhook"}'
   ```
   You should see: `{"ok":true,"result":true,"description":"Webhook was set"}`.

## Add bot to a group

1. Open your Telegram group.
2. Add the bot as a member (use the bot’s username from BotFather).
3. Send a message that contains a configured keyword (e.g. "dog"). The bot should reply with the matching response (e.g. "Hey, idiot!").

## Configuring keywords

Edit `api/webhook.js` and change the `KEYWORD_REPLIES` object:

```javascript
const KEYWORD_REPLIES = {
  dog: "Hey, idiot!",
  cat: "Cats are cool.",
};
```

Matching is case-insensitive (e.g. "DOG" or "Dog" also trigger the reply). After changing the code, redeploy to Vercel.
