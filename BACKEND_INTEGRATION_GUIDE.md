# Backend Integration Guide & API Specification
## Project: Abandoned but Not Forgotten (Space Apps Challenge 2026)

> **Target Audience:** Backend Engineer (Django & DRF) & AI / RAG Engineer.  
> **Frontend Stack:** React 19 + TypeScript + Vite + Three.js + GSAP (Deployed to Cloudflare Pages).  
> **Backend Stack:** Python + Django + Django REST Framework + Google Gemini API (Deployed to Render Free).

---

## 1. System Overview & Architecture

```
┌──────────────────────────────────────────────┐
│             VISITOR BROWSER                  │
│       React + Three.js + GSAP (Vite)         │
│          Hosted on Cloudflare Pages          │
└───────────────────────┬──────────────────────┘
                        │
                        │ HTTPS (REST API calls)
                        ▼
┌──────────────────────────────────────────────┐
│           DJANGO BACKEND (DRF)               │
│          Hosted on Render Free Tier          │
│       https://<your-service>.onrender.com    │
└───────────────┬──────────────────────┬───────┘
                │                      │
                ▼                      ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│     JSON KNOWLEDGE        │  │     GEMINI API (RAG)      │
│  missions.json / vectors  │  │  Gemini Flash + Embedding │
└───────────────────────────┘  └───────────────────────────┘
```

The Frontend is fully resilient: it has built-in local mission data and fallbacks in `catalog.ts` and `tour.ts`. If the backend is waking up (Render cold-start ~50s) or offline, the 3D cinematic tour continues smoothly. The backend primarily serves dynamic mission content and powers the **"Ask the Archive" (NASA RAG AI)** drawer.

---

## 2. Environment Configuration

### Frontend Environment Variable
The Frontend reads a single environment variable:
```env
# Front/.env (or set in Cloudflare Pages Build Environment Variables)
VITE_API_BASE_URL=https://your-api.onrender.com
```
*In local development, if omitted or empty, frontend falls back to local data and relative endpoints.*

### Backend Environment Variables (`render.yaml` or Render Dashboard)
```env
DEBUG=False
SECRET_KEY=your-production-django-secret-key
ALLOWED_HOSTS=your-api.onrender.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://your-frontend.pages.dev,http://localhost:5173
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-2.0-flash
EMBEDDING_MODEL=text-embedding-004
```

> [!IMPORTANT]
> **CORS Configuration:**  
> Use `django-cors-headers`. Allow the Cloudflare Pages production domain and local Vite dev server:
> ```python
> CORS_ALLOWED_ORIGINS = [
>     "https://your-frontend.pages.dev",
>     "http://localhost:5173",
>     "http://127.0.0.1:5173",
> ]
> CORS_ALLOW_CREDENTIALS = True
> ```

---

## 3. Required REST API Endpoints

| Method | Endpoint | Purpose | Required Response Code |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health/` | Service health check & cold-start wake-up ping | `200 OK` |
| `GET` | `/api/planets/` | Available celestial bodies and tour order | `200 OK` |
| `GET` | `/api/planets/{planet}/missions/` | The 3 missions belonging to a specific planet | `200 OK` |
| `GET` | `/api/missions/{id}/` | Full mission profile, specs, chapters & narrative text | `200 OK` |
| `POST` | `/api/ai/ask/` | NASA-grounded RAG query from the Archive chat drawer | `200 OK` |

---

## 4. API Request & Response Contracts

### 4.1. Health Check
- **Endpoint:** `GET /api/health/`
- **Purpose:** Used by the frontend upon loading to verify backend availability and wake Render up if asleep.
- **Response `200 OK`:**
```json
{
  "status": "healthy",
  "timestamp": "2026-11-14T01:50:00Z",
  "service": "Space-Legacy-API"
}
```

---

### 4.2. List Planets
- **Endpoint:** `GET /api/planets/`
- **Response `200 OK`:**
```json
[
  {
    "id": "moon",
    "name": "The Moon",
    "order": 1,
    "artifact_count": 3,
    "summary": "Historic lunar landings: Apollo 11, Surveyor 3, and Apollo 15 LRV."
  },
  {
    "id": "mars",
    "name": "Mars",
    "order": 2,
    "artifact_count": 3,
    "summary": "Martian robotic explorers: Sojourner, Spirit, and Opportunity."
  }
]
```

---

### 4.3. Missions by Planet
- **Endpoint:** `GET /api/planets/{planet}/missions/`  
  *(where `{planet}` is `moon` or `mars`)*
- **Response `200 OK`:**
```json
[
  {
    "id": "eagle",
    "name": "Eagle (Apollo 11)",
    "planet": "moon",
    "year": 1969,
    "tag": "CREWED LUNAR LANDER",
    "summary": "The descent stage of humanity's first crewed lunar landing."
  },
  {
    "id": "surveyor3",
    "name": "Surveyor 3",
    "planet": "moon",
    "year": 1967,
    "tag": "ROBOTIC LUNAR LANDER",
    "summary": "A robotic visitor later examined on the Moon by Apollo 12."
  },
  {
    "id": "apollo15-lrv",
    "name": "Lunar Roving Vehicle",
    "planet": "moon",
    "year": 1971,
    "tag": "LUNAR ROVER",
    "summary": "The first manned vehicle driven on the lunar surface."
  }
]
```

---

### 4.4. Full Mission Profile & Story Chapters
- **Endpoint:** `GET /api/missions/{id}/`  
  *(where `{id}` is `eagle`, `surveyor3`, `apollo15-lrv`, `sojourner`, `spirit`, or `opportunity`)*
- **Response `200 OK`:**
```json
{
  "id": "opportunity",
  "name": "Opportunity",
  "mission": "MER-B",
  "planet": "mars",
  "year": 2004,
  "tag": "MARS ROVER",
  "summary": "A rover built for 90 sols that endured for nearly 15 years.",
  "specs": {
    "coordinates": "1.948° S, 354.474° E",
    "siteName": "Meridiani Planum (Endurance / Endeavour)",
    "mass": "185 kg (Earth) · 70 kg (Mars Weight)",
    "duration": "14 Years 138 Days (5,111 Sols)",
    "hardwareStatus": "Parked in Perseverance Valley · Mission Concluded"
  },
  "chapters": [
    {
      "id": "mission",
      "title": "The Mission",
      "summary": "Opportunity touched down on Mars on January 25, 2004.",
      "narration_text": "Opportunity touched down on Mars on January 25, 2004, landing inside Eagle Crater in Meridiani Planum.",
      "sources": [
        { "title": "NASA Mars Exploration Rover: Opportunity", "url": "https://mars.nasa.gov/mer/mission/overview/" }
      ]
    },
    {
      "id": "machine",
      "title": "The Machine",
      "summary": "Solar-powered mobile geologist equipped with science instruments.",
      "narration_text": "Equipped with panoramic cameras, spectrometers, and a microscopic imager on its robotic arm, Opportunity was a mobile geologist.",
      "sources": [
        { "title": "NASA JPL MER Spacecraft Specs", "url": "https://science.nasa.gov/mission/mer/" }
      ]
    },
    {
      "id": "journey",
      "title": "The Journey",
      "summary": "Over 45 kilometers traversed across craters and dunes.",
      "narration_text": "Designed for a 90-sol primary mission, Opportunity traversed 45.16 kilometers across the Martian landscape.",
      "sources": [
        { "title": "NASA Opportunity Drive Distance Record", "url": "https://mars.nasa.gov" }
      ]
    },
    {
      "id": "discoveries",
      "title": "The Discoveries",
      "summary": "Definitive evidence of ancient liquid water on Mars.",
      "narration_text": "Opportunity discovered hematite blueberries and sedimentary rocks confirming that past liquid water once soaked the surface.",
      "sources": [
        { "title": "NASA Science Findings: Hematite and Water", "url": "https://science.nasa.gov" }
      ]
    },
    {
      "id": "what-remains",
      "title": "What Remains",
      "summary": "A silent monument on the slopes of Endeavour Crater.",
      "narration_text": "In 2018, a global dust storm cut off its solar energy. Today, Opportunity rests silently in Perseverance Valley, a testament to human curiosity.",
      "sources": [
        { "title": "NASA Opportunity Final Transmission Record", "url": "https://nasa.gov" }
      ]
    }
  ]
}
```

---

### 4.5. Ask the Archive (AI / RAG Query)
- **Endpoint:** `POST /api/ai/ask/`
- **Request Body:**
```json
{
  "artifact_id": "opportunity",
  "chapter_id": "discoveries",
  "question": "What did the rover discover about water on Mars?",
  "history": [
    { "role": "user", "text": "Tell me about Opportunity" },
    { "role": "assistant", "text": "Opportunity was a NASA rover landed on Mars in 2004." }
  ]
}
```
- **Response `200 OK` (when answer found in NASA documentation):**
```json
{
  "answer": "Opportunity uncovered clear mineralogical evidence of past liquid water at Meridiani Planum, notably identifying sulfur-rich sedimentary rocks and spherical hematite concretions informally called 'blueberries'. These minerals formed in acidic groundwater billions of years ago.",
  "sources": [
    {
      "title": "NASA Mars Exploration Rover Science Findings",
      "url": "https://mars.nasa.gov/mer/spotlight/20040302.html"
    }
  ],
  "has_sufficient_context": true
}
```
- **Response `200 OK` (when query cannot be answered by official NASA sources):**
```json
{
  "answer": "The official NASA mission documentation does not contain verified data to answer that specific question. As an archival assistant, I only provide verified facts.",
  "sources": [],
  "has_sufficient_context": false
}
```

---

## 5. RAG Implementation Guidelines for the AI Engineer

1. **Knowledge Store:**
   - Pre-generate chunk embeddings for the 6 missions from official NASA pages (`/data/knowledge.json`).
   - Store vectors in memory or simple JSON/numpy cosine distance lookup (no PostgreSQL or pgvector needed for a 36-hour hackathon).
2. **Retrieval Pipeline:**
   - Filter chunks first by `artifact_id` to strictly limit scope.
   - Embed the incoming `question` using Gemini Embeddings (`text-embedding-004`).
   - Retrieve top 3-5 cosine similarity chunks.
3. **Gemini Generation Prompt:**
   - System instructions:
     > *"You are the NASA Space Archive AI Assistant for the 'Abandoned but Not Forgotten' space museum. Answer the visitor's question using ONLY the provided NASA factual context snippets. Do NOT extrapolate or fabricate facts. If the answer cannot be determined from the context, state clearly that the official record does not contain this information. Keep answers concise, factual, and inspiring."*
4. **Fallback Handling:**
   - If the Gemini API hits rate limits or throws an error, return:
     ```json
     {
       "answer": "The archive AI connection is temporarily overloaded. Please consult the mission story chapters for verified mission telemetry.",
       "sources": [],
       "has_sufficient_context": false
     }
     ```

---

## 6. Deployment Quick-Start (Render)

1. Connect the GitHub repo to **Render Web Services**.
2. Root Directory: `backend` (if placed in a subfolder) or repository root.
3. Build Command:
   ```bash
   pip install -r requirements.txt
   ```
4. Start Command:
   ```bash
   gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 2
   ```
5. Set Environment Variables in Render Dashboard (`GEMINI_API_KEY`, `CORS_ALLOWED_ORIGINS`, etc.).
6. Test using curl:
   ```bash
   curl https://<your-service>.onrender.com/api/health/
   ```

---

*This guide guarantees seamless end-to-end integration between the visual React/Three.js experience and your Django/RAG backend.*
