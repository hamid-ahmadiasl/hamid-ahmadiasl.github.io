# Set up the site assistant (step by step)

This adds a chat button to your personal site. Visitors can ask questions, and an AI answers from the information already on your pages. If they tap **Ask Hamid directly**, the message arrives in your Telegram, and anything you reply there appears back in their chat window.

You will use three free accounts: Telegram, Cloudflare, and Google AI Studio. No phone number of yours is ever shown on the site.

Total time: about 20–30 minutes the first time.

---

## What you will end up with

- A chat button on https://hamid-ahmadiasl.github.io (and on the Insights page)
- A small Cloudflare Worker that keeps conversations and talks to Gemini and Telegram
- Messages from visitors in a Telegram bot chat, tagged like `#v-ab12cd`

---

## 1. Create a Telegram bot

1. Open Telegram and search for **@BotFather**.
2. Send `/newbot`.
3. Choose a name (for example `Hamid site assistant`) and a username (it must end in `bot`, for example `hamid_site_chat_bot`).
4. BotFather will reply with a **token**, a long string that looks like `123456789:AAH...`. Copy it and keep it private. This is `TELEGRAM_BOT_TOKEN`.
5. Open your new bot in Telegram and press **Start**, then send it any message, for example `hello`. You must do this once, otherwise Telegram will not tell us your chat id.

### Get your chat id

1. In a web browser, open this address, replacing `YOUR_TOKEN` with the token from BotFather:

   `https://api.telegram.org/botYOUR_TOKEN/getUpdates`

2. You will see a block of text. Look for `"chat":{"id":` followed by a number, for example `"id": 614123456`. That number is your `TELEGRAM_CHAT_ID`.
3. If the page shows `"result":[]`, send the bot another message and refresh the page.

This id is only yours. The Worker will ignore messages from anyone else.

---

## 2. Get a Gemini API key

1. Open [Google AI Studio](https://aistudio.google.com/apikey) and sign in with a Google account.
2. Click **Create API key**.
3. Copy the key. This is `GEMINI_API_KEY`. Keep it private — it never goes into your GitHub repo or into `js/chat.js`.

The Worker first uses the `GEMINI_MODEL` you set (for example `gemini-flash-lite-latest`), then automatically tries `gemini-flash-latest`, `gemini-flash-lite-latest`, `gemini-2.5-flash` and `gemini-2.5-flash-lite` if a model is busy, missing, or times out. If every model is unavailable, the chat still answers and offers to send the question directly to you on Telegram — it does not show a raw error.

You can still change `GEMINI_MODEL` in the Worker settings if Google renames the free Flash model.

If you would rather use OpenAI, you can set `AI_PROVIDER` to `openai` and add an `OPENAI_API_KEY` secret instead. Gemini’s free tier is enough for a personal site.

---

## 3. Invent a webhook secret

Make up a long random password, for example a sentence of a few words with numbers. This is `TELEGRAM_WEBHOOK_SECRET`. You will type it twice: once into Cloudflare, and once into the setup link at the end. It stops other people from pretending to be Telegram.

---

## 4. Create a free Cloudflare account and a Worker

1. Open [Cloudflare](https://dash.cloudflare.com/sign-up) and create a free account (or sign in).
2. In the left sidebar go to **Compute (Workers)** → **Workers & Pages**.
3. Click **Create** → **Create Worker**.
4. Name it `hamid-site-chat` (or any name you like) and click **Deploy**.
5. After it deploys, click **Edit code**.

### Paste the Worker code

The easiest path is a single file:

1. Open `paste-this.js` from the `site-chatbot-worker` zip (it is the knowledge file and the Worker combined).
2. In the Cloudflare editor, select all of the sample code and replace it with the contents of `paste-this.js`.
3. Click **Deploy**.

If you prefer the command line, you can use Wrangler instead (see the Worker README). The result is the same.

### Copy your Worker URL

After a successful deploy, the Worker address looks like:

`https://hamid-site-chat.<your-subdomain>.workers.dev`

Copy it. You will paste it into `js/chat.js` later. Do not add a trailing slash.

---

## 5. Add a KV namespace (the conversation memory)

1. In the Cloudflare dashboard go to **Workers & Pages** → **KV**.
2. Click **Create a namespace**. Name it `hamid-site-chat` and create it.
3. Go back to your Worker → **Settings** → **Bindings** → **Add** → **KV Namespace**.
4. Variable name (binding) must be exactly `CHAT_KV`.
5. Choose the namespace you just created and save.

---

## 6. Add the secrets

Still on the Worker, open **Settings** → **Variables and Secrets**.

Add these as **encrypted secrets** (not plain text variables):

| Name | Value |
| --- | --- |
| `GEMINI_API_KEY` | the key from Google AI Studio |
| `TELEGRAM_BOT_TOKEN` | the token from BotFather |
| `TELEGRAM_CHAT_ID` | the number from `getUpdates` |
| `TELEGRAM_WEBHOOK_SECRET` | the random password you invented |

Optionally, you can also add a plain-text variable:

| Name | Value |
| --- | --- |
| `GEMINI_MODEL` | `gemini-flash-latest` (already the default) |
| `AI_PROVIDER` | `gemini` (or `openai`) |

Click **Deploy** if Cloudflare asks you to redeploy after adding bindings or secrets.

---

## 7. Point Telegram at the Worker

In a browser, open this address, using your Worker URL and your webhook secret:

```
https://hamid-site-chat.<your-subdomain>.workers.dev/setup?secret=YOUR_WEBHOOK_SECRET
```

You should see `"ok": true` and a `webhook` address ending in `/telegram-webhook`. If you see `Unauthorized`, the secret does not match. If you see a Telegram error, check the bot token.

To test the bot, send it a message. It should reply that you need to answer a visitor by replying to their forwarded message, or by sending `#v-xxxxxx your reply`.

---

## 8. Connect the button on your site

1. Open `js/chat.js`.
2. At the top, find:

   ```js
   const WORKER_URL = '';
   ```

3. Paste your Worker URL between the quotes, with no trailing slash:

   ```js
   const WORKER_URL = 'https://hamid-site-chat.<your-subdomain>.workers.dev';
   ```

4. Save the file.

Until this line is filled in, the chat button still appears, but questions show a short message and a link to your email. That is intentional.

---

## 9. Upload the site files to GitHub

Your site already lives in the `hamid-ahmadiasl.github.io` repository. Upload (or commit) at least these files, keeping the same folders:

- `index.html`
- `insights.html`
- `css/style.css`
- `js/chat.js`
- `js/main.js`
- `js/wallpaper.js` (only the cache-bust version number changed)

The cache-bust query `?v=12` is already on the pages, so visitors will get the new files instead of an old cached copy.

After GitHub Pages updates (usually under a minute), open:

`https://hamid-ahmadiasl.github.io/`

You should see the chat button in the bottom-right corner. Ask a question such as “What are your research interests?” (the assistant speaks about you in the third person). Then try **Ask Hamid directly**, send a test message, and reply to it in Telegram. Your reply should appear in the browser within a few seconds if the window is still open, or the next time you open the site (a small pink dot on the button means a reply is waiting).

---

## How you answer visitors in Telegram

When someone uses **Ask Hamid directly**, you will receive a message like:

```
New message from a site visitor  #v-ab12cd
Page: https://hamid-ahmadiasl.github.io/#research
Name: Alex
Email: alex@example.com

Could we talk about a collaboration?
```

Do either of these:

- **Reply** to that Telegram message, or
- Send a new message starting with the tag: `#v-ab12cd Thanks, I will email you.`

The Worker will confirm: `Delivered to visitor #v-ab12cd`. The visitor sees your text in the chat under the name **Hamid**. Your Telegram username and phone number are never shown on the site.

---

## Limits and costs (free tiers)

For a personal academic site, the free plans are usually enough:

- **Cloudflare Workers (free):** 100,000 requests per day. Opening the chat and each poll counts as a request. The widget only polls every 5 seconds while the panel is open.
- **Cloudflare KV (free):** 100,000 reads and 1,000 writes per day. Each AI answer or “ask Hamid” uses a couple of writes. That is plenty for typical personal-site traffic, but not for a very busy public tool.
- **Google Gemini (AI Studio free tier):** a daily quota of Flash-model requests. If you hit it, the widget shows a short “try again / email me” message. You can switch the Worker to OpenAI later if you prefer.
- **Telegram Bot API:** free. There is no charge for these messages.

If you ever need more KV writes, Cloudflare’s paid Workers plan raises the cap. You do not need a paid domain for the Worker; the `workers.dev` address is enough.

---

## If something does not work

- The button is there, but every question says the assistant isn’t connected: `WORKER_URL` in `js/chat.js` is still empty, has a typo, or has a trailing slash. Check it, commit, and wait for Pages to update.
- “Origin not allowed”: the Worker only accepts requests from `https://hamid-ahmadiasl.github.io` and from localhost. Open the live site, not a random preview host, or add that host to `ALLOWED_ORIGINS`.
- Telegram never gets the message: confirm the bot token, that you pressed Start, and that `TELEGRAM_CHAT_ID` is the numeric id (not the bot username).
- You reply in Telegram but the visitor never sees it: make sure you replied to the forwarded message (or included `#v-xxxxxx`), and that `/setup` returned `"ok": true`.
- Gemini errors: check the API key, and try setting `GEMINI_MODEL` to the current Flash model name shown in Google AI Studio.

To turn the assistant off, set `WORKER_URL` back to `''` and redeploy the site, or pause the Worker in the Cloudflare dashboard.
