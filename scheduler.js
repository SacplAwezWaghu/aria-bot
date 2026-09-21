// ============================================================
//  scheduler.js — Aria's Automatic Task Manager
//  Content strategy: Structural Consultancy Marketing
// ============================================================

const cron = require('node-cron');
const { createPost, fetchRelevantImage, runFullResearch, fetchGoogleNews, sendResearchSummaryToAdmin, sendIndustryReportToAdmin, sendLeadReportToAdmin } = require('./instagram');
const { generatePostCaption, generateIndustryNewsReport, generateLeadPotentialReport } = require('./claude');

function startScheduler() {
  console.log('\n⏰ Aria\'s auto-scheduler is running');
  console.log('   • Auto-posts: Every day at 10:00 AM');
  console.log('   • Research:   Every day at 11:00 AM');

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
  //  AUTO-POST: Every day at 10:00 AM IST
  //  Fully automatic — generates the caption, fetches
  //  a matching image, and publishes it directly.
  //  No approval step.
  // ──────────────────────────────────────────────
  cron.schedule('0 10 * * *', async () => {
    console.log('\n📅 Auto-posting today...');

    const dayOfWeek = new Date().getDay();
    const topic = weeklyTopics[dayOfWeek];
    const imageKeyword = weeklyImageKeywords[dayOfWeek];

    console.log(`   Topic: "${topic.slice(0, 60)}..."`);

    const caption = await generatePostCaption(topic);
    if (!caption) {
      console.log('❌ Could not generate caption. Skipping today\'s post.');
      return;
    }

    // Use a manually set image if you've configured one, otherwise fetch one automatically
    const imageUrl = process.env.DEFAULT_POST_IMAGE_URL || await fetchRelevantImage(imageKeyword);

    if (!imageUrl) {
      console.log('❌ No image available (manual or auto-fetched). Skipping today\'s post.');
      return;
    }

    await createPost(imageUrl, caption);
  }, { timezone: 'Asia/Kolkata' });

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

module.exports = { startScheduler };
