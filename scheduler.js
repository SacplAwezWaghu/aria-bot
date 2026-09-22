// ============================================================
//  scheduler.js — Aria's Automatic Task Manager
//  Content strategy: Structural Consultancy Marketing
// ============================================================

const cron = require('node-cron');
const { createPost, fetchRelevantImage, runFullResearch, fetchGoogleNews, sendResearchSummaryToAdmin, sendIndustryReportToAdmin, sendLeadReportToAdmin } = require('./instagram');
const { generatePostCaption, generateIndustryNewsReport, generateLeadPotentialReport, generateProjectSpotlightCaption } = require('./claude');

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
//  POST TOPICS — 7-day rotation
//  Each topic targets a different client type
//  and positions you as the structural expert
// ──────────────────────────────────────────────
const weeklyTopics = [
  // Sunday
  'Why every architect needs a structural consultant from day one of design — and how it saves time, money and prevents project delays',

  // Monday
  'Common structural mistakes in construction projects that cost developers crores — and how to avoid them with proper structural planning',

  // Tuesday
  'Structural requirements for hospital buildings — why hospitals need specialized structural engineering for medical equipment loads, vibration control and safety',

  // Wednesday
  'How structural consultants make hotel construction successful — large span lobbies, rooftop pools, open floor plans and what it takes to build them safely',

  // Thursday
  'Structural audit — why you must get one before buying commercial or residential property, and what red flags to look for',

  // Friday
  'The role of a structural consultant in real estate development — from foundation design to final structure, how we protect your investment',

  // Saturday
  'Renovation projects and why a structural assessment is non-negotiable — what happens when you skip it and how to do it right'
];

// A short, specific search term per day, used to fetch a matching photo automatically
const weeklyImageKeywords = [
  'architect blueprint office',      // Sunday
  'construction site building',      // Monday
  'hospital building exterior',      // Tuesday
  'hotel lobby architecture',        // Wednesday
  'building inspection engineer',    // Thursday
  'real estate construction crane',  // Friday
  'building renovation construction' // Saturday
];

// ──────────────────────────────────────────────
//  THE ACTUAL POSTING LOGIC — its own function so
//  it can run on the 10 AM schedule AND be triggered
//  manually on demand (e.g. via the /trigger-post URL).
//  Each call picks a fresh caption + fresh image, so
//  calling it twice in one day gives two different posts.
// ──────────────────────────────────────────────
async function runAutoPost() {
  console.log('\n📅 Auto-posting...');

  const dayOfWeek = new Date().getDay();
  const topic = weeklyTopics[dayOfWeek];
  const imageKeyword = weeklyImageKeywords[dayOfWeek];

  console.log(`   Topic: "${topic.slice(0, 60)}..."`);

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
  console.log('   • Auto-posts: Every day at 10:00 AM IST');
  console.log('   • Research:   Every day at 11:00 AM IST');
  console.log('   • Weekly reports: Every Monday at 9:00 AM IST');

  // ──────────────────────────────────────────────
  //  AUTO-POST: Every day at 10:00 AM IST
  //  Fully automatic — generates the caption, fetches
  //  a matching image, and publishes it directly.
  //  No approval step.
  // ──────────────────────────────────────────────
  cron.schedule('0 10 * * *', runAutoPost, { timezone: 'Asia/Kolkata' });

  // ──────────────────────────────────────────────
  //  PROJECT SPOTLIGHT POST: Every day at 5:00 PM IST
  //  Second daily post — a real SACPL project, told
  //  as a story, cycling through the spotlight library.
  // ──────────────────────────────────────────────
  cron.schedule('0 17 * * *', runProjectSpotlightPost, { timezone: 'Asia/Kolkata' });

  // ──────────────────────────────────────────────
  //  RESEARCH: Every day at 11:00 AM
  //  Finds architects, developers, hotel owners,
  //  hospital builders, construction companies
  // ──────────────────────────────────────────────
  cron.schedule('0 11 * * *', async () => {
    console.log('\n🔬 Daily client research starting...');
    const { analysis } = await runFullResearch();
    await sendResearchSummaryToAdmin(analysis);
    console.log('✅ Research complete! Summary sent to you via DM.');
  }, { timezone: 'Asia/Kolkata' });

  // ──────────────────────────────────────────────
  //  WEEKLY REPORTS: Every Monday at 9:00 AM IST
  //  1. AEC industry news
  //  2. Lead potential (from real headlines only)
  //  100% free — uses Google News RSS + normal Claude
  //  text generation, no paid search tool.
  // ──────────────────────────────────────────────
  cron.schedule('0 9 * * 1', async () => {
    console.log('\n📰 Fetching real news for weekly reports (free — Google News RSS)...');

    const queries = [
      'real estate construction India',
      'architect developer project India',
      'AEC industry India news',
      'structural engineering India'
    ];

    let allNews = [];
    for (const q of queries) {
      const items = await fetchGoogleNews(q, 8);
      allNews.push(...items);
    }

    // Remove duplicate headlines across the different searches
    const uniqueNews = [...new Map(allNews.map(n => [n.title, n])).values()];
    console.log(`   Found ${uniqueNews.length} unique headlines`);

    if (uniqueNews.length === 0) {
      console.log('❌ No news found this week — skipping reports.');
      return;
    }

    const industryReport = await generateIndustryNewsReport(uniqueNews);
    if (industryReport) {
      await sendIndustryReportToAdmin(industryReport);
      console.log('✅ Industry report sent.');
    } else {
      console.log('❌ Could not generate industry report.');
    }

    const leadReport = await generateLeadPotentialReport(uniqueNews);
    if (leadReport) {
      await sendLeadReportToAdmin(leadReport);
      console.log('✅ Lead report sent.');
    } else {
      console.log('❌ Could not generate lead report.');
    }
  }, { timezone: 'Asia/Kolkata' });

  // ──────────────────────────────────────────────
  //  STATUS CHECK: Every 6 hours
  // ──────────────────────────────────────────────
  cron.schedule('0 */6 * * *', () => {
    console.log(`\n💚 Aria is running — ${new Date().toLocaleString()}`);
  }, { timezone: 'Asia/Kolkata' });
}

module.exports = { startScheduler, runAutoPost, runProjectSpotlightPost };
