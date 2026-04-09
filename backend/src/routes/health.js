const { APP_CONFIG } = require("../config/appConfig");
const { getReelsStoreStats } = require("../services/reelsStore");

async function healthRoutes(fastify) {
  fastify.get("/health", async () => {
    const reelsStoreStats = getReelsStoreStats();

    return {
      status: "ok",
      service: "backend",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      scraperMode: APP_CONFIG.scraperMode,
      cache: reelsStoreStats.cache,
      negativeCache: reelsStoreStats.negativeCache,
      inFlightRequests: reelsStoreStats.inFlightRequests
    };
  });
}

module.exports = healthRoutes;
