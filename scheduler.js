// ============================================================
//  scheduler.js — Aria's Automatic Task Manager
//  Content strategy: Structural Consultancy Marketing
// ============================================================

const cron = require('node-cron');
const { createPost, runFullResearch } = require('./instagram');
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
  // ──────────────────────────────────────────────
  cron.schedule('0 10 * * *', async () => {
    console.log('\n📅 Daily auto-post starting...');

    const dayOfWeek = new Date().getDay();
    const topic = weeklyTopics[dayOfWeek];
    console.log(`   Topic: "${topic.slice(0, 60)}..."`);

    const caption = await generatePostCaption(topic);

    if (!caption) {
      console.log('❌ Could not generate caption. Skipping today\'s post.');
      return;
    }

    const imageUrl = process.env.DEFAULT_POST_IMAGE_URL;

    if (!imageUrl) {
      console.log('\n📝 Today\'s generated post caption:');
      console.log('─'.repeat(60));
      console.log(caption);
      console.log('─'.repeat(60));
      console.log('💡 To auto-publish: set DEFAULT_POST_IMAGE_URL in your .env file');
    } else {
      await createPost(imageUrl, caption);
    }
  });

  // ──────────────────────────────────────────────
  //  RESEARCH: Every day at 11:00 AM
  //  Finds architects, developers, hotel owners,
  //  hospital builders, construction companies
  // ──────────────────────────────────────────────
  cron.schedule('0 11 * * *', async () => {
    console.log('\n🔬 Daily client research starting...');
    await runFullResearch();
    console.log('✅ Research complete! Check report file for new potential clients.');
  });

  // ──────────────────────────────────────────────
  //  STATUS CHECK: Every 6 hours
  // ──────────────────────────────────────────────
  cron.schedule('0 */6 * * *', () => {
    console.log(`\n💚 Aria is running — ${new Date().toLocaleString()}`);
  });
}

module.exports = { startScheduler };
