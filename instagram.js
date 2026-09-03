// ============================================================
//  instagram.js — Everything that talks to Instagram
//  Handles: DMs, Posts, Hashtag Research, Following
// ============================================================

const axios = require('axios');
const { getAriaReply, analyzeProfiles } = require('./claude');

const BASE = 'https://graph.facebook.com/v19.0';
const TOKEN = () => process.env.ACCESS_TOKEN;
const IG_ID = () => process.env.IG_ACCOUNT_ID;

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

  // Get Aria's AI reply
  const reply = await getAriaReply(messageText);
  console.log(`   Aria replies: "${reply}"`);

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
  followResearchedProfiles
};
