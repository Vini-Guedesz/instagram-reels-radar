const { APP_CONFIG } = require("../config/appConfig");
const { TtlCache } = require("../lib/ttlCache");

const reelsCache = new TtlCache({
  ttlMs: APP_CONFIG.cache.ttlMs,
  maxEntries: APP_CONFIG.cache.maxEntries
});
const negativeReelsCache = new TtlCache({
  ttlMs: APP_CONFIG.negativeCache.ttlMs,
  maxEntries: APP_CONFIG.negativeCache.maxEntries
});

const inFlightRequests = new Map();

function getCachedReels(username) {
  return reelsCache.get(username);
}

function setCachedReels(username, payload) {
  reelsCache.set(username, payload);
  return payload;
}

function clearCachedReels(username) {
  reelsCache.delete(username);
}

function getNegativeCachedReelsError(username) {
  return negativeReelsCache.get(username);
}

function setNegativeCachedReelsError(username, payload) {
  negativeReelsCache.set(username, payload);
  return payload;
}

function clearNegativeCachedReelsError(username) {
  negativeReelsCache.delete(username);
}

function getInFlightRequest(username) {
  return inFlightRequests.get(username) || null;
}

function setInFlightRequest(username, promise) {
  inFlightRequests.set(username, promise);
  return promise;
}

function clearInFlightRequest(username) {
  inFlightRequests.delete(username);
}

function getReelsStoreStats() {
  return {
    cache: reelsCache.getStats(),
    negativeCache: negativeReelsCache.getStats(),
    inFlightRequests: inFlightRequests.size
  };
}

module.exports = {
  getCachedReels,
  setCachedReels,
  clearCachedReels,
  getNegativeCachedReelsError,
  setNegativeCachedReelsError,
  clearNegativeCachedReelsError,
  getInFlightRequest,
  setInFlightRequest,
  clearInFlightRequest,
  getReelsStoreStats
};
