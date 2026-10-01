// ============================================================
//  scheduler.js — Aria's Automatic Task Manager
//  Content strategy: Structural Consultancy Marketing
// ============================================================

const cron = require('node-cron');
const { createPost, fetchRelevantImage, runFullResearch, fetchGoogleNews, sendResearchSummaryToAdmin, sendIndustryReportToAdmin, sendLeadReportToAdmin } = require('./instagram');
const { generatePostCaption, generateIndustryNewsReport, generateLeadPotentialReport, generateProjectSpotlightCaption, generateFreshTopic } = require('./claude');

// ──────────────────────────────────────────────
//  PROJECT SPOTLIGHT LIBRARY
//  Real SACPL projects, real facts, sourced from
//  actual company case studies and project profiles.
//  Images live in the GitHub repo under /project-images/
//  and are served via raw.githubusercontent.com.
// ──────────────────────────────────────────────
const GITHUB_IMAGE_BASE = 'https://raw.githubusercontent.com/SacplAwezWaghu/aria-bot/main/project-images';

const spotlightProjects = [
  {
    image: `${GITHUB_IMAGE_BASE}/wtc-sky-bridge.jpg`,
    facts: `Project: Sky Bridge Restaurant Block, World Trade Centre, New Delhi.
World Trade Centre New Delhi is a 25-acre, 6-million-sq-ft commercial complex with 12 ten-storey office towers. The Sky Bridge is a restaurant and business lounge block connecting two towers (F & G) at the 8th and 9th storeys, 29.25m up, accessed by an independent elevator core.
The engineering challenge: the original design called for RCC beams and slabs, but the project was under a strict 24-month EPC contract with penalty clauses for delays. RCC construction risked the timeline due to multi-staged scaffolding requirements for the elevated core.
SACPL explored three alternative structural schemes: (1) entire structure in structural steel, (2) steel for horizontal members with RCC vertical members, (3) a combination of Vierendeel trusses along the building periphery with RCC core walls. Option 3 was chosen for its functional usage, service routing, and overall structural efficiency.
Executed by NCC under an EPC model.`
  },
  {
    image: `${GITHUB_IMAGE_BASE}/the-park-oshiwara.jpg`,
    facts: `Project: The Park, Oshiwara, Andheri (West), Mumbai.
A 42-floor residential tower, 126.25m architectural height (127.30m to the top floor). Developer: DLH Ltd & Lotus Group. Architect: North Constructions. Structural Engineer: SACPL.
Structural system: a Frame Tube System, where the perimeter consists of closely spaced columns connected by deep spandrel beams, working as a hollow vertical cantilever. The entire lateral resistance is provided by these closely spaced exterior columns and deep spandrel beams.
The RC frame is connected with steel bracings between stories, using high tensile strength structural steel with 350MPa yield strength. Seismic zone 3 (Z=0.16), basic wind speed 44 m/s.`
  },
  {
    image: `${GITHUB_IMAGE_BASE}/svkm-hospital-shirpur.jpg`,
    facts: `Project: SVKM Hospital, Shirpur, Maharashtra.
A hospital building of 8.45 lakh sq ft, structurally divided into 4 zones separated by 150mm expansion joints — an approach used to let each zone move independently under thermal and seismic loads without cracking.
Zone 1: 1 basement + ground floor + 5 typical floors + terrace + future provision. Zones 2, 3A & 3B: ground floor + 5 typical floors + terrace + future provision. Total height from ground level: 28.5m.
Foundation: spread foundation, designed for a safe bearing capacity of 65T/m² with 25mm settlement tolerance, based on the soil report. A connecting raft was provided only in the basement area to resist uplift water pressure.`
  },
  {
    image: `${GITHUB_IMAGE_BASE}/one-meraki-construction.jpg`,
    facts: `Project: One Meraki, Wing E.
Configuration: 2 basements + ground level + 17 floors + terrace.
Achievement: the team achieved a 4-5 day slab casting cycle — a fast pace for this kind of structure — through a combination of design and site strategies:
- A flat slab system with minimal beams reduced complexity and shuttering time (Mivan shuttering system used).
- Strong core framing reduced lateral forces, meaning fewer beams and columns needed to be managed.
- Extra back props (100%-100%-70%-30% pattern) provided necessary support since full slab strength isn't achieved right away.
- Consistent concrete grade monitoring, less rebar-tying time due to the flat slab system, and same column/beam sizes maintained throughout for faster, more repeatable construction.`
  },
  {
    image: `${GITHUB_IMAGE_BASE}/datavolt-datacenter.jpg`,
    facts: `Project: Data Volt Data Center, Saudi Arabia (locations: Janadriyah and Riyadh).
An international data center project — a building typology with unique structural demands around heavy equipment loads, precise floor flatness, and mechanical/electrical coordination, quite different from typical commercial or residential structures.`
  },
  {
    image: `${GITHUB_IMAGE_BASE}/k-raheja-mindspace.jpg`,
    facts: `Project: Offices, Malls and Commercial Mind Spaces.
Client: K Raheja Corporation.
A large-scale commercial development combining office towers, retail mall space, and integrated "Mind Space" commercial campuses — the kind of mixed-use commercial project that requires coordinating structural design across very different usage types (office floor plates, retail spans, parking, common areas) within one integrated development.`
  }
];

// Rotates through the spotlight list by day, so it advances daily
// without needing manual tracking, and simply wraps around once
// it reaches the end.
function getTodaysSpotlightProject() {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return spotlightProjects[dayIndex % spotlightProjects.length];
}

// The actual project-spotlight posting logic, pulled out the same
// way as runAutoPost so it can run on schedule or be triggered manually.
async function runProjectSpotlightPost() {
  console.log('\n🏗️ Posting project spotlight...');

  const project = getTodaysSpotlightProject();
  const caption = await generateProjectSpotlightCaption(project);

  if (!caption) {
    console.log('❌ Could not generate spotlight caption. Skipping this post.');
    return { success: false, reason: 'Could not generate caption' };
  }

  const postId = await createPost(project.image, caption);
  if (postId) {
    console.log(`✅ Spotlight post published! ID: ${postId}`);
    return { success: true, postId };
  }
  return { success: false, reason: 'Instagram publish failed — check logs' };
}

// ──────────────────────────────────────────────
//  TOPIC MEMORY — tracks recently used topics so
//  generateFreshTopic can guarantee each new one is
//  genuinely different, not a reworded repeat. With
//  2 posts/day, this remembers roughly the last 2-3
//  months of topics before the oldest ones roll off.
// ──────────────────────────────────────────────
const recentTopics = [];
const MAX_RECENT_TOPICS_TRACKED = 150;

// ──────────────────────────────────────────────
//  THE ACTUAL POSTING LOGIC — its own function so
//  it can run on both the 10 AM and 6 PM schedules,
//  AND be triggered manually (e.g. via /trigger-post).
//  Each call generates a brand new topic (never one
//  already used recently) plus a matching, non-repeated
//  image.
// ──────────────────────────────────────────────
async function runAutoPost() {
  console.log('\n📅 Auto-posting...');

  const topicResult = await generateFreshTopic(recentTopics);
  if (!topicResult || !topicResult.topic) {
    console.log('❌ Could not generate a fresh topic. Skipping this post.');
    return { success: false, reason: 'Could not generate topic' };
  }

  const { topic, imageKeyword } = topicResult;
  console.log(`   Topic: "${topic.slice(0, 70)}..."`);

  // Remember this topic so it's never repeated going forward
  recentTopics.push(topic);
  if (recentTopics.length > MAX_RECENT_TOPICS_TRACKED) {
    recentTopics.shift(); // forget the oldest once we're tracking plenty
  }

  const caption = await generatePostCaption(topic);
  if (!caption) {
    console.log('❌ Could not generate caption. Skipping this post.');
    return { success: false, reason: 'Could not generate caption' };
  }

  // Use a manually set image if you've configured one, otherwise fetch one automatically
  const imageUrl = process.env.DEFAULT_POST_IMAGE_URL || await fetchRelevantImage(imageKeyword);

  if (!imageUrl) {
    console.log('❌ No image available (manual or auto-fetched). Skipping this post.');
    return { success: false, reason: 'No image available' };
  }

  const postId = await createPost(imageUrl, caption);
  if (postId) {
    console.log(`✅ Post published! ID: ${postId}`);
    return { success: true, postId };
  }
  return { success: false, reason: 'Instagram publish failed — check logs' };
}

function startScheduler() {
  console.log('\n⏰ Aria\'s auto-scheduler is running');
  console.log('   • Auto-posts: Every day at 10:00 AM and 6:00 PM IST (2 posts/day, always fresh topics)');
  console.log('   • Reports: disabled (zero Claude API cost from scheduled reports)');

  // ──────────────────────────────────────────────
  //  AUTO-POST: Every day at 10:00 AM IST
  //  Fully automatic — generates the caption, fetches
  //  a matching image (never repeating a recent one),
  //  and publishes it directly. No approval step.
  //  This is the ONLY scheduled post — 1/day, as requested.
  // ──────────────────────────────────────────────
  cron.schedule('0 10 * * *', runAutoPost, { timezone: 'Asia/Kolkata' });

  // Second daily post, same logic, 6 PM IST — a fresh topic
  // is generated independently each time, so this is never
  // the same subject as the 10 AM post.
  cron.schedule('0 18 * * *', runAutoPost, { timezone: 'Asia/Kolkata' });

  // ──────────────────────────────────────────────
  //  DISABLED — Project spotlight post (used to run
  //  5 PM daily). Turned off to get back to 1 post/day,
  //  and because its small 6-image library was the likely
  //  source of repeated images. Still callable manually via
  //  /trigger-spotlight if you ever want to post one by hand.
  // ──────────────────────────────────────────────
  // cron.schedule('0 17 * * *', runProjectSpotlightPost, { timezone: 'Asia/Kolkata' });

  // ──────────────────────────────────────────────
  //  DISABLED — Daily research summary (used to run
  //  11 AM daily) and the AEC industry / lead reports
  //  (used to run Mon/Wed/Fri 9 AM). Both called Claude's
  //  API, which is never truly free — turned off entirely
  //  so this feature costs nothing. Say the word if you
  //  want either one back, at any frequency.
  // ──────────────────────────────────────────────
  // cron.schedule('0 11 * * *', async () => {
  //   console.log('\n🔬 Daily client research starting...');
  //   const { analysis } = await runFullResearch();
  //   await sendResearchSummaryToAdmin(analysis);
  //   console.log('✅ Research complete! Summary sent to you via DM.');
  // }, { timezone: 'Asia/Kolkata' });

  // cron.schedule('0 9 * * 1,3,5', async () => {
  //   console.log('\n📰 Fetching real news for reports (free — Google News RSS)...');
  //   const queries = [
  //     'real estate construction India',
  //     'architect developer project India',
  //     'AEC industry India news',
  //     'structural engineering India'
  //   ];
  //   let allNews = [];
  //   for (const q of queries) {
  //     const items = await fetchGoogleNews(q, 8);
  //     allNews.push(...items);
  //   }
  //   const uniqueNews = [...new Map(allNews.map(n => [n.title, n])).values()];
  //   if (uniqueNews.length === 0) return;
  //   const industryReport = await generateIndustryNewsReport(uniqueNews);
  //   if (industryReport) await sendIndustryReportToAdmin(industryReport);
  //   const leadReport = await generateLeadPotentialReport(uniqueNews);
  //   if (leadReport) await sendLeadReportToAdmin(leadReport);
  // }, { timezone: 'Asia/Kolkata' });

  // ──────────────────────────────────────────────
  //  STATUS CHECK: Every 6 hours
  // ──────────────────────────────────────────────
  cron.schedule('0 */6 * * *', () => {
    console.log(`\n💚 Aria is running — ${new Date().toLocaleString()}`);
  }, { timezone: 'Asia/Kolkata' });
}

module.exports = { startScheduler, runAutoPost, runProjectSpotlightPost };
