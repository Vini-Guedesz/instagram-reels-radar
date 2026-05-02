# Instagram Reels Radar (Fastify + React)

Instagram Reels Radar e uma aplicacao fullstack que busca os 20 reels mais recentes de um perfil publico do Instagram e gera metricas para apoio a decisoes de marketing.

## Funcionalidades

- Analise de reels orientada a decisao:
  - views, likes, comentarios, legenda e data de publicacao
  - medias agregadas e destaques de maior/menor engajamento
- Tratamento inteligente dos dados:
  - exclusao de reels fixados da lista de recentes
  - cache em memoria + cache negativo
  - retry com backoff para falhas transientes
  - rate limit por IP
- Dashboard simples para leitura rapida

## Stack

### Backend

- Node.js
- Fastify
- Playwright

### Frontend

- React
- Vite

### Infra

- Docker + Docker Compose

## Instalacao

```bash
# Clonar repositorio
git clone https://github.com/Vini-Guedesz/instagram-reels-radar.git

# Entrar no projeto
cd instagram-reels-radar
```

### Rodar com Docker

```bash
docker compose up --build
```

URLs da aplicacao:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3000`

### Rodar localmente

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

## Estrutura do projeto

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

## Roadmap

- [ ] Adicionar testes automatizados no backend (scraper e servicos)
- [ ] Adicionar opcao de cache distribuido (Redis)
- [ ] Melhorar visualizacao de tendencia no dashboard
- [ ] Adicionar metricas de observabilidade e logs estruturados
