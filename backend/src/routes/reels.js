const { getRecentReelsByUsername } = require("../services/reelsService");

async function reelsRoutes(fastify) {
  fastify.get("/api/reels/:username", {
    schema: {
      params: {
        type: "object",
        required: ["username"],
        properties: {
          username: {
            type: "string",
            minLength: 1,
            maxLength: 30
          }
        }
      }
    }
  }, async (request, reply) => {
    const { username } = request.params;
    const result = await getRecentReelsByUsername(username, {
      logger: request.log
    });

    reply.header("Cache-Control", "no-store");
    reply.header("X-Cache", result.meta.cache.toUpperCase());
    reply.header("X-Scraper-Source", result.payload.source);

    return result.payload;
  });
}

module.exports = reelsRoutes;
