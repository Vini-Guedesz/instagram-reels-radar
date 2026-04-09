const { APP_CONFIG } = require("../config/appConfig");
const { AppError } = require("../utils/errors");
const { scrapeRecentReels } = require("../scrapers/instagramScraper");
const {
  getCachedReels,
  setCachedReels,
  clearCachedReels,
  getNegativeCachedReelsError,
  setNegativeCachedReelsError,
  clearNegativeCachedReelsError,
  getInFlightRequest,
  setInFlightRequest,
  clearInFlightRequest
} = require("./reelsStore");

const INSTAGRAM_USERNAME_REGEX = /^(?!.*\.\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;

function isValidMetricValue(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

function calculateAverageMetric(reels, metricName) {
  const values = reels
    .map((reel) => reel?.[metricName])
    .filter(isValidMetricValue);

  if (!values.length) {
    return null;
  }

  const total = values.reduce((accumulator, value) => accumulator + value, 0);

  return roundToTwoDecimals(total / values.length);
}

function calculateInteractionCount(reel) {
  const likes = isValidMetricValue(reel?.likes) ? reel.likes : 0;
  const comments = isValidMetricValue(reel?.comments) ? reel.comments : 0;

  return likes + comments;
}

function buildInteractionSummaryItem(reel) {
  if (!reel) {
    return null;
  }

  return {
    id: reel.id,
    url: reel.url,
    publishedAt: reel.publishedAt,
    views: reel.views,
    likes: reel.likes,
    comments: reel.comments,
    interactionCount: calculateInteractionCount(reel)
  };
}

function pickReelByInteractionExtremum(reels, comparator) {
  return reels.reduce((selectedReel, candidateReel) => {
    if (!selectedReel) {
      return candidateReel;
    }

    const selectedInteractionCount = calculateInteractionCount(selectedReel);
    const candidateInteractionCount = calculateInteractionCount(candidateReel);

    if (comparator(candidateInteractionCount, selectedInteractionCount)) {
      return candidateReel;
    }

    return selectedReel;
  }, null);
}

function buildReelsSummary(reels) {
  if (!Array.isArray(reels) || !reels.length) {
    return {
      averages: {
        views: null,
        likes: null,
        comments: null
      },
      interactions: {
        metric: "likes + comments",
        most: null,
        least: null
      }
    };
  }

  const mostInteractedReel = pickReelByInteractionExtremum(reels, (candidate, selected) => candidate > selected);
  const leastInteractedReel = pickReelByInteractionExtremum(reels, (candidate, selected) => candidate < selected);

  return {
    averages: {
      views: calculateAverageMetric(reels, "views"),
      likes: calculateAverageMetric(reels, "likes"),
      comments: calculateAverageMetric(reels, "comments")
    },
    interactions: {
      metric: "likes + comments",
      most: buildInteractionSummaryItem(mostInteractedReel),
      least: buildInteractionSummaryItem(leastInteractedReel)
    }
  };
}

function withReelsSummary(payload) {
  return {
    ...payload,
    summary: buildReelsSummary(payload?.reels || [])
  };
}

function normalizeUsername(username) {
  const normalizedUsername = username.trim();

  if (!INSTAGRAM_USERNAME_REGEX.test(normalizedUsername)) {
    throw new AppError("Username do Instagram invalido.", 400);
  }

  return normalizedUsername;
}

function buildMockReels(username, limit = APP_CONFIG.reelsLimit) {
  return Array.from({ length: limit }, (_, index) => {
    const reelNumber = index + 1;
    const publishedAt = new Date(Date.now() - index * 6 * 60 * 60 * 1000).toISOString();

    return {
      id: `mock-reel-${reelNumber}`,
      url: `https://www.instagram.com/reel/mock-${username}-${reelNumber}/`,
      publishedAt,
      views: 50000 - index * 1200,
      likes: 4200 - index * 90,
      comments: 180 - index * 4,
      caption: `Mock reel ${reelNumber} do perfil @${username}.`,
      isCrossPostedToFacebook: index % 3 === 0
    };
  });
}

function logRequest(logger, level, payload, message) {
  if (!logger || typeof logger[level] !== "function") {
    return;
  }

  logger[level](payload, message);
}

function withErrorHeaders(error, extraHeaders) {
  if (!(error instanceof AppError)) {
    return error;
  }

  error.headers = {
    ...error.headers,
    ...extraHeaders
  };

  return error;
}

function shouldCacheNegativeError(error) {
  return error instanceof AppError && [403, 404].includes(error.statusCode);
}

function buildNegativeCacheEntry(error) {
  return {
    name: error.name,
    statusCode: error.statusCode,
    message: error.message,
    source: "instagram-public-web"
  };
}

function buildNegativeCachedError(cachedEntry) {
  return new AppError(cachedEntry.value.message, cachedEntry.value.statusCode, {
    name: cachedEntry.value.name,
    headers: {
      "X-Cache": "NEGATIVE_HIT",
      "X-Scraper-Source": cachedEntry.value.source
    }
  });
}

async function getRecentReelsByUsername(username, options = {}) {
  const logger = options.logger;
  const normalizedUsername = normalizeUsername(username);
  const scraperMode = APP_CONFIG.scraperMode;
  const startedAt = Date.now();

  if (scraperMode === "mock") {
    const payload = withReelsSummary({
      username: normalizedUsername,
      total: APP_CONFIG.reelsLimit,
      source: "mock",
      fetchedAt: new Date().toISOString(),
      reels: buildMockReels(normalizedUsername, APP_CONFIG.reelsLimit)
    });

    logRequest(logger, "info", {
      username: normalizedUsername,
      scraperMode,
      cache: "bypass",
      durationMs: Date.now() - startedAt,
      reelsTotal: payload.total,
      source: payload.source
    }, "Reels served in mock mode");

    return {
      payload,
      meta: {
        cache: "bypass",
        durationMs: Date.now() - startedAt
      }
    };
  }

  const cachedEntry = getCachedReels(normalizedUsername);

  if (cachedEntry) {
    const durationMs = Date.now() - startedAt;
    const payload = withReelsSummary(cachedEntry.value);

    logRequest(logger, "info", {
      username: normalizedUsername,
      scraperMode,
      cache: "hit",
      durationMs,
      cacheAgeMs: Date.now() - cachedEntry.createdAt,
      reelsTotal: payload.total,
      source: payload.source
    }, "Reels served from cache");

    return {
      payload,
      meta: {
        cache: "hit",
        durationMs,
        cacheAgeMs: Date.now() - cachedEntry.createdAt
      }
    };
  }

  const negativeCachedEntry = getNegativeCachedReelsError(normalizedUsername);

  if (negativeCachedEntry) {
    const durationMs = Date.now() - startedAt;
    const cachedError = buildNegativeCachedError(negativeCachedEntry);

    logRequest(logger, "info", {
      username: normalizedUsername,
      scraperMode,
      cache: "negative-hit",
      durationMs,
      cacheAgeMs: Date.now() - negativeCachedEntry.createdAt,
      statusCode: cachedError.statusCode
    }, "Reels negative cache hit");

    throw cachedError;
  }

  const inFlightRequest = getInFlightRequest(normalizedUsername);

  if (inFlightRequest) {
    try {
      const payload = withReelsSummary(await inFlightRequest);
      const durationMs = Date.now() - startedAt;

      logRequest(logger, "info", {
        username: normalizedUsername,
        scraperMode,
        cache: "coalesced",
        durationMs,
        reelsTotal: payload.total,
        source: payload.source
      }, "Reels request joined an in-flight scrape");

      return {
        payload,
        meta: {
          cache: "coalesced",
          durationMs
        }
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const level = error instanceof AppError && error.statusCode < 500
        ? "warn"
        : "error";

      logRequest(logger, level, {
        username: normalizedUsername,
        scraperMode,
        cache: "coalesced",
        durationMs,
        statusCode: error.statusCode || 500,
        errorMessage: error.message
      }, "Joined in-flight scrape failed");

      throw error;
    }
  }

  const loadPromise = (async () => {
    const payload = withReelsSummary(await scrapeRecentReels(normalizedUsername, {
      limit: APP_CONFIG.reelsLimit,
      logger
    }));

    clearNegativeCachedReelsError(normalizedUsername);
    setCachedReels(normalizedUsername, payload);

    return payload;
  })();

  setInFlightRequest(normalizedUsername, loadPromise);

  try {
    const payload = await loadPromise;
    const durationMs = Date.now() - startedAt;

    logRequest(logger, "info", {
      username: normalizedUsername,
      scraperMode,
      cache: "miss",
      durationMs,
      reelsTotal: payload.total,
      source: payload.source
    }, "Reels fetched from Instagram");

    return {
      payload,
      meta: {
        cache: "miss",
        durationMs
      }
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const level = error instanceof AppError && error.statusCode < 500
      ? "warn"
      : "error";

    if (shouldCacheNegativeError(error)) {
      clearCachedReels(normalizedUsername);
      setNegativeCachedReelsError(normalizedUsername, buildNegativeCacheEntry(error));
      withErrorHeaders(error, {
        "X-Cache": "NEGATIVE_MISS",
        "X-Scraper-Source": "instagram-public-web"
      });
    }

    logRequest(logger, level, {
      username: normalizedUsername,
      scraperMode,
      cache: shouldCacheNegativeError(error) ? "negative-miss" : "miss",
      durationMs,
      statusCode: error.statusCode || 500,
      errorMessage: error.message
    }, "Failed to fetch Reels");

    throw error;
  } finally {
    clearInFlightRequest(normalizedUsername);
  }
}

module.exports = {
  getRecentReelsByUsername
};
