const Fastify = require("fastify");
const { APP_CONFIG } = require("./config/appConfig");
const { closeSharedBrowser } = require("./lib/browser");
const healthRoutes = require("./routes/health");
const reelsRoutes = require("./routes/reels");
const { AppError } = require("./utils/errors");

function createRateLimitStore() {
  return new Map();
}

function pruneExpiredRateLimitEntries(rateLimitStore, now) {
  for (const [key, value] of rateLimitStore) {
    if (value.resetAt > now) {
      continue;
    }

    rateLimitStore.delete(key);
  }
}

function isReelsApiRequest(request) {
  const url = request.raw.url || request.url || "";

  return url.startsWith("/api/reels/");
}

function buildServer() {
  const fastify = Fastify({
    logger: true
  });
  const rateLimitStore = createRateLimitStore();

  fastify.addHook("onRequest", async (request, reply) => {
    if (!isReelsApiRequest(request)) {
      return;
    }

    const now = Date.now();
    const ipAddress = request.ip || request.socket?.remoteAddress || "unknown";

    pruneExpiredRateLimitEntries(rateLimitStore, now);

    const currentEntry = rateLimitStore.get(ipAddress);
    const isActiveWindow = currentEntry && currentEntry.resetAt > now;
    const resetAt = isActiveWindow
      ? currentEntry.resetAt
      : now + APP_CONFIG.rateLimit.windowMs;
    const count = isActiveWindow
      ? currentEntry.count + 1
      : 1;

    rateLimitStore.set(ipAddress, {
      count,
      resetAt
    });

    const remaining = Math.max(APP_CONFIG.rateLimit.maxRequests - count, 0);
    const resetEpochSeconds = Math.ceil(resetAt / 1000);
    const retryAfterSeconds = Math.max(Math.ceil((resetAt - now) / 1000), 1);

    reply.header("X-RateLimit-Limit", String(APP_CONFIG.rateLimit.maxRequests));
    reply.header("X-RateLimit-Remaining", String(remaining));
    reply.header("X-RateLimit-Reset", String(resetEpochSeconds));

    if (count <= APP_CONFIG.rateLimit.maxRequests) {
      return;
    }

    request.log.warn({
      ipAddress,
      limit: APP_CONFIG.rateLimit.maxRequests,
      windowMs: APP_CONFIG.rateLimit.windowMs
    }, "Rate limit exceeded for /api/reels request");

    throw new AppError("Limite de requisicoes excedido para a API de Reels. Tente novamente em instantes.", 429, {
      name: "RateLimitExceeded",
      headers: {
        "Retry-After": String(retryAfterSeconds)
      }
    });
  });

  fastify.addHook("onClose", async () => {
    await closeSharedBrowser();
  });

  fastify.register(healthRoutes);
  fastify.register(reelsRoutes);

  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError && Object.keys(error.headers).length > 0) {
      for (const [headerName, headerValue] of Object.entries(error.headers)) {
        reply.header(headerName, headerValue);
      }
    }

    if (error.validation) {
      request.log.warn({
        err: error
      }, "Request completed with validation error");
    } else if (error instanceof AppError && error.statusCode < 500) {
      request.log.warn({
        err: error,
        statusCode: error.statusCode
      }, "Request completed with handled client error");
    } else {
      request.log.error(error);
    }

    if (error.validation) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Parametro username invalido."
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.name,
        message: error.message
      });
    }

    return reply.status(500).send({
      error: "Internal Server Error",
      message: "Falha inesperada ao processar a requisicao."
    });
  });

  fastify.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: "Not Found",
      message: `Rota ${request.method} ${request.url} nao encontrada.`
    });
  });

  return fastify;
}

async function start() {
  const fastify = buildServer();

  try {
    await fastify.listen({
      host: "0.0.0.0",
      port: APP_CONFIG.port
    });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = {
  buildServer
};
