const { MongoClient } = require('mongodb');

const MONGO_URI = '[REDACTED-MONGO-GAME]';

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');

    const db = client.db('game-db');
    const gamesCollection = db.collection('games');

    // Generate abbreviations dynamically
    function buildAbbreviation(title) {
      if (!title) return null;

      const normalized = String(title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

      if (!normalized) return null;

      // Multi-word titles: use first letters of up to 4 words
      const words = normalized.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        return words.slice(0, 4).map((w) => w[0]).join('');
      }

      // Single word: use first 2-3 letters
      return normalized.substring(0, Math.min(3, normalized.length));
    }

    // Fetch all games and build abbreviations
    const games = await gamesCollection.find({}).toArray();
    console.log(`Found ${games.length} game(s)`);

    let matchedCount = 0;
    let modifiedCount = 0;

    for (const game of games) {
      matchedCount += 1;
      const abbreviation = buildAbbreviation(game.title);

      if (!abbreviation || game.abbreviation === abbreviation) {
        continue;
      }

      const result = await gamesCollection.updateOne(
        { _id: game._id },
        { $set: { abbreviation } }
      );

      modifiedCount += result.modifiedCount || 0;
    }

    console.log(`Matched: ${matchedCount}, Updated: ${modifiedCount}`);

    // Show sample
    console.log('\nSample games with abbreviations:');
    const samples = await gamesCollection
      .find({}, { projection: { title: 1, abbreviation: 1 } })
      .limit(20)
      .toArray();

    samples.forEach((game) => {
      console.log(`  ${game.title} -> ${game.abbreviation}`);
    });
  } finally {
    await client.close();
  }
}

main().catch(console.error);
