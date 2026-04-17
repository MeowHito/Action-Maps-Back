# Route Tracker — Backend API

NestJS 11 + MongoDB (Mongoose) + Socket.io. Storage is pluggable (`local` for dev,
`s3` for production / S3-compatible like MinIO or Cloudflare R2).

## Quick start

```powershell
# 1. copy env
Copy-Item .env.example .env

# 2. start MongoDB locally (docker example)
docker run -d --name mongo -p 27017:27017 mongo:7

# 3. run dev server
npm run start:dev
```

Default base URL: `http://localhost:3001`
- REST:   `http://localhost:3001/api/...`
- Static: `http://localhost:3001/uploads/...` (only when `STORAGE_DRIVER=local`)
- WebSocket: `ws://localhost:3001` (Socket.io)

## Architecture

```
src/
  common/storage/        StorageService (local | s3)  — single abstraction
  events/                Event (slug)   → CRUD
  routes/                Route (GPX)    → upload tied to event
  photos/                Photo (jpg)    → upload tied to event
  realtime/              Socket.io gateway (one room per event slug)
```

**Design notes**
- Frontend keeps doing HEIC→JPG conversion and EXIF GPS extraction client-side
  (Backend trusts `lat`/`lng` from the form). Keeps the server CPU-light.
- Uploads go to memory, then stream to the storage provider — no temp files.
- Mongoose indexes: `slug` unique on events, `{eventId, createdAt}` on photos/routes,
  `{eventId, lat, lng}` for bbox queries later.
- Socket.io emits room-scoped events (`event:<slug>`). REST writes emit, reads don't.

## REST endpoints

All prefixed with `/api`.

### Events
| Method | Path              | Body                                                    |
| ------ | ----------------- | ------------------------------------------------------- |
| POST   | `/events`         | `{ slug, name, description?, startsAt?, endsAt? }`      |
| GET    | `/events`         | `?limit=50&skip=0`                                       |
| GET    | `/events/:slug`   | —                                                       |
| PATCH  | `/events/:slug`   | `{ name?, description?, startsAt?, endsAt? }`           |
| DELETE | `/events/:slug`   | —                                                       |

### Routes (GPX)
| Method | Path                        | Body (multipart)                            |
| ------ | --------------------------- | ------------------------------------------- |
| GET    | `/events/:slug/routes`      | —                                           |
| POST   | `/events/:slug/routes`      | `file` (.gpx), `name`, `color?` (hex)       |
| DELETE | `/routes/:id`               | —                                           |

### Photos (JPG)
| Method | Path                        | Body (multipart)                                                |
| ------ | --------------------------- | --------------------------------------------------------------- |
| GET    | `/events/:slug/photos`      | `?limit=500&skip=0`                                              |
| POST   | `/events/:slug/photos`      | `file` (image), `lat`, `lng`, `width?`, `height?`, `takenAt?`, `uploader?` |
| DELETE | `/photos/:id`               | —                                                               |

### Example

```bash
# create event
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"slug":"chiang-mai-trail-2026","name":"CNX Trail 2026"}'

# upload a photo (jpg) with GPS coords from the frontend
curl -X POST http://localhost:3001/api/events/chiang-mai-trail-2026/photos \
  -F "file=@IMG_0001.jpg" \
  -F "lat=18.7953" \
  -F "lng=98.9986"

# upload a GPX route
curl -X POST http://localhost:3001/api/events/chiang-mai-trail-2026/routes \
  -F "file=@course.gpx" \
  -F "name=Full Course" \
  -F "color=#ff4d4d"
```

## Realtime (Socket.io)

Client joins the room for an event and listens for updates:

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3001');

socket.emit('join', { slug: 'chiang-mai-trail-2026' });

socket.on('photo:created',  (photo) => { /* add marker */ });
socket.on('photo:deleted',  ({ id }) => { /* remove marker */ });
socket.on('route:created',  (route) => { /* draw polyline */ });
socket.on('route:deleted',  ({ id }) => { /* remove polyline */ });
```

Server-emitted events (room-scoped to `event:<slug>`):
- `photo:created` — full photo document
- `photo:deleted` — `{ id }`
- `route:created` — full route document
- `route:deleted` — `{ id }`
- `event:updated` — reserved for future use

## Storage drivers

### local (default)
Files saved under `./uploads/events/<eventId>/{photos|routes}/<file>` and served
at `/uploads/*` by `ServeStaticModule`. Good for development.

### s3 (production)
Set in `.env`:
```
STORAGE_DRIVER=s3
S3_REGION=ap-southeast-1
S3_BUCKET=my-bucket
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
# for MinIO / R2:
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL=https://cdn.example.com   # CDN in front of the bucket (optional)
```

No code changes required — `StorageService` reads the driver at boot.

## Upload limits

`.env`:
```
MAX_PHOTO_SIZE_MB=12
MAX_GPX_SIZE_MB=10
```

## Next steps (Frontend migration)

The `frontend/frontend/` Next.js app (Tailwind) will:
1. Replace IndexedDB calls with REST calls to this API.
2. Keep the existing client-side HEIC→JPG conversion and EXIF GPS extraction.
3. Open a Socket.io connection on the event page and `emit('join', { slug })`.
4. Render the map with Leaflet + leaflet.markercluster, identical UX to the prototype.
