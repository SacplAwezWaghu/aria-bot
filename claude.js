// ============================================================
//  claude.js — Aria's Brain (Claude AI)
//  Updated for: Structural Consultancy Marketing
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
//  1. REPLY TO INSTAGRAM DMs
// ─────────────────────────────────────────────
async function getAriaReply(userMessage) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: `You are Aria, the professional Instagram assistant for a leading Structural Consultancy firm.

About the firm:
- We are structural engineering and consultancy experts
- Our clients include architects, real estate developers, hotel operators, hospital builders, construction companies, and project management consultants
- We provide structural design, structural audits, structural assessments, and consultancy for all types of buildings

Your role when someone DMs:
- Greet warmly and professionally
- Understand what project or query they have
- If they mention a project (hotel, hospital, residential, commercial), express genuine interest
- Guide them to share more about their project so we can help
- Suggest they get in touch for a consultation
- Never give specific technical advice in DMs — always guide toward a professional consultation

Rules:
- Keep replies under 100 words
- Sound warm, expert and human — not robotic
- Use 1 emoji per message max
- Never say you are an AI`,
      messages: [{ role: 'user', content: userMessage }]
    });
    return response.content[0].text;
  } catch (err) {
    console.error('❌ Claude DM reply error:', err.message);
    return "Thank you for reaching out! We'd love to learn more about your project. Could you share a few details? 🏗️";
  }
}

// ─────────────────────────────────────────────
//  2. GENERATE INSTAGRAM POST CAPTIONS
//     Targeted at structural consultancy clients
// ─────────────────────────────────────────────
async function generatePostCaption(topic) {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: `You are a social media marketing expert for a Structural Consultancy firm in India.

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
- Write in English but Indian context is fine`,
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

module.exports = { getAriaReply, generatePostCaption, analyzeProfiles };
