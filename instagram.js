// ============================================================
//  instagram.js — Everything that talks to Instagram
//  Handles: DMs, Posts, Hashtag Research, Following
// ============================================================

const axios = require('axios');
const { getAriaReply, analyzeProfiles, revisePostCaption } = require('./claude');

// FIXED: Instagram Login tokens (IGAA...) must use graph.instagram.com,
// NOT graph.facebook.com (that's only for Facebook Login / Page tokens).
const BASE = 'https://graph.instagram.com/v21.0';
const TOKEN = () => process.env.ACCESS_TOKEN;
const IG_ID = () => process.env.IG_ACCOUNT_ID;
const ADMIN_ID = () => process.env.ADMIN_USER_ID;

// Holds one pending post at a time, waiting for your approval via DM
let pendingPost = null;

// Helper: make API calls cleanly
async function api(method, endpoint, data = {}, params = {}) {
  try {
    const config = {
      method,
      url: `${BASE}${endpoint}`,
      params: { access_token: TOKEN(), ...params },
      data
    };
    const res = await axios(config);
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`❌ Instagram API error [${endpoint}]:`, msg);
    return null;
  }
}

// ─────────────────────────────────────────────
//  FEATURE 1: AUTO-REPLY TO DMs
// ─────────────────────────────────────────────

// Called when someone sends your account a DM
async function handleIncomingDM(senderId, messageText) {
  console.log(`\n📩 New DM from user ${senderId}`);
  console.log(`   Message: "${messageText}"`);

  // Get the AI-assisted reply — pass senderId so the conversation
  // history is remembered per person, not treated as a fresh chat each time
  const reply = await getAriaReply(messageText, senderId);
  console.log(`   Reply: "${reply}"`);

  // Send reply back to the user
  await sendDM(senderId, reply);
}

// Send a direct message to a user
async function sendDM(recipientId, message) {
  const result = await api('POST', '/me/messages', {
    recipient: { id: recipientId },
    message: { text: message }
  });

  if (result) {
    console.log(`✅ DM sent successfully to ${recipientId}`);
  }
  return result;
}

// ─────────────────────────────────────────────
//  FEATURE 2: POST TO YOUR INSTAGRAM
// ─────────────────────────────────────────────

// Publish a photo post with a caption
// imageUrl must be a public internet URL (e.g. from your website or cloud storage)
async function createPost(imageUrl, caption) {
  console.log('\n📸 Creating Instagram post...');

  if (!imageUrl) {
    console.error('❌ No image URL provided. Set DEFAULT_POST_IMAGE_URL in your .env file');
    return null;
  }

  // Step 1: Upload image to Instagram (creates a staging container)
  console.log('   Step 1/2: Uploading image...');
  const container = await api('POST', `/${IG_ID()}/media`, {
    image_url: imageUrl,
    caption: caption
  });

  if (!container?.id) {
    console.error('❌ Failed to upload image. Make sure the URL is publicly accessible.');
    return null;
  }

  // Wait a moment for Instagram to process
  await sleep(5000);

  // Step 2: Publish the staged post
  console.log('   Step 2/2: Publishing post...');
  const published = await api('POST', `/${IG_ID()}/media_publish`, {
    creation_id: container.id
  });

  if (published?.id) {
    console.log(`✅ Post published successfully! Post ID: ${published.id}`);
    return published.id;
  }

  return null;
}

// Create a text-only story (uses a plain background image)
async function createStory(caption) {
  // For text stories, you still need an image — use a solid color image
  const solidColorImage = 'https://via.placeholder.com/1080x1920/1a1a2e/ffffff.jpg';
  return await createPost(solidColorImage, caption);
}

// ─────────────────────────────────────────────
//  FEATURE 2B: POST APPROVAL WORKFLOW
//  Instead of auto-publishing, Aria sends you the
//  generated post via DM and waits for your approval.
// ─────────────────────────────────────────────

// Send tomorrow's generated post to you (the admin) for review —
// sent a day ahead so you have time to request changes before it's due
async function sendPostForApproval(imageUrl, caption, topic, forDateLabel) {
  if (!ADMIN_ID()) {
    console.log('⚠️ ADMIN_USER_ID is not set in .env — cannot send post for approval.');
    return;
  }

  pendingPost = { imageUrl, caption, topic, forDateLabel };

  const preview = caption.length > 800 ? caption.slice(0, 800) + '…' : caption;
  const message =
    `📋 Post ready for ${forDateLabel}:\n\n${preview}\n\n` +
    `Reply POST to approve, SKIP to discard, or just tell me what to change and I'll revise it.` +
    (imageUrl ? '' : '\n\n⚠️ No image URL is set (DEFAULT_POST_IMAGE_URL is empty) — this can\'t actually publish until that\'s configured.');

  console.log(`\n📤 Sending post for ${forDateLabel} to admin for approval...`);
  await sendDM(ADMIN_ID(), message);
}

// Called when you reply with feedback instead of POST/SKIP — revises the caption
async function reviseAndResendPost(feedback) {
  if (!pendingPost) {
    await sendDM(ADMIN_ID(), 'There\'s no pending post to revise right now.');
    return;
  }

  console.log('\n✏️ Revising pending post based on feedback...');
  const revised = await revisePostCaption(pendingPost.topic, pendingPost.caption, feedback);

  if (!revised) {
    await sendDM(ADMIN_ID(), '❌ Couldn\'t revise the caption — please try again.');
    return;
  }

  pendingPost.caption = revised;
  const preview = revised.length > 800 ? revised.slice(0, 800) + '…' : revised;
  await sendDM(
    ADMIN_ID(),
    `✏️ Updated version for ${pendingPost.forDateLabel}:\n\n${preview}\n\nReply POST to approve, SKIP to discard, or tell me more changes.`
  );
}

// Called when you reply POST — publishes the pending post
async function approvePendingPost() {
  if (!pendingPost) {
    await sendDM(ADMIN_ID(), 'There\'s no pending post waiting for approval right now.');
    return;
  }

  if (!pendingPost.imageUrl) {
    await sendDM(ADMIN_ID(), 'Can\'t publish — no image is set for this post. Add DEFAULT_POST_IMAGE_URL and try the next scheduled post.');
    return;
  }

  const postId = await createPost(pendingPost.imageUrl, pendingPost.caption);
  pendingPost = null;

  if (postId) {
    await sendDM(ADMIN_ID(), `✅ Published! Post ID: ${postId}`);
  } else {
    await sendDM(ADMIN_ID(), '❌ Something went wrong publishing that post. Check the logs.');
  }
}

// Called when you reply SKIP — discards the pending post
async function rejectPendingPost() {
  if (!pendingPost) {
    await sendDM(ADMIN_ID(), 'There\'s no pending post to skip.');
    return;
  }
  pendingPost = null;
  await sendDM(ADMIN_ID(), '👍 Skipped — no post published today.');
}

// Send the daily research findings to you directly, so they're not
// just sitting in a file on the server you can't easily access
async function sendResearchSummaryToAdmin(analysis) {
  if (!ADMIN_ID()) {
    console.log('⚠️ ADMIN_USER_ID is not set in .env — cannot send research summary.');
    return;
  }
  const preview = analysis.length > 900 ? analysis.slice(0, 900) + '… (see server logs for the full report)' : analysis;
  await sendDM(ADMIN_ID(), `🔬 Today's research summary:\n\n${preview}`);
}

// ─────────────────────────────────────────────
//  FEATURE 3: RESEARCH — FIND RELEVANT PROFILES
// ─────────────────────────────────────────────

// Search a hashtag and get profiles that use it
async function searchByHashtag(hashtag) {
  console.log(`  🔍 Searching #${hashtag}...`);

  // Step 1: Get hashtag ID
  const hashtagSearch = await api('GET', '/ig_hashtag_search', {}, {
    user_id: IG_ID(),
    q: hashtag
  });

  const hashtagId = hashtagSearch?.data?.[0]?.id;
  if (!hashtagId) {
    console.log(`  ⚠️  No results for #${hashtag}`);
    return [];
  }

  // Step 2: Get recent posts using this hashtag
  const media = await api('GET', `/${hashtagId}/recent_media`, {}, {
    user_id: IG_ID(),
    fields: 'id,caption,username,media_type,timestamp,like_count,comments_count'
  });

  const posts = media?.data || [];
  console.log(`  ✅ Found ${posts.length} posts for #${hashtag}`);
  return posts;
}

// Run full research across all your target hashtags
async function runFullResearch() {
  const hashtags = (process.env.RESEARCH_HASHTAGS || 'architect,developer').split(',');
  console.log('\n🔬 STARTING RESEARCH RUN');
  console.log(`   Searching ${hashtags.length} hashtags: ${hashtags.join(', ')}`);

  const allPosts = [];

  for (const tag of hashtags) {
    const posts = await searchByHashtag(tag.trim());
    allPosts.push(...posts);
    await sleep(2000); // Pause between searches to avoid rate limiting
  }

  // Remove duplicate profiles (same person might post with multiple hashtags)
  const uniqueProfiles = [...new Map(allPosts.map(p => [p.username, p])).values()];
  console.log(`\n📊 Total unique profiles found: ${uniqueProfiles.length}`);

  // Save results to a JSON file for your records
  const fs = require('fs');
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `research_${timestamp}.json`;
  fs.writeFileSync(filename, JSON.stringify(uniqueProfiles, null, 2));
  console.log(`💾 Results saved to: ${filename}`);

  // Have Claude analyze the findings and give you recommendations
  console.log('\n🤖 Claude is analyzing the profiles...');
  const analysis = await analyzeProfiles(uniqueProfiles);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 RESEARCH REPORT:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(analysis);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Save report too
  fs.writeFileSync(`report_${timestamp}.txt`, analysis);
  console.log(`💾 Report saved to: report_${timestamp}.txt`);

  return { profiles: uniqueProfiles, analysis };
}

// ─────────────────────────────────────────────
//  FEATURE 4: FOLLOW ACCOUNTS
//
//  ⚠️  IMPORTANT NOTE ABOUT FOLLOWING:
//  Instagram's API restricts automatic following.
//  It requires special permission from Meta called
//  "instagram_manage_follows" which needs approval.
//
//  What we do instead: we log WHO to follow so
//  you can do it manually, or when you get the
//  permission approved, this code is ready to go.
// ─────────────────────────────────────────────

async function followUser(targetUserId) {
  console.log(`\n👤 Attempting to follow user ID: ${targetUserId}`);

  // Try the API — will only work if Meta grants the permission
  const result = await api('POST', `/${IG_ID()}/following`, {
    target_user_id: targetUserId
  });

  if (result) {
    console.log(`✅ Successfully followed user ${targetUserId}`);
    return true;
  } else {
    // Log to a file for manual follow
    const fs = require('fs');
    const logLine = `${new Date().toISOString()} | User to follow: ${targetUserId}\n`;
    fs.appendFileSync('follow_list.txt', logLine);
    console.log(`📝 Added to follow_list.txt for manual follow`);
    return false;
  }
}

// Follow a batch of user IDs (from research results)
async function followResearchedProfiles(profiles) {
  console.log(`\n👥 Processing ${profiles.length} profiles to follow...`);

  for (const profile of profiles) {
    if (profile.username) {
      console.log(`  → @${profile.username}`);
      await followUser(profile.id || profile.username);
      await sleep(3000); // Wait between follows to avoid Instagram limits
    }
  }
}

// ─────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  handleIncomingDM,
  sendDM,
  createPost,
  createStory,
  runFullResearch,
  followUser,
  followResearchedProfiles,
  sendPostForApproval,
  approvePendingPost,
  rejectPendingPost,
  reviseAndResendPost,
  sendResearchSummaryToAdmin
};
