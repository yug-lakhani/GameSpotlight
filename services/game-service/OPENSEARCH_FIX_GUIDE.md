# OpenSearch Abbreviation Search Fix - Complete Guide

## Problem
Searching for "rc" (Real Cricket) and "bs" (Brawl Stars) returns 0 results in OpenSearch, even though these games exist in the database.

**Current logs show:**
```
OpenSearch search returned 0 result(s) from index 'games', extracted 0 IDs for query='rc'
OpenSearch search returned 0 result(s) from index 'games', extracted 0 IDs for query='bs'
```

## Root Causes
1. ✗ OpenSearch index doesn't have the new `abbreviation` field (old schema)
2. ✗ Games in MongoDB don't have `abbreviation` values yet
3. ✗ OpenSearch isn't using the new search query configuration

## Solution Steps

### Step 1: Update Games with Abbreviations (MongoDB)

**Option A: Run Migration Script in MongoDB Atlas**

1. Go to [MongoDB Atlas Console](https://cloud.mongodb.com/v2)
2. Select your cluster → Collections tab
3. Click **>_** (mongosh terminal) in top right
4. Copy and paste the contents of `mongodb-update-abbreviations.js`
5. Execute the script
6. Verify it shows updated games with abbreviations

**Option B: Run via mongosh CLI**
```bash
mongosh "mongodb+srv://utsav:<password>@cluster0.yslwcbv.mongodb.net/game-db" < mongodb-update-abbreviations.js
```

### Step 2: Configure OpenSearch Rebuild

✅ **Already configured in `.env`:**
```env
OPENSEARCH_REBUILD_ON_STARTUP=true
OPENSEARCH_BACKFILL_ON_STARTUP=true
```

These settings will:
- Delete the old index on startup
- Create a new index with `abbreviation` field
- Backfill it with updated games from MongoDB

### Step 3: Restart Game Service

Run from `services/` directory:

```bash
# Stop and remove old containers
docker compose down

# Rebuild with latest code
docker compose up --build game

# Wait for service to start, you should see:
# [INFO] OpenSearchService initialization starting
# [INFO] OpenSearch index 'games' created or already available
# [INFO] Starting OpenSearch index backfill with X game(s)
```

### Step 4: Verify the Fix

**In browser or curl:**

```bash
# Search for "rc"
curl "http://localhost:8082/api/games/semantic-search?query=rc&page=1"

# Search for "bs"
curl "http://localhost:8082/api/games/semantic-search?query=bs&page=1"

# Should return games with titles matching Real Cricket / Brawl Stars
```

**In logs, you should see:**
```
OpenSearch semantic search requested for query='rc'
OpenSearch search returned X result(s) from index 'games'
```

## What Changed in Code

### 1. Game Entity
- Added: `private String abbreviation;` field

### 2. GameDTO
- Added: `private String abbreviation;` field

### 3. OpenSearchService
- Updated index mapping to include `abbreviation` field with `searchTextField()` type
- Updated `searchGamesByTitle()` to search abbreviation with **10x weight boost** (`abbreviation^10`)
- Updated `searchGameIds()` for semantic search with abbreviation priority
- Updated `toDocument()` to index abbreviation values

### 4. Configuration
- `.env`: Added `OPENSEARCH_SYNONYM_RULES` with `rc=Real Cricket,bs=Brawl Stars`
- `.env`: Added `OPENSEARCH_REBUILD_ON_STARTUP=true`
- `application.properties`: Updated with same values

## Testing Checklist

- [ ] MongoDB update script ran successfully
- [ ] Game service restarted and rebuilt OpenSearch index
- [ ] Search for "rc" returns Real Cricket game
- [ ] Search for "bs" returns Brawl Stars game  
- [ ] Search for "coc" returns Clash of Clans game
- [ ] Abbreviations appear in API responses in `abbreviation` field

## Troubleshooting

### If "0 results" still appears after restart:

1. **Check MongoDB connection:**
   ```bash
   docker compose logs game | grep -i "mongodb"
   ```
   Look for "Successfully connected"

2. **Check OpenSearch index creation:**
   ```bash
   docker compose logs game | grep -i "opensearch"
   ```
   Look for "index created or already available"

3. **Manual index delete + rebuild:**
   - Set `OPENSEARCH_REBUILD_ON_STARTUP=true`
   - Restart service: `docker compose down && docker compose up --build game`

4. **Verify games have abbreviations in MongoDB:**
   ```bash
   mongosh "mongodb+srv://utsav:<password>@cluster0.yslwcbv.mongodb.net/game-db"
   use game-db
   db.games.find({}, {title: 1, abbreviation: 1}).limit(5)
   ```

## Performance Notes

- Abbreviations get **10x priority** in search boosting
- Synonyms are expanded at index time (not query time)
- `prefix_length: 0` allows matching from first character

---

**Timeline:** Run MongoDB update → Restart service → Verify with test searches
