# Game-SpotLight
GameSpotlight is now split into a React client and a Spring Boot server.

## Structure
- `client/` - React + Vite + Tailwind storefront UI
- `server/` - Spring Boot API, security, MongoDB, and backend run scripts

## Backend
From the `server/` folder:

```powershell
cd server
.\mvnw.cmd spring-boot:run
```

Or use the bundled script:

```powershell
cd server
.\run.ps1
```

Tests:

```powershell
cd server
.\mvnw.cmd -q test
```

## Frontend
From the `client/` folder:

```powershell
cd client
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8080`, so the React app can use the same session-based backend endpoints without extra CORS setup.

## Local configuration
Sensitive backend config should stay out of version control.

- `server/src/main/resources/application-local.properties` for local runtime overrides.
- `server/src/test/resources/application-local.properties` for tests.
- `.env.example` at the repo root shows the recommended environment variables.

Example environment variables:

```powershell
SPRING_DATA_MONGODB_URI="mongodb+srv://<user>:<password>@cluster0.xyz.mongodb.net/gamestore2?retryWrites=true&w=majority"
SPRING_SERVER_PORT=8080
```

`SPRING_DATA_MONGODB_URI` maps directly to `spring.data.mongodb.uri`.

## Supabase storage setup
Buckets already created in Supabase can be connected with environment variables.

Required env vars:

```powershell
AUTH_SUPABASE_URL="https://<auth-project-ref>.supabase.co"
AUTH_SUPABASE_ANON_KEY="<auth-anon-key>"
STORAGE_SUPABASE_URL="https://<storage-project-ref>.supabase.co"
STORAGE_SUPABASE_KEY="<storage-service-role-key>"
```

Optional bucket names (defaults shown):

```powershell
SUPABASE_IMAGES_BUCKET=game-images
SUPABASE_FILES_BUCKET=game-files
SUPABASE_FILES_PUBLIC=false
```

Optional validation limits (bytes):

```powershell
SUPABASE_MAX_IMAGE_BYTES=5242880
SUPABASE_MAX_GAME_BYTES=524288000
```

How uploads now work:
- The developer workspace submits game metadata plus files as `multipart/form-data`.
- The backend uploads files to Supabase Storage and stores returned public URLs in MongoDB.
- Cover and gallery images are stored as public URLs.
- Game files are stored as private references when `SUPABASE_FILES_PUBLIC=false`.
- Downloads are generated through signed URLs (default expiry 1 hour).
- Supported file fields: `coverImage`, `gameFile`, and multiple `galleryImages`.
- Metadata is submitted as a JSON string in the `metadata` form part.

Developer endpoints:
- `POST /api/developer/games/add-with-files`
- `PUT /api/developer/games/{gameId}/with-files`

User secure download endpoint:
- `GET /api/user/games/{gameId}/download-url`

Asset lifecycle:
- Replaced files are deleted from Supabase during developer file updates.
- Game assets are deleted from Supabase when a game is deleted.
