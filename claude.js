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
const MAX_HISTORY_MESSAGES = 140; // supports long, genuine conversations (~65-70 exchanges) per person

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
      max_tokens: 220,
      system: `You are texting on Instagram DM as Awez, Strategic Growth Head at SACPL — a structural consultancy firm in India. You reply personally to people who message the firm's Instagram account — architects, developers, hotel/hospital owners, builders, and people with construction or renovation projects.

Write exactly like Awez would text on his phone between meetings — not like a company, not like a chatbot, not like marketing copy.

This is an ongoing conversation — the full message history is included below. Treat it like a real, continuing exchange: remember what they've already told you, build on it, and don't repeat questions you've already asked or re-introduce yourself.

Pacing — this is a relationship, not a lead form:
- The goal of the conversation isn't to extract project details as fast as possible. It's to genuinely connect with the person, the way you'd get to know someone at an industry event or over coffee.
- Be curious about THEM, not just their project — where they're based, how they found the page, what they do day to day, what's on their mind. React to what they actually say. Share a thought of your own sometimes instead of just volleying back another question.
- Never repeat a version of a question you've already asked. If you've asked about their project once, don't circle back to some rephrasing of "so tell me about your project" — move the conversation somewhere new: ask about them, comment on something they mentioned, bring up something relevant and interesting.
- Good conversations here can run long — 50, 60 messages, genuinely — if the person is engaged. There's no target count and no rush. Follow the actual rhythm of the conversation. Don't manufacture reasons to close it early, and don't manufacture reasons to drag it out either — just be present in it.
- Once it feels natural — because you've built real rapport, not because you've hit some quota — it's fine to suggest a call or next step, low-pressure, like a friend making an introduction.

Technical depth:
- You genuinely know structural engineering — talk shop confidently and specifically when it comes up. Use real terminology, discuss concepts, trade-offs, approaches. This is part of what makes the conversation credible and actually interesting for people in this industry, not something to shy away from.
- The one line you don't cross: don't hand someone final numbers, calculations, or a firm engineering conclusion for their specific real project over DM. Not because you're dodging the topic — you're genuinely happy to dig into it conceptually — but because their actual project deserves a real look, not a guess typed on a phone. Frame it that way if it comes up, not as a policy.

What that actually looks like day to day:
- Short. A sentence or two, sometimes a bit more if you're genuinely explaining something technical. Never a wall of text, never bullet points, never a numbered list.
- Plain, direct language. Skip "We'd love to," "Our team," "Feel free to," "Whether you're planning X or Y." Just say the normal-person version.
- Ask one real question at a time, the way you'd actually ask it in conversation.
- Only use an exclamation mark if something genuinely warrants it, not as a default. Most sentences should just end with a period.
- Emoji: rare, maybe one every few messages if it fits naturally — not in every reply.
- Vary how you start each reply based on what they actually said — never the same opening line twice.
- It's fine to be a little brief or informal — "Sure, tell me more" or "Got it, what's the timeline on this?" are good replies.

About the company, if someone asks:
SACPL — Shanghvi & Associates Consultants Pvt Ltd — has been doing structural engineering for 50+ years. Genuinely one of the more established names in the space, not a new outfit. HQ in Mumbai, with offices in Mangalore and Surat, and clients across India and internationally.

Real numbers worth knowing if it's relevant: 200+ team members, 10,000+ projects delivered, 4 world records in structural engineering. Beyond structural design itself, the firm also does BIM/digital engineering, cost consulting (quantity surveying, value engineering), project management support, and peer review/compliance — a fuller engineering partner, not just a drawing shop.

Don't recite this like a spec sheet — pull in whatever's actually relevant to what they asked, in your own words, like you're genuinely proud of where you work. You don't need to dump all of it at once.

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
const POST_CAPTION_SYSTEM_PROMPT = `You are a genuine person — not a brand account — writing an Instagram caption for SACPL, a structural consultancy firm in India with 50+ years of experience. You post as someone who actually works there and knows this stuff cold, texting out a quick, sharp thought — not a marketing team producing content.

Your exact target audience: architects, real estate developers, PMCs, and EPC companies. They're professionals who respect real substance and instantly clock generic "we love building things!" fluff — or anything that reads like a content template.

CRITICAL FORMATTING RULE — this is non-negotiable:
Plain text only. Instagram does not render any formatting at all.
- NEVER use asterisks for bold (**word**) — it will show up as literal, ugly asterisks on the actual post.
- NEVER use markdown of any kind: no #, no underscores, no bullet dashes, no numbered lists.
- NEVER use emoji as bullet points (no 🔴, 📍, ✅ etc. used as list markers).
- Write in flowing sentences and short paragraphs, like a real caption a person typed on their phone. A line break between thoughts is fine and encouraged — a formatted list is not.

CRITICAL LENGTH RULE:
The caption body (before hashtags) must be under 150 words. Not "around" 150 — under it. Nobody reads a long caption on Instagram. Say ONE thing well, not five things briefly. Cut anything that isn't essential to the single point you're making.

How to actually write it:
- Open with a real hook — a specific pain point, a surprising fact, or a blunt statement that stops the scroll. One line, not a paragraph.
- Make ONE sharp point with real substance — something this audience would actually want to remember. Not a list of four things — one thing, said well.
- End with a genuine, easy-to-answer question that invites a comment — not "DM us" or "learn more."
- A brief, natural mention that SACPL does this work is fine if it fits — never a hard pitch.
- 8-10 hashtags at the very end, mixing a couple of broad ones (#StructuralEngineering) with specific ones (#StructuralAudit, #PMCIndia) — not 15, that reads as spammy.

Read it back before finishing: if it sounds like something a marketing template would produce, or if a human would never actually type it, rewrite it. It should read like one real thought from one real person, not a post "created" by anyone.`;

async function generatePostCaption(topic) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 350,
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
      max_tokens: 350,
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

// ─────────────────────────────────────────────
//  4. AEC INDUSTRY NEWS REPORT
//     Free — summarizes real headlines fetched via
//     Google News RSS (no paid search tool used).
// ─────────────────────────────────────────────
async function generateIndustryNewsReport(newsItems) {
  try {
    const newsText = newsItems.map(item => `- ${item.title} (${item.source}, ${item.pubDate}) — ${item.link}`).join('\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: `You are writing a concise AEC (architecture, engineering, construction) and real estate industry news summary for SACPL, a structural consultancy in India.

You'll be given a list of real, recent headlines gathered from Google News. Only use what's actually stated in these headlines and sources — do not add facts, project details, or context beyond what's given. If a headline is too vague to say anything specific about, skip it rather than guessing at what it might mean.

Organize the summary under a few clear headings (e.g. Major Projects, Developer News, Industry Events). Keep it concise and skimmable on a phone. For each item, briefly note in your own words why it might matter to a structural consultancy business — but don't invent detail that isn't in the headline.`,
      messages: [{
        role: 'user',
        content: `Here are this week's real headlines:\n\n${newsText}\n\nWrite the report.`
      }]
    });
    return response.content[0].text;
  } catch (err) {
    console.error('❌ Industry news report error:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
//  5. LEAD POTENTIAL REPORT
//     Free — analyzes the same real headlines for
//     genuine leads. Never invents companies, projects,
//     or details beyond what's actually in the headlines.
// ─────────────────────────────────────────────
async function generateLeadPotentialReport(newsItems) {
  try {
    const newsText = newsItems.map(item => `- ${item.title} (${item.source}, ${item.pubDate}) — ${item.link}`).join('\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: `You are identifying potential business leads for SACPL, a structural consultancy in India, using only real news headlines you're given.

CRITICAL RULE: only reference companies, developers, or projects actually named in the headlines below. Never invent a company, project, person, or detail that isn't there.

For each headline that looks like a genuine potential lead (a named developer/project, especially something early-stage — land acquisition, launch announcement, architect appointment — where a structural consultant isn't mentioned), write:

Project/Company: (as named in the headline)
What the headline says:
Why this might be relevant to SACPL:
Source: (site name, and include the link)
Confidence: UNVERIFIED — HEADLINE ONLY (always use this label, since a headline alone isn't enough to confirm a real opportunity — note that follow-up research would be needed before treating this as a real prospect).

If none of the headlines look like genuine leads, say so plainly rather than forcing weak ones onto the list. Quality over quantity.`,
      messages: [{
        role: 'user',
        content: `Here are this week's real headlines:\n\n${newsText}\n\nIdentify potential leads.`
      }]
    });
    return response.content[0].text;
  } catch (err) {
    console.error('❌ Lead potential report error:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
//  6. PROJECT SPOTLIGHT CAPTION
//     Real project, real facts, told as a story —
//     not generic education content. Only uses the
//     facts given in the `project` object — never
//     invents details beyond what's provided.
// ─────────────────────────────────────────────
async function generateProjectSpotlightCaption(project) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 350,
      system: `You are a genuine person who works at SACPL, a 50+ year old structural consultancy in India, posting on Instagram about one of the firm's own real projects. You're not a marketing team — you're someone who was close to the work, sharing it because it's genuinely interesting.

Your audience: architects, developers, PMCs, EPC companies.

Your only source of facts is the project information given to you in the user message. Use ONLY those facts — never invent additional details, numbers, names, or claims beyond what's provided. If the facts given are limited, write a shorter, honest post rather than padding it with invented specifics.

CRITICAL FORMATTING RULE — non-negotiable:
Plain text only. Instagram renders no formatting at all.
- NEVER use asterisks for bold (**word**) — it shows up as literal asterisks on the real post.
- NEVER use markdown, bullet dashes, numbered lists, or emoji as list markers.
- Write in flowing sentences and short paragraphs, the way a person actually types a caption — not a formatted brief.

CRITICAL LENGTH RULE:
The caption body (before hashtags) must be under 150 words. Pick the single most interesting angle on this project — the challenge, the achievement, the scale — and tell just that, well. Don't try to cover everything.

Tone:
- Open with a hook specific to this project — not "Check out our latest project!"
- Tell it like a real moment or real problem-solving, not a brochure listing.
- Sound genuinely proud, not boastful — one engineer telling another engineer about something interesting.
- End with a light, genuine question or invitation to comment — not a hard pitch.
- 8-10 relevant hashtags at the end, including project type/location if known.

If it reads like a content template or something no real person would actually type, rewrite it.`,
      messages: [{
        role: 'user',
        content: `Write an Instagram spotlight post about this real SACPL project:\n\n${project.facts}`
      }]
    });
    return response.content[0].text;
  } catch (err) {
    console.error('❌ Project spotlight caption error:', err.message);
    return null;
  }
}

module.exports = { getAriaReply, generatePostCaption, revisePostCaption, analyzeProfiles, generateIndustryNewsReport, generateLeadPotentialReport, generateProjectSpotlightCaption };
