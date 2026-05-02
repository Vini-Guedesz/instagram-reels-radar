# Instagram Reels Radar

Aplicacao fullstack para analisar os 20 Reels mais recentes de um perfil publico do Instagram e gerar metricas para apoio a decisoes de marketing.

## Status

- Ativo
- MVP funcional com scraper real e dashboard web

## Stack

### Backend

- Node.js
- Fastify
- Playwright

### Frontend

- React
- Vite

### Infra

- Docker e Docker Compose

## Funcionalidades

- Coleta dos 20 Reels mais recentes de um perfil publico
- Exclusao de Reels fixados na analise
- Metricas por Reel: views, likes, comentarios, legenda e data
- Resumo agregado com medias e destaques de maior e menor interacao
- Cache em memoria e cache negativo
- Retry com backoff
- Rate limit por IP

## Como executar

### Com Docker

```bash
docker compose up --build
```

Acessos:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3000`

Parar ambiente:

```bash
docker compose down
```

### Local

Backend:

```bash
cd backend
npm install
npm start
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Endpoints principais

- `GET /health`
- `GET /api/reels/:username`

Exemplo:

```http
GET http://localhost:3000/api/reels/instagram
```

## Estrutura

- `backend/src/config`: configuracoes
- `backend/src/routes`: rotas da API
- `backend/src/scrapers`: extracao de dados
- `backend/src/services`: regras e agregacoes
- `frontend/src`: dashboard e componentes visuais

## Limitacoes do MVP

- Dependencia da estrutura publica do Instagram
- Sem persistencia em banco de dados
- Cross-post para Facebook fora do escopo atual

## Roadmap

- Adicionar testes automatizados do backend
- Evoluir observabilidade e logs
- Avaliar cache distribuido para escala
- Melhorar visualizacao de tendencia no frontend

## Autor

Desenvolvido por [Vinicius Guedes](https://github.com/Vini-Guedesz).
