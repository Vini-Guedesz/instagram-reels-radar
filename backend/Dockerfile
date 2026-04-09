FROM node:20-bookworm-slim

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev \
  && npm cache clean --force \
  && npx playwright install --with-deps --no-shell chromium \
  && rm -rf /var/lib/apt/lists/* /root/.cache /tmp/*

COPY src ./src

EXPOSE 3000

CMD ["npm", "start"]
