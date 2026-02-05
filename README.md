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

   **Using Postman:**
   - **Method:** `POST`
   - **URL:** `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook`
   - **Headers:** `Content-Type: application/json`
   - **Body:** raw → JSON:
     ```json
     {"url": "https://<YOUR_VERCEL_APP_URL>/api/webhook"}
     ```
   Send the request; a successful response is `{"ok":true,"result":true,"description":"Webhook was set"}`.

### Verify the webhook is set correctly

Call Telegram’s **getWebhookInfo** to see the current webhook URL:

**In a browser (replace `<YOUR_BOT_TOKEN>` with your token):**
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

**Or with curl (Git Bash / WSL):**
```bash
curl -s "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

**Or in Postman:** `GET` → `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo` (no body).

**In Postman:**  
- Method: **GET**  
- URL: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo`

**Expected response when the webhook is set:**
```json
{
  "ok": true,
  "result": {
    "url": "https://tg-auto-reply-bot-server.vercel.app/api/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

If `result.url` matches your Vercel webhook URL, the webhook is set correctly. If `result.url` is empty, run the `setWebhook` step again.

## Testing with Postman

You can simulate Telegram sending an update to your webhook:

1. **Method & URL**  
   - Method: **POST**  
   - URL: `https://tg-auto-reply-bot-server.vercel.app/api/webhook`  
   (or `http://localhost:3000/api/webhook` if running locally.)

2. **Headers**  
   - `Content-Type`: `application/json`

3. **Body**  
   - Type: **raw** → **JSON**  
   - Use a payload that matches Telegram’s [Update](https://core.telegram.org/bots/api#update) format. Example that triggers the "dog" keyword:

   ```json
   {
     "update_id": 123456789,
     "message": {
       "message_id": 1,
       "from": {
         "id": 12345,
         "is_bot": false,
         "first_name": "Test"
       },
       "chat": {
         "id": -1001234567890,
         "type": "group"
       },
       "text": "dog"
     }
   }
   ```

4. **Send**  
   - You should get **200 OK** with body `OK`.  
   - If the keyword matches and `TELEGRAM_BOT_TOKEN` is set on Vercel, the bot will send a reply to the `chat_id` in the body (so use a real group chat ID if you want to see the reply in Telegram).

**Tips:**  
- Change `"text": "dog"` to test other keywords or non-matching text (you still get 200, but no reply).  
- Use a real `chat.id` (e.g. your group’s ID) if you want the bot to post the reply in that chat.

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
