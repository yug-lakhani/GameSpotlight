/**
 * MongoDB Migration Script: Add abbreviations to games
 * 
 * This script adds abbreviation field to games based on their titles.
 * Run this in MongoDB Atlas:
 * 
 * 1. Go to MongoDB Atlas console
 * 2. Click "DATABASES" > select your cluster
 * 3. Click "Collections" tab
 * 4. Click ">_" (mongosh terminal) in top right
 * 5. Paste this script and execute
 * 
 * Or use mongosh CLI:
 * mongosh "mongodb+srv://utsav:<password>@cluster0.yslwcbv.mongodb.net/game-db" < mongodb-update-abbreviations.js
 */

// Use the game-db database
db = db.getSiblingDB('game-db');

// Title-to-abbreviation map for known games.
// The script also falls back to a generated abbreviation so every document gets one.
const abbreviationMap = new Map([
  ['rocket car', 'rc'],
  ['real cricket', 'rc'],
  ['brawl stars', 'bs'],
  ['clash of clans', 'coc'],
  ['clash royale', 'cr'],
  ['bgmi', 'bgmi'],
  ['battlegrounds mobile india', 'bgmi'],
  ['pubg mobile', 'pubg'],
  ['call of duty mobile', 'codm'],
  ['free fire', 'ff'],
  ['among us', 'au'],
  ['candy crush', 'cc'],
  ['angry birds', 'ab'],
  ['fortnite', 'fn'],
  ['minecraft', 'mc'],
  ['roblox', 'rblx']
]);

function slugifyTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildAbbreviation(title) {
  const normalizedTitle = slugifyTitle(title);
  if (!normalizedTitle) {
    return null;
  }

  if (abbreviationMap.has(normalizedTitle)) {
    return abbreviationMap.get(normalizedTitle);
  }

  // Use the first letters of up to 4 words, which works well for game titles.
  const words = normalizedTitle.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.slice(0, 4).map((word) => word[0]).join('');
  }

  // Single-word fallback: use the first 2-3 letters.
  return normalizedTitle.substring(0, Math.min(3, normalizedTitle.length));
}

const cursor = db.games.find({}, { title: 1, abbreviation: 1 });
let matchedCount = 0;
let modifiedCount = 0;

cursor.forEach((game) => {
  matchedCount += 1;
  const abbreviation = buildAbbreviation(game.title);
  if (!abbreviation || game.abbreviation === abbreviation) {
    return;
  }

  const updateResult = db.games.updateOne(
    { _id: game._id },
    { $set: { abbreviation } }
  );

  modifiedCount += updateResult.modifiedCount || 0;
});

print(`Matched ${matchedCount} game(s)`);
print(`Updated ${modifiedCount} game(s)`);

print('\nSample games with abbreviations:');
db.games
  .find({}, { title: 1, abbreviation: 1 })
  .limit(20)
  .forEach((game) => {
    print(`  ${game.title} -> ${game.abbreviation}`);
  });
