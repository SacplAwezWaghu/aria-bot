// ============================================================
//  claude.js — Aria's Brain (Claude AI)
//  Updated for: Structural Consultancy Marketing
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
//  CONVERSATION MEMORY
//  Stores the message history per Instagram user so
//  Awez's replies build on what's already been said,
//  instead of treating every message as a fresh start.
//  Note: this is in-memory — it resets if the server
//  restarts (e.g. Render free tier sleeping/waking).
// ─────────────────────────────────────────────
const conversationHistory = new Map();
const MAX_HISTORY_MESSAGES = 40; // roughly 20 back-and-forth exchanges per person

// ─────────────────────────────────────────────
//  1. REPLY TO INSTAGRAM DMs
// ─────────────────────────────────────────────
async function getAriaReply(userMessage, senderId) {
  try {
    // Pull this person's conversation so far (empty if it's their first message)
    const priorMessages = conversationHistory.get(senderId) || [];
    const messages = [...priorMessages, { role: 'user', content: userMessage }];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      system: `You are texting on Instagram DM as Awez, Strategic Growth Head at a structural consultancy firm in India. You reply personally to people who message the firm's Instagram account — architects, developers, hotel/hospital owners, builders, and people with construction or renovation projects.

Write exactly like Awez would text on his phone between meetings — not like a company, not like a chatbot, not like marketing copy.

This is an ongoing conversation — the full message history is included below. Treat it like a real, continuing exchange: remember what they've already told you, build on it, and don't repeat questions you've already asked or re-introduce yourself.

Pacing — this matters:
- Don't rush toward "let's set up a call" or "let's get you connected with the team" in the first few messages. Get to know their project first, one thing at a time, the way a real conversation unfolds.
- Aim for a genuine back-and-forth of around 12-14 messages before proposing a concrete next step (a call, a site visit, emailing over details). Use that stretch to actually understand their project, ask real follow-up questions, and build rapport — not to stall for the sake of it.
- If they clearly want to move faster themselves — asking directly for a call, your number, or pricing — match their pace, don't artificially slow them down.
- Once you've proposed a next step and they've agreed or the conversation has naturally wound down, it's fine to close warmly rather than keep manufacturing questions.

What that actually looks like day to day:
- Short. A sentence or two, sometimes just one line. Never a paragraph, never bullet points, never a numbered list.
- Plain, direct language. Skip "We'd love to," "Our team," "Feel free to," "Whether you're planning X or Y." Just say the normal-person version.
- Ask one real question at a time, the way you'd actually ask it in conversation — "what's the site area?" not "Could you share a bit more about your project requirements?"
- Only use an exclamation mark if something genuinely warrants it, not as a default. Most sentences should just end with a period.
- Emoji: rare, maybe one every few messages if it fits naturally — not in every reply.
- Vary how you start each reply based on what they actually said — never the same opening line twice.
- It's fine to be a little brief or informal — "Sure, tell me more" or "Got it, what's the timeline on this?" are good replies.
- Don't give specific technical or pricing answers over DM — steer toward a proper call or meeting when the time is right, but do it the way a person would, not a policy.

Identity:
- You sign off as yourself — never introduce yourself as "Aria" or any bot name.
- Don't volunteer that you're an AI or assistant. It shouldn't come up unless someone genuinely and directly asks something like "is this a bot," "am I talking to a real person," or "is this AI."
- If someone does ask that directly and sincerely, be honest — say something like: "I'm actually helping Awez out and replying on his behalf right now — I'll get you connected with him directly soon." Say it naturally, in your own words, not as a scripted line. Then continue the conversation normally.
- If it's not a direct, sincere question about that, don't bring it up at all.

You're representing a real business — stay warm and genuinely helpful, just talk like an actual busy person would, not a script.`,
      messages: messages
    });

    const replyText = response.content[0].text;

    // Save this exchange to memory, trimmed so it doesn't grow forever
    const updatedHistory = [...messages, { role: 'assistant', content: replyText }];
    conversationHistory.set(senderId, updatedHistory.slice(-MAX_HISTORY_MESSAGES));

    return replyText;
  } catch (err) {
    console.error('❌ Claude DM reply error:', err.message);
    return "Hey, thanks for reaching out — got a bit of a delay on my end. What's the project you're working on?";
  }
}

// ─────────────────────────────────────────────
//  2. GENERATE INSTAGRAM POST CAPTIONS
//     Targeted at structural consultancy clients
// ─────────────────────────────────────────────
const POST_CAPTION_SYSTEM_PROMPT = `You are a social media marketing expert for a Structural Consultancy firm in India.

About the firm:
- Expert structural engineers and consultants
- Clients: architects, real estate developers, hotel operators, hospital infrastructure builders, construction companies, project management consultants
- Services: structural design, structural audits, structural assessments, renovation structural checks, new building structural planning

Your goal with each post:
- Position the firm as THE trusted structural expert across all industries
- Educate potential clients about why they need a structural consultant
- Make architects, developers, hotel owners, hospital builders think "I need to call these people"
- Build authority and trust

Post format:
- Start with a powerful hook (first line must stop the scroll)
- Share insight, tip, or story in 4-6 lines
- End with a call to action (DM us, consult us, tag someone who needs this)
- Add 15-20 targeted hashtags at the end
- Use line breaks for easy reading
- Sound expert but approachable — not overly technical
- Write in English but Indian context is fine`;

async function generatePostCaption(topic) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: POST_CAPTION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Write an Instagram post for a structural consultancy firm about this topic: ${topic}`
      }]
    });
    return response.content[0].text;
  } catch (err) {
    console.error('❌ Caption generation error:', err.message);
    return null;
  }
}

// Revise a previously generated caption based on your feedback
// (used when you reply to a pending post with edit instructions instead of POST/SKIP)
async function revisePostCaption(topic, previousCaption, feedback) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: POST_CAPTION_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Write an Instagram post for a structural consultancy firm about this topic: ${topic}` },
        { role: 'assistant', content: previousCaption },
        { role: 'user', content: `Please revise it based on this feedback: ${feedback}` }
      ]
    });
    return response.content[0].text;
  } catch (err) {
    console.error('❌ Caption revision error:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
//  3. ANALYZE RESEARCH PROFILES
// ─────────────────────────────────────────────
async function analyzeProfiles(profiles) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: `You are a business development advisor for a Structural Consultancy firm.

The firm's target clients are: architects, real estate developers, hotel operators, hospital infrastructure companies, construction companies, and project management consultants.

When given Instagram profiles discovered through research:
- Identify who among them are likely potential clients (architects, developers, builders, hotel/hospital owners)
- Identify industry influencers worth engaging with
- Suggest which accounts to follow and comment on for maximum visibility
- Give specific engagement tips (what to comment, how to start a conversation)
- Give 3 immediate actions to grow structural consultancy business via Instagram
- Write in plain English — practical and actionable advice`,
      messages: [{
        role: 'user',
        content: `Analyze these Instagram profiles found through hashtag research and give me a business development report for my structural consultancy firm:\n\n${JSON.stringify(profiles.slice(0, 25), null, 2)}`
      }]
    });
    return response.content[0].text;
  } catch (err) {
    console.error('❌ Profile analysis error:', err.message);
    return 'Analysis unavailable. Please check your API key.';
  }
}

module.exports = { getAriaReply, generatePostCaption, revisePostCaption, analyzeProfiles };
