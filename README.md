# Instagram Reels Radar

Aplicacao full-stack para consultar os 20 Reels mais recentes de um perfil publico do Instagram e apresentar metricas que ajudem uma area de marketing a tomar decisao mais rapido.

O foco da ferramenta e responder a uma pergunta pratica: "esse creator tem alcance, engajamento e consistencia suficientes para justificar uma campanha?".

## Visao geral

O projeto foi dividido em:

- `backend/`: API em Node.js com Fastify e scraper real com Playwright
- `frontend/`: interface em React + Vite para busca, leitura de metricas e analise dos Reels

O backend recebe um `username` publico do Instagram, coleta os Reels mais recentes, remove os Reels fixados e devolve:

- URL
- data de publicacao
- views
- likes
- comentarios
- legenda
- resumo agregado com medias e destaque de maior/menor interacao

Nao foi usado banco de dados no MVP.

## Minha prioridade no desafio

Eu nao tenho muita experiencia com frontend e tambem nao trabalho com JavaScript no meu dia a dia. Como o enunciado do desafio e muito mais relacionado a logica de coleta, API, tratamento de dados e confiabilidade da informacao, eu preferi investir mais tempo no backend.

Essa foi uma decisao consciente. Eu entendi que seria melhor entregar um backend mais solido, com scraper real, cache, tratamento de erro e preocupacao com performance, do que tentar dividir igualmente o tempo e terminar com duas partes medianas.

O frontend foi tratado como uma interface objetiva para consumo do time de marketing: simples, limpa e orientada a leitura rapida. Ja o backend recebeu a maior parte do esforco tecnico.

## Aprendizado e pesquisa

Algumas tecnologias desse desafio nao faziam parte da minha experiencia previa direta, entao eu precisei pesquisar e entender antes de implementar:

- `Scraper`: eu nao sabia exatamente o que era no contexto pratico e precisei estudar como capturar dados publicos de uma aplicacao web sem depender de APIs terceiras.
- `Playwright`: eu nao conhecia a ferramenta e pesquisei como ela funciona para navegacao automatizada, contexto de browser, interceptacao e execucao em Docker.
- `GraphQL`: eu ja sabia conceitualmente o que era, mas precisei pesquisar melhor como a web publica do Instagram organiza parte dos dados e como tratar esse retorno dentro do scraper.

Mesmo nao tendo experiencia previa forte com JavaScript, eu optei por essa stack porque Playwright, scraping web e esse tipo de integracao acabam tendo um ecossistema muito favoravel em Node.js.

## Processo e uso de IA

Usei IA como acelerador de desenvolvimento, mas nao como substituto de entendimento.

### O que a IA ajudou a gerar

- scaffold inicial do backend com Fastify
- estrutura inicial do frontend
- iteracoes visuais do dashboard
- boilerplate de Docker e compose
- primeira organizacao de rotas, servicos e camadas

### O que eu revisei e alterei manualmente

- comportamento do scraper para casos reais do Instagram
- exclusao de Reels fixados da lista dos 20 mais recentes
- estrategia de extracao de dados para evitar timeouts desnecessarios
- cache em memoria e cache negativo
- retry com backoff para falhas transientes
- rate limit por IP
- ajuste de performance do browser compartilhado
- refinamento do frontend para ficar mais legivel para o publico do desafio
- ajuste do Docker para reduzir tamanho da imagem sem perder funcionalidade

### Onde pesquisei por conta propria

- documentacao oficial do Playwright
- comportamento do payload e das chamadas da propria web publica do Instagram
- funcionamento pratico de scraping em paginas publicas
- diferenca entre instalar browser completo e headless shell no Playwright
- trade-offs de imagem Docker para runtime com browser embarcado

O principal ponto aqui e que eu nao aceitei a primeira versao gerada cegamente. Quando a IA atrapalhou performance ou criou uma abordagem que nao justificava o custo, eu intervi e corrigi.

## Principais decisoes tecnicas

### 1. Priorizar backend em vez de sofisticar demais o frontend

Como o valor principal do desafio esta em obter e organizar os dados corretamente, o backend recebeu mais investimento tecnico.

### 2. Scraper real, sem API externa

O projeto nao usa Apify nem servicos terceiros. A coleta e feita com Playwright navegando pela web publica do Instagram e aproveitando os dados expostos nesse contexto.

### 3. Nao contar Reels fixados como "mais recentes"

Uma decisao importante foi remover da resposta os Reels fixados. Sem isso, a lista ficaria incorreta para o objetivo do desafio, porque Reel fixado nao representa necessariamente os ultimos 20 publicados.

### 4. Cross-post para Facebook

Eu nao consegui transformar essa parte em algo confiavel e performatico o suficiente para justificar a aplicacao no MVP.

O problema nao foi apenas tecnico, mas de custo-beneficio:

- a web publica do Instagram nao expunha esse sinal de forma consistente
- a heuristica exigia navegacoes extras por Reel
- o ganho de produto nao justificava o impacto de performance

Por isso, preferi nao forcar um resultado duvidoso. A heuristica chegou a ser explorada, mas foi desativada por padrao para preservar tempo de resposta e evitar uma informacao fraca travestida de certeza.

### 5. Gerar estatisticas diretas para decisao rapida

Em vez de devolver apenas uma lista crua de videos, eu trabalhei os dados para gerar leitura mais objetiva:

- medias de views, likes e comentarios
- media de interacoes
- destaque do Reel com maior interacao
- destaque do Reel com menor interacao
- leitura mais rapida no frontend para comparacao

O objetivo foi transformar dados em apoio de decisao, nao apenas em planilha renderizada.

## Performance e confiabilidade

Alguns cuidados tecnicos foram adicionados no backend para manter a API mais resiliente:

- cache em memoria para respostas validas
- cache negativo para perfis inexistentes ou inacessiveis
- deduplicacao de requests em voo para o mesmo username
- retry com backoff para erros temporarios
- rate limit por IP
- browser singleton no Playwright para evitar custo de abrir um Chromium novo a cada requisicao
- bloqueio de recursos desnecessarios no carregamento da pagina

### Cache

Cache principal:

- TTL padrao: `300000 ms` ou `5 minutos`
- usado para perfis consultados recentemente

Cache negativo:

- TTL padrao: `60000 ms` ou `60 segundos`
- usado para respostas `404` e `403`
- evita repetir scraping caro para perfil inexistente ou indisponivel logo em seguida

### Rate limit

Configuracao padrao:

- `10` requisicoes por IP
- janela de `60 segundos`

### Retry

Configuracao padrao:

- ate `3` tentativas
- backoff inicial de `750 ms`
- atraso maximo de `4000 ms`

## Otimizacao da imagem Docker

Em um momento do desenvolvimento, a IA ajudou a montar a imagem, mas a solucao inicial estava mais pesada do que precisava. Eu intervi diretamente para reduzir o tamanho do backend sem quebrar a aplicacao.

O que foi feito:

- ativei `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` para evitar downloads implicitos e desnecessarios no `npm ci`
- defini `NODE_ENV=production`
- troquei para `npm ci --omit=dev`
- passei o Playwright para instalar so o necessario com `npx playwright install --with-deps --no-shell chromium`
- limpei cache do npm, cache temporario e listas do apt no build
- no launch do browser, forcei `channel: "chromium"` em modo headless, porque sem isso o Playwright tentava abrir o `chromium_headless_shell` que foi removido da imagem

Economia medida com `docker image inspect`:

- antes: `503032306` bytes, `479.7 MiB`
- depois: `374034974` bytes, `356.7 MiB`
- economia: `128997332` bytes, `123.0 MiB`
- reducao: `25.6%`

## Como rodar

### Com Docker

Na raiz do projeto:

```bash
docker compose up --build
```

Servicos:

- frontend: `http://localhost:8080`
- backend: `http://localhost:3000`

Para parar:

```bash
docker compose down
```

### Sem Docker

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

### `GET /health`

Health check do backend.

Exemplo:

```http
GET http://localhost:3000/health
```

### `GET /api/reels/:username`

Busca os 20 Reels mais recentes do perfil publico informado.

Exemplo:

```http
GET http://localhost:3000/api/reels/instagram
```

Resposta inclui, em alto nivel:

- identificacao do perfil
- data da coleta
- lista de Reels
- resumo com medias
- destaque de maior e menor interacao

## Estrutura resumida

```txt
.
├── backend
│   ├── src
│   │   ├── config
│   │   ├── lib
│   │   ├── routes
│   │   ├── scrapers
│   │   └── services
│   └── Dockerfile
├── frontend
│   ├── src
│   └── Dockerfile
└── docker-compose.yml
```

## Limitacoes atuais

- depende de dados expostos pela web publica do Instagram
- pode sofrer com mudancas de estrutura da pagina ou mecanismo anti-bot
- cross-post para Facebook nao entrou no MVP por falta de sinal confiavel e pelo custo de performance
- nao ha persistencia em banco
- nao ha suite formal de testes automatizados no MVP

## O que eu faria em seguida

- adicionar testes automatizados para partes criticas do backend
- adicionar cache distribuido, como Redis, se a aplicacao saisse do modo MVP
- melhorar observabilidade e logs operacionais
- estudar uma estrategia mais robusta para detectar cross-post sem degradar latencia
- evoluir o frontend com mais polimento visual sem perder simplicidade

## Conclusao

Minha decisao principal foi clara: priorizar a parte que mais representava o desafio tecnico, que era a coleta e organizacao confiavel dos dados.

Mesmo com menos experiencia em frontend e em JavaScript, eu consegui usar a stack proposta de forma pragmatica, estudar o que era necessario, revisar o que a IA gerou e intervir nos pontos onde era preciso entendimento real de engenharia, principalmente em scraping, performance, cache e Docker.
