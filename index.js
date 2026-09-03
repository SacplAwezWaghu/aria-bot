// ============================================================
//  index.js — Aria's Main Server
//  This is the file you run to start Aria
//  Command: node index.js
// ============================================================

require('dotenv').config(); // Load your .env credentials

const express = require('express');
const { handleIncomingDM } = require('./instagram');
const { startScheduler } = require('./scheduler');

const app = express();
app.use(express.json());

// ─────────────────────────────────────────────
//  HEALTH CHECK — Visit http://localhost:3000
//  to confirm Aria is running
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family:sans-serif;padding:40px;background:#f0f0f0">
        <h1>🤖 Aria is Running!</h1>
        <p style="color:green;font-size:20px">✅ Bot is live and listening for Instagram messages</p>
        <p><b>Account ID:</b> ${process.env.IG_ACCOUNT_ID}</p>
        <p><b>Started:</b> ${new Date().toLocaleString()}</p>
        <hr/>
        <p>To stop Aria, press <b>Ctrl + C</b> in the terminal</p>
      </body>
    </html>
  `);
});

// ─────────────────────────────────────────────
//  WEBHOOK VERIFICATION
//  Instagram calls this once when you register
//  your webhook URL in the Meta dashboard
// ─────────────────────────────────────────────
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('✅ Webhook verified by Instagram!');
    return res.send(challenge); // Required response
  }

  console.log('❌ Webhook verification failed. Check your VERIFY_TOKEN in .env');
  res.sendStatus(403);
});

// ─────────────────────────────────────────────
//  RECEIVE INSTAGRAM EVENTS
//  Instagram sends every DM and interaction here
// ─────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  // Always respond 200 immediately (Instagram requires this)
  res.sendStatus(200);

  const body = req.body;

  // Only process Instagram events
  if (body.object !== 'instagram') return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {

      // Someone sent your account a message
      if (event.message?.text) {
        const senderId = event.sender.id;
        const messageText = event.message.text;

        // Don't reply to your own messages
        if (senderId === process.env.IG_ACCOUNT_ID) continue;

        // Let Aria handle it
        await handleIncomingDM(senderId, messageText);
      }

      // Someone liked your message
      if (event.message?.attachments) {
        console.log(`📎 Received attachment from ${event.sender.id}`);
        await handleIncomingDM(event.sender.id, '[User sent a photo or attachment]');
      }
    }
  }
});

// ─────────────────────────────────────────────
//  START EVERYTHING
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('\n');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║     🤖  ARIA BOT IS NOW RUNNING  🤖    ║');
  console.log('╠═══════════════════════════════════════╣');
  console.log(`║  Local URL: http://localhost:${PORT}      ║`);
  console.log(`║  Account:   ${(process.env.IG_ACCOUNT_ID || 'Check .env file')?.slice(0,18)}  ║`);
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
  console.log('📌 Share this bot\'s public URL with Instagram:');
  console.log('   Run ngrok in a new terminal: ngrok http 3000');
  console.log('');

  // Start the auto-scheduler
  startScheduler();
});
