// ============================================================
//  scheduler.js — Aria's Automatic Task Manager
//  Content strategy: Structural Consultancy Marketing
// ============================================================

const cron = require('node-cron');
const { sendPostForApproval, runFullResearch, sendResearchSummaryToAdmin } = require('./instagram');
const { generatePostCaption } = require('./claude');

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

  // ──────────────────────────────────────────────
  //  AUTO-POST: Every day at 10:00 AM
  //  Generates TOMORROW's post and sends it to you for
  //  approval today — gives you a full day to review or
  //  request changes before it's actually due to go out.
  // ──────────────────────────────────────────────
  cron.schedule('0 10 * * *', async () => {
    console.log('\n📅 Generating tomorrow\'s post for your approval...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayOfWeek = tomorrow.getDay();
    const topic = weeklyTopics[dayOfWeek];
    const forDateLabel = tomorrow.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

    console.log(`   For: ${forDateLabel}`);
    console.log(`   Topic: "${topic.slice(0, 60)}..."`);

    const caption = await generatePostCaption(topic);

    if (!caption) {
      console.log('❌ Could not generate caption. Skipping.');
      return;
    }

    const imageUrl = process.env.DEFAULT_POST_IMAGE_URL;
    await sendPostForApproval(imageUrl, caption, topic, forDateLabel);
  });

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
  });

  // ──────────────────────────────────────────────
  //  STATUS CHECK: Every 6 hours
  // ──────────────────────────────────────────────
  cron.schedule('0 */6 * * *', () => {
    console.log(`\n💚 Aria is running — ${new Date().toLocaleString()}`);
  });
}

module.exports = { startScheduler };
