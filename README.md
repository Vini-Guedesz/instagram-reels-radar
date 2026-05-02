# Instagram Reels Radar (Fastify + React)

Instagram Reels Radar is a fullstack application that fetches the 20 most recent reels from a public Instagram profile and generates quick marketing-oriented metrics.

## ✨ Features

- 🎯 Reel analytics focused on decision support:
  - Views, likes, comments, caption and publish date
  - Aggregated averages and highlights (best/worst engagement)
- 🧠 Smart data handling:
  - Pinned reels excluded from "most recent" list
  - In-memory cache + negative cache
  - Retry with backoff for transient failures
  - Rate limit per IP
- 🖥️ Simple dashboard for fast analysis

## 🛠️ Tech Stack

### Backend

- Node.js
- Fastify
- Playwright

### Frontend

- React
- Vite

### Infra

- Docker + Docker Compose

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/Vini-Guedesz/instagram-reels-radar.git

# Enter project folder
cd instagram-reels-radar
```

### Run with Docker

```bash
docker compose up --build
```

App URLs:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3000`

### Run locally

```bash
# Backend
cd backend
npm install
npm start

# Frontend
cd ../frontend
npm install
npm run dev
```

## 🧩 Project Structure

```text
.
├── backend/
│   └── src/
│       ├── config/
│       ├── routes/
│       ├── scrapers/
│       └── services/
├── frontend/
│   └── src/
└── docker-compose.yml
```

## 📌 Roadmap

- [ ] Add automated backend tests for scraper and services
- [ ] Add distributed cache option (Redis)
- [ ] Improve trend visualizations in dashboard
- [ ] Add observability metrics and structured logs
