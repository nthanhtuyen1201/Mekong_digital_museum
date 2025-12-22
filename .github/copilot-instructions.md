đư## Copilot / AI instructions NLNganh-QL

Museum management app: single-process Flask backend serving static frontend, MongoDB storage, focused on Mekong Delta cultural heritage.

### Core architecture

**Backend (backend/app.py, ~960 lines)**

- Flask app on port 5000; serves static frontend from `../frontend` and `/uploads` images
- MongoDB via `mongo_utils.py` (database: `mekong_museum`, collections: `places`, `events`, `artifacts`, `admins`)
- Session-based admin auth with bcrypt-hashed passwords in MongoDB; credentials from environment variables
- CORS enabled for dev; multipart/form-data handling for image uploads
- Uploads organized by province/type/item: `uploads/{province}/{type}/{item_name}/{uuid.hex}_{secure_filename}`

**Frontend (static HTML/CSS/JS)**

- `index.html` + `app.js` homepage with hero slider, search, featured content
- `detail.html` + `detail.js` item detail page with image gallery, map (Leaflet), related items
- `list.html` + `list.js` browse/filter all items by type and province
- `admin.html` + `admin.js` CRUD interface (tab-based for artifacts/events/places)
- `login.html` + `login.js` admin login form

### Critical conventions (non-negotiable)

**Document IDs**: Custom string `id` field (NOT Mongo `_id`). Format: `{prefix}{uuid.hex[:12]}` where prefix is `a` (artifacts), `e` (events), `p` (places). Example: `a3f8c9d12e4b`. Always preserve/generate this format in create/update operations.

**Media uploads**: Saved to `backend/uploads/` organized by type:

- Images: `{uuid.hex}_{secure_filename}`. Extensions: `png,jpg,jpeg,gif`
- Videos: Stored in `videos/` subdirectory. Extensions: `mp4,webm,mov,avi`
- Audios: Stored in `audios/` subdirectory. Extensions: `mp3,wav,m4a,ogg,flac`

Served at `/uploads/{path}`. Frontend expects `images: [...]`, `videos: [...]`, `audios: [...]` arrays in all responses; **preserve existing media when no new files uploaded**.

**Province mapping**: `derive_province(doc)` function (app.py lines 84-129) extracts province from `location`/`address` fields and maps old Mekong Delta provinces to 6 merged units. Auto-called on create/update if `province` missing. Maps:

- Cần Thơ Cần Thơ, Sóc Trăng, Hậu Giang
- Vĩnh Long Vĩnh Long, Bến Tre, Trà Vinh
- Đồng Tháp Đồng Tháp, Tiền Giang
- Cà Mau Cà Mau, Bạc Liêu
- An Giang An Giang, Kiên Giang
- Tây Ninh Tây Ninh, Long An

**Keep this logic intact** it's core to Mekong Delta consolidation.

**Relational linking**:

- Artifacts link to places via `museum` field (id or name); backend auto-enriches with place data (address, lat/lng, etc.)
- Events link to places via `location` field; similar auto-enrichment
- Places auto-discover related artifacts/events via regex matching on names/locations (see `/api/item/<id>` in app.py ~lines 326-410)

### API surface (port 5000)

**Public endpoints**:

- `GET /api/places`, `/api/events`, `/api/artifacts` list all
- `GET /api/item/<id>` detail view with auto-enrichment (museum_place, event_place, related items)
- `GET /api/search?q=<query>` search across all collections (name, address, province, era, year, type keywords)
- `GET /api/items?ids=id1,id2,...` batch fetch by comma-separated ids

**Admin endpoints** (require `admin_logged_in` session):

- `GET /api/admin/<type>` list items (type: artifacts, events, places)
- `POST /api/admin/<type>` create (or update if `id` in payload). Accepts JSON or multipart/form-data. Multipart keys: `images` (multiple files), `videos` (multiple files), `audios` (multiple files), `related_artifacts`/`related_events` (comma-separated ids), `links` (JSON string), other fields as text. Auto-generates id if missing.
- `PUT /api/admin/<type>/<id>` update. **Must preserve existing `images`, `videos`, and `audios` arrays if no new files**.
- `DELETE /api/admin/<type>/<id>` delete item

**Auth endpoints**:

- `POST /api/login` `{username, password}` verifies against bcrypt-hashed password in `admins` collection, sets session
- `POST /api/logout` clears session
- `GET /api/check_login` returns `{logged_in: true/false, username: "name"}`
- `GET /api/current_user` returns current user object without password; requires login
- `POST /api/init-admin` one-time setup endpoint; creates admin account from environment variables (`ADMIN_USER`, `ADMIN_PASS`). Only works if no admins exist.

**Admin user management** (require `admin_logged_in` session):

- `GET /api/admin/users` list all admin accounts (passwords excluded)
- `POST /api/admin/users` create new admin account. Body: `{username, password}`
- `PUT /api/admin/users/<username>/password` change password. Body: `{new_password, old_password}` (old_password required if changing own password)
- `DELETE /api/admin/users/<username>` delete admin account (cannot delete self)

### Dev workflow

**Start server** (requires MongoDB running on localhost:27017):

```powershell
cd backend
python app.py
```

Server at `http://localhost:5000`. Frontend auto-served from root.

**Dependencies**:

```powershell
cd backend
pip install -r requirements.txt
```

Contents: flask, flask-cors, pymongo, werkzeug, bcrypt, python-dotenv

**Environment setup**: Copy `backend/.env.example` to `backend/.env` and configure:

- `SECRET_KEY` Flask session secret (use strong random value in production)
- `ADMIN_USER` initial admin username (default: "admin")
- `ADMIN_PASS` initial admin password (default: "12345", **change in production**)
- Optional: `MONGO_URI`, `MONGO_DB` for custom MongoDB connection (defaults: localhost:27017, database "mekong_museum")

**Database setup**: Connection string in `mongo_utils.py` (localhost:27017, database: `mekong_museum`). Collections auto-created on first insert. No migrations needed schema-free MongoDB.

**First-time admin setup**: After starting server, call `POST /api/init-admin` once to create admin account with hashed password from `.env` variables. See `backend/TEST_ADMIN.md` for step-by-step setup instructions.

### Key files to inspect

- [backend/app.py](backend/app.py) all routing, ID generation, upload handling (images/videos/audios), province derivation, relational enrichment, bcrypt password hashing
- [backend/mongo_utils.py](backend/mongo_utils.py) thin MongoDB wrapper; all queries strip `_id` via projection
- [backend/.env.example](backend/.env.example) template for environment variables
- [backend/TEST_ADMIN.md](backend/TEST_ADMIN.md) instructions for first-time admin account setup
- [frontend/js/admin.js](frontend/js/admin.js) FormData construction (~line 199), tab switching, relation selects, video/audio preview setup
- [frontend/js/detail.js](frontend/js/detail.js) image gallery with lightbox, Leaflet map integration, related items rendering, video/audio player rendering
- [frontend/js/app.js](frontend/js/app.js) hero slider (auto-play + video), search UX, featured sections

### Frontend-backend contract

**Admin form submission** (admin.js ~line 199):

- Uses `FormData` for multipart upload
- Key mappings: `related_artifacts` comma-separated string, `links` JSON.stringify array
- Checks `itemId` hidden field to determine POST (create) vs PUT (update)
- Video/audio files sent via `videos` and `audios` form keys (multiple files allowed)

**Detail page enrichment** (app.py ~lines 326-410):

- Places: backend auto-populates `related_artifacts` and `related_events` via regex on names/locations
- Artifacts: backend adds `museum_place` object with place id/name, inherits address/lat/lng if missing
- Events: backend adds `event_place` object, inherits location fields
- All items: media arrays (`images`, `videos`, `audios`) included in response; frontend renders with HTML5 players

**Video/Audio rendering** (detail.js ~lines 148-216):

- Videos rendered with native HTML5 `<video>` player (play, pause, fullscreen, volume controls)
- Audios rendered with native HTML5 `<audio>` player (play, pause, timeline, volume controls)
- Videos section hidden if no videos; same for audio
- Expected response format: `{..., videos: ["path1", "path2"], audios: ["path1", "path2"]}`

**Search** (app.py ~lines 453-498):

- Searches across `name`/`title`, `address`, `province`, `era`, `year`, `time` fields
- Includes type keywords (e.g., "cổ vật", "di tích") to filter by collection via search term

### Conventions to preserve

1. **ID format** always `{prefix}{12-char hex}`. Changing breaks frontend routing.
2. **Media arrays** always present in responses: `images`, `videos`, `audios`. PUT/POST must preserve existing arrays if no new uploads.
3. **Media organization** videos/audios stored in separate subdirectories within `uploads/`. Paths returned as relative URIs (e.g., `videos/{province}/{type}/{item}/{filename}`).
4. **Province derivation** auto-called on create/update. Maps old provinces 6 units. Don't bypass.
5. **CORS** enabled globally. Removing breaks frontend in dev.
6. **Password security** always use bcrypt for hashing; verify with `verify_password()`. Never store plain passwords.
7. **Environment variables** `.env` file must exist and contain SECRET_KEY, ADMIN_USER, ADMIN_PASS. File is git-ignored.
8. **Uploads folder** `backend/uploads/` must exist. Created on startup if missing via `os.makedirs(UPLOAD_FOLDER, exist_ok=True)`.
9. **Allowed extensions** image (png, jpg, jpeg, gif), video (mp4, webm, mov, avi), audio (mp3, wav, m4a, ogg, flac). Checked in `allowed_file()` function.

### Before committing changes

- If modifying request/response fields update both `backend/app.py` and `frontend/js/admin.js`, `detail.js`, `app.js`
- If changing auth flow update `login.js` and all admin endpoints
- **Never commit `.env` file** it's git-ignored; use `.env.example` for templates
- Test admin login ensure bcrypt verification works with hashed passwords in MongoDB
- Test multipart upload use admin UI or PowerShell: `Invoke-WebRequest -Uri "http://localhost:5000/api/admin/artifacts" -Method POST -Form @{name='Test'; images=Get-Item 'img.jpg'; videos=Get-Item 'video.mp4'} -Headers @{Cookie='session=...'}`
- Test video/audio rendering create item with media via admin UI, verify HTML5 players render on detail page
- Verify province mapping check logs for `derive_province()` output on create/update
- Verify media preservation update item without new files, ensure existing videos/audios remain
- MongoDB must be running on localhost:27017 before starting the app
