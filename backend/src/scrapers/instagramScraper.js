const { APP_CONFIG } = require("../config/appConfig");
const { createInstagramContext, DEFAULT_USER_AGENT } = require("../lib/browser");
const { AppError } = require("../utils/errors");

const INSTAGRAM_BASE_URL = "https://www.instagram.com";
const PROFILE_QUERY_TIMEOUT_MS = 30000;
const PROFILE_PAGE_TIMEOUT_MS = 60000;
const PROFILE_STATE_TIMEOUT_MS = 6000;
const GRAPHQL_TIMEOUT_MS = 20000;
const MAX_PAGE_FETCHES = 10;
const REELS_GRAPHQL_DOC_ID = "7950326061742207";
const PAGE_SIZE = 12;
const CROSSPOST_JSON_SCRIPT_SELECTOR = 'script[type="application/json"]';

const PROFILE_NOT_FOUND_MARKERS = [
  "Profile isn't available",
  "The link may be broken, or the profile may have been removed.",
  "Sorry, this page isn't available."
];

const PRIVATE_PROFILE_MARKERS = [
  "This account is private"
];

function sleep(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function logRetry(logger, payload, message) {
  if (!logger || typeof logger.warn !== "function") {
    return;
  }

  logger.warn(payload, message);
}

function logWarning(logger, payload, message) {
  if (!logger || typeof logger.warn !== "function") {
    return;
  }

  logger.warn(payload, message);
}

function calculateRetryDelayMs(attemptNumber) {
  const exponentialDelay = APP_CONFIG.scraperRetry.initialDelayMs * (2 ** (attemptNumber - 1));
  const boundedDelay = Math.min(exponentialDelay, APP_CONFIG.scraperRetry.maxDelayMs);
  const jitterMs = Math.floor(Math.random() * 250);

  return boundedDelay + jitterMs;
}

async function retryWithBackoff(task, options = {}) {
  const {
    logger,
    operation,
    maxAttempts = APP_CONFIG.scraperRetry.maxAttempts
  } = options;

  let attemptNumber = 0;

  while (attemptNumber < maxAttempts) {
    attemptNumber += 1;

    try {
      return await task(attemptNumber);
    } catch (error) {
      const shouldRetry = error instanceof AppError && error.isRetryable;

      if (!shouldRetry || attemptNumber >= maxAttempts) {
        throw error;
      }

      const delayMs = calculateRetryDelayMs(attemptNumber);

      logRetry(logger, {
        operation,
        attemptNumber,
        nextAttemptNumber: attemptNumber + 1,
        delayMs,
        errorMessage: error.message,
        statusCode: error.statusCode || 500
      }, "Retrying Instagram scraper operation");

      await sleep(delayMs);
    }
  }
}

function buildProfileReelsUrl(username) {
  return `${INSTAGRAM_BASE_URL}/${username}/reels/`;
}

function buildTimelineGraphQlUrl(userId, after) {
  const variables = {
    id: userId,
    include_clips_attribution_info: false,
    first: PAGE_SIZE
  };

  if (after) {
    variables.after = after;
  }

  return `${INSTAGRAM_BASE_URL}/graphql/query/?doc_id=${REELS_GRAPHQL_DOC_ID}&variables=${encodeURIComponent(JSON.stringify(variables))}`;
}

function extractProfileMetadata(payload) {
  const user = payload?.data?.user;
  const profileUser = user?.reel?.user || user?.owner || null;

  if (!profileUser?.id || !profileUser?.username) {
    return null;
  }

  return {
    userId: String(profileUser.id),
    username: profileUser.username
  };
}

function extractProfileMetadataFromHtml(html, requestedUsername) {
  const matchedUserId = html.match(/"user_id":"(\d+)"/)?.[1]
    || html.match(/profilePage_(\d+)/)?.[1]
    || null;

  if (!matchedUserId) {
    return null;
  }

  return {
    userId: String(matchedUserId),
    username: requestedUsername
  };
}

function createProfileMetadataWatcher(page, requestedUsername) {
  let cleanup = () => {};

  const promise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new AppError("Timeout ao carregar os metadados publicos do perfil no Instagram.", 502));
    }, PROFILE_QUERY_TIMEOUT_MS);

    const handleResponse = async (response) => {
      try {
        const url = response.url();
        const contentType = response.headers()["content-type"] || "";

        if (!url.includes("/graphql/query/")) {
          return;
        }

        if (!url.includes("include_reel=true")) {
          return;
        }

        if (!contentType.includes("application/json")) {
          return;
        }

        const payload = await response.json();
        const metadata = extractProfileMetadata(payload);

        if (!metadata) {
          return;
        }

        if (metadata.username.toLowerCase() !== requestedUsername.toLowerCase()) {
          return;
        }

        cleanup();
        resolve(metadata);
      } catch (error) {
      }
    };

    cleanup = () => {
      clearTimeout(timeoutId);
      page.off("response", handleResponse);
    };

    page.on("response", handleResponse);
  });

  return {
    promise,
    cancel: cleanup
  };
}

async function dismissCookiePrompt(page) {
  const labels = [
    "Only allow essential cookies",
    "Allow all cookies",
    "Permitir apenas cookies essenciais",
    "Permitir todos os cookies"
  ];

  for (const label of labels) {
    const button = page.getByRole("button", {
      name: label,
      exact: true
    });

    if (await button.count()) {
      await button.first().click({
        timeout: 1500
      }).catch(() => {});
      return;
    }
  }
}

async function readBodyText(page) {
  return (await page.textContent("body").catch(() => "")) || "";
}

function detectProfilePageState(bodyText) {
  if (PROFILE_NOT_FOUND_MARKERS.some((marker) => bodyText.includes(marker))) {
    return "not_found";
  }

  if (PRIVATE_PROFILE_MARKERS.some((marker) => bodyText.includes(marker))) {
    return "private";
  }

  return "unknown";
}

async function waitForKnownProfilePageState(page, timeoutMs = PROFILE_STATE_TIMEOUT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const bodyText = await readBodyText(page);
    const pageState = detectProfilePageState(bodyText);

    if (pageState !== "unknown") {
      return pageState;
    }

    await sleep(300);
  }

  return "unknown";
}

async function loadProfileMetadata(page, username, options = {}) {
  const metadataWatcher = createProfileMetadataWatcher(page, username);

  await retryWithBackoff(async () => {
    let response;

    try {
      response = await page.goto(buildProfileReelsUrl(username), {
        waitUntil: "domcontentloaded",
        timeout: PROFILE_PAGE_TIMEOUT_MS
      });
    } catch (error) {
      throw new AppError("Falha temporaria ao carregar a pagina publica do perfil no Instagram.", 502, {
        isRetryable: true
      });
    }

    const statusCode = response?.status() || 200;

    if (statusCode === 429) {
      throw new AppError("Instagram bloqueou temporariamente a pagina publica do perfil.", 503, {
        isRetryable: true
      });
    }

    if (statusCode >= 500) {
      throw new AppError(`Instagram respondeu com status ${statusCode} ao carregar a pagina do perfil.`, 502, {
        isRetryable: true
      });
    }
  }, {
    logger: options?.logger,
    operation: "profile-navigation"
  });

  await dismissCookiePrompt(page);
  const pageHtml = await page.content().catch(() => "");
  const metadataFromHtml = extractProfileMetadataFromHtml(pageHtml, username);

  if (metadataFromHtml) {
    metadataWatcher.cancel();
    return metadataFromHtml;
  }

  const earlyResult = await Promise.race([
    metadataWatcher.promise.then((metadata) => ({
      type: "metadata",
      metadata
    })),
    waitForKnownProfilePageState(page).then((pageState) => ({
      type: "state",
      pageState
    }))
  ]);

  if (earlyResult.type === "metadata") {
    return earlyResult.metadata;
  }

  if (earlyResult.pageState === "not_found") {
    metadataWatcher.cancel();
    throw new AppError("Perfil do Instagram nao encontrado ou indisponivel.", 404);
  }

  if (earlyResult.pageState === "private") {
    metadataWatcher.cancel();
    throw new AppError("O perfil informado e privado e nao pode ser raspado sem autenticacao.", 403);
  }

  try {
    return await metadataWatcher.promise;
  } catch (error) {
    const updatedBodyText = await readBodyText(page);
    const updatedPageState = detectProfilePageState(updatedBodyText);

    if (updatedPageState === "not_found") {
      throw new AppError("Perfil do Instagram nao encontrado ou indisponivel.", 404);
    }

    if (updatedPageState === "private") {
      throw new AppError("O perfil informado e privado e nao pode ser raspado sem autenticacao.", 403);
    }

    throw error;
  }
}

async function fetchTimelinePage(requestContext, userId, referer, after, logger) {
  return retryWithBackoff(async () => {
    let response;

    try {
      response = await requestContext.get(buildTimelineGraphQlUrl(userId, after), {
        timeout: GRAPHQL_TIMEOUT_MS,
        headers: {
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": DEFAULT_USER_AGENT,
          "Referer": referer
        }
      });
    } catch (error) {
      throw new AppError("Falha temporaria de rede ao consultar os Reels no Instagram.", 502, {
        isRetryable: true
      });
    }

    if (response.status() === 429) {
      throw new AppError("Instagram bloqueou temporariamente a consulta. Tente novamente em alguns minutos.", 503, {
        isRetryable: true
      });
    }

    if (response.status() >= 500) {
      throw new AppError(`Instagram respondeu com status ${response.status()} ao consultar os Reels.`, 502, {
        isRetryable: true
      });
    }

    if (!response.ok()) {
      throw new AppError(`Instagram respondeu com status ${response.status()} ao consultar os Reels.`, 502);
    }

    const payload = await response.json();

    if (payload?.status === "fail" || payload?.errors?.length) {
      throw new AppError("Instagram retornou uma resposta invalida ao consultar os Reels.", 502);
    }

    const timeline = payload?.data?.user?.edge_owner_to_timeline_media;

    if (!timeline || !Array.isArray(timeline.edges)) {
      throw new AppError("Nao foi possivel interpretar os dados publicos de Reels do Instagram.", 502);
    }

    return timeline;
  }, {
    logger,
    operation: "timeline-graphql"
  });
}

function mapNodeToReel(node) {
  const shortcode = node?.shortcode;

  if (!shortcode || node?.product_type !== "clips") {
    return null;
  }

  return {
    id: node.id || shortcode,
    url: `${INSTAGRAM_BASE_URL}/reel/${shortcode}/`,
    publishedAt: node.taken_at_timestamp
      ? new Date(node.taken_at_timestamp * 1000).toISOString()
      : null,
    views: node.video_view_count ?? node.view_count ?? null,
    likes: node.edge_media_preview_like?.count ?? node.like_count ?? null,
    comments: node.edge_media_to_comment?.count
      ?? node.edge_media_to_parent_comment?.count
      ?? node.comment_count
      ?? null,
    caption: node.edge_media_to_caption?.edges?.[0]?.node?.text
      ?? node.caption?.text
      ?? null,
    isCrossPostedToFacebook: null
  };
}

function isPinnedNode(node) {
  if (node?.is_pinned) {
    return true;
  }

  if (Array.isArray(node?.pinned_for_users) && node.pinned_for_users.length > 0) {
    return true;
  }

  if (Array.isArray(node?.timeline_pinned_user_ids) && node.timeline_pinned_user_ids.length > 0) {
    return true;
  }

  return false;
}

function shouldBlockLightweightNavigationResource(route) {
  return ["font", "image", "media", "stylesheet"].includes(route.request().resourceType());
}

async function enableLightweightNavigation(page) {
  await page.route("**/*", (route) => {
    if (shouldBlockLightweightNavigationResource(route)) {
      return route.abort();
    }

    return route.continue();
  });
}

function extractCrosspostSignalFromJsonScript(scriptContent) {
  if (!scriptContent) {
    return null;
  }

  const fbLikeCountToken = scriptContent.match(/"fb_like_count":(null|\d+)/)?.[1];
  const crosspostMetadataToken = scriptContent.match(/"crosspost_metadata":(null|\{)/)?.[1];

  if (crosspostMetadataToken === "{") {
    return true;
  }

  if (fbLikeCountToken && fbLikeCountToken !== "null") {
    return true;
  }

  if (fbLikeCountToken || crosspostMetadataToken) {
    return null;
  }

  return null;
}

async function waitForCrosspostJsonScript(page) {
  await page.waitForFunction(() => (
    Array.from(document.querySelectorAll('script[type="application/json"]'))
      .some((script) => script.textContent && script.textContent.includes("crosspost_metadata"))
  ), {
    timeout: APP_CONFIG.facebookCrosspostHeuristic.timeoutMs
  }).catch(() => {});
}

async function readCrosspostJsonScript(page) {
  return page.evaluate((selector) => {
    return Array.from(document.querySelectorAll(selector))
      .find((script) => script.textContent && script.textContent.includes("crosspost_metadata"))
      ?.textContent
      || null;
  }, CROSSPOST_JSON_SCRIPT_SELECTOR);
}

async function detectFacebookCrossPostForReel(context, reelUrl, logger) {
  const page = await context.newPage();

  await enableLightweightNavigation(page);

  try {
    await page.goto(reelUrl, {
      waitUntil: "domcontentloaded",
      timeout: PROFILE_PAGE_TIMEOUT_MS
    });

    await waitForCrosspostJsonScript(page);

    const crosspostJsonScript = await readCrosspostJsonScript(page);

    return extractCrosspostSignalFromJsonScript(crosspostJsonScript);
  } catch (error) {
    logWarning(logger, {
      reelUrl,
      errorMessage: error.message
    }, "Failed to evaluate Facebook cross-post heuristic");

    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

async function enrichReelsWithFacebookCrossPostSignals(context, reels, logger) {
  if (!APP_CONFIG.facebookCrosspostHeuristic.enabled || !reels.length) {
    return reels;
  }

  const startedAt = Date.now();
  let nextIndex = 0;
  const workerCount = Math.min(APP_CONFIG.facebookCrosspostHeuristic.concurrency, reels.length);

  await Promise.all(Array.from({
    length: workerCount
  }, async () => {
    while (nextIndex < reels.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      reels[currentIndex].isCrossPostedToFacebook = await detectFacebookCrossPostForReel(
        context,
        reels[currentIndex].url,
        logger
      );
    }
  }));

  if (logger && typeof logger.info === "function") {
    logger.info({
      inspectedReels: reels.length,
      detectedCrossPostedToFacebookCount: reels.filter((reel) => reel.isCrossPostedToFacebook === true).length,
      durationMs: Date.now() - startedAt
    }, "Facebook cross-post heuristic completed");
  }

  return reels;
}

async function scrapeRecentReels(username, options = {}) {
  const limit = options.limit || 20;
  const logger = options.logger;
  const { context } = await createInstagramContext();
  const page = await context.newPage();
  const referer = buildProfileReelsUrl(username);

  try {
    await enableLightweightNavigation(page);

    const profileMetadata = await loadProfileMetadata(page, username, {
      logger
    });
    const reels = [];
    const seenShortcodes = new Set();
    let after;
    let pageCount = 0;

    while (reels.length < limit && pageCount < MAX_PAGE_FETCHES) {
      const timeline = await fetchTimelinePage(context.request, profileMetadata.userId, referer, after, logger);

      if (!timeline.edges.length) {
        break;
      }

      for (const edge of timeline.edges) {
        if (isPinnedNode(edge.node)) {
          continue;
        }

        const reel = mapNodeToReel(edge.node);

        if (!reel) {
          continue;
        }

        if (seenShortcodes.has(edge.node.shortcode)) {
          continue;
        }

        seenShortcodes.add(edge.node.shortcode);
        reels.push(reel);

        if (reels.length >= limit) {
          break;
        }
      }

      pageCount += 1;

      if (!timeline.page_info?.has_next_page || !timeline.page_info?.end_cursor) {
        break;
      }

      after = timeline.page_info.end_cursor;
    }

    await enrichReelsWithFacebookCrossPostSignals(context, reels, logger);

    return {
      username: profileMetadata.username,
      total: reels.length,
      source: "instagram-public-web",
      fetchedAt: new Date().toISOString(),
      reels
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Falha ao executar o scraper publico do Instagram.", 502);
  } finally {
    await context.close().catch(() => {});
  }
}

module.exports = {
  scrapeRecentReels
};
