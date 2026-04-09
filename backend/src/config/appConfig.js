function readNumberEnv(name, fallbackValue) {
  const rawValue = process.env[name];
  const parsedValue = Number(rawValue);

  if (!rawValue || !Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }

  return parsedValue;
}

function readBooleanEnv(name, fallbackValue) {
  const rawValue = process.env[name];

  if (typeof rawValue !== "string" || !rawValue.length) {
    return fallbackValue;
  }

  if (["true", "1", "yes", "on"].includes(rawValue.toLowerCase())) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(rawValue.toLowerCase())) {
    return false;
  }

  return fallbackValue;
}

const APP_CONFIG = {
  port: readNumberEnv("PORT", 3000),
  scraperMode: (process.env.SCRAPER_MODE || "real").toLowerCase(),
  reelsLimit: readNumberEnv("REELS_LIMIT", 20),
  cache: {
    ttlMs: readNumberEnv("REELS_CACHE_TTL_MS", 300000),
    maxEntries: readNumberEnv("REELS_CACHE_MAX_ENTRIES", 200)
  },
  negativeCache: {
    ttlMs: readNumberEnv("REELS_NEGATIVE_CACHE_TTL_MS", 60000),
    maxEntries: readNumberEnv("REELS_NEGATIVE_CACHE_MAX_ENTRIES", 200)
  },
  rateLimit: {
    maxRequests: readNumberEnv("RATE_LIMIT_MAX_REQUESTS", 10),
    windowMs: readNumberEnv("RATE_LIMIT_WINDOW_MS", 60000)
  },
  scraperRetry: {
    maxAttempts: readNumberEnv("SCRAPER_RETRY_MAX_ATTEMPTS", 3),
    initialDelayMs: readNumberEnv("SCRAPER_RETRY_INITIAL_DELAY_MS", 750),
    maxDelayMs: readNumberEnv("SCRAPER_RETRY_MAX_DELAY_MS", 4000)
  },
  facebookCrosspostHeuristic: {
    enabled: readBooleanEnv("FACEBOOK_CROSSPOST_HEURISTIC_ENABLED", false),
    concurrency: readNumberEnv("FACEBOOK_CROSSPOST_HEURISTIC_CONCURRENCY", 4),
    timeoutMs: readNumberEnv("FACEBOOK_CROSSPOST_HEURISTIC_TIMEOUT_MS", 12000)
  }
};

module.exports = {
  APP_CONFIG
};
