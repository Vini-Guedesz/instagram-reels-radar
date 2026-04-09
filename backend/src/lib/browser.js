const { chromium } = require("playwright");

const DEFAULT_USER_AGENT = [
  "Mozilla/5.0",
  "(Windows NT 10.0; Win64; x64)",
  "AppleWebKit/537.36",
  "(KHTML, like Gecko)",
  "Chrome/147.0.0.0",
  "Safari/537.36"
].join(" ");

function isHeadlessEnabled() {
  return process.env.PLAYWRIGHT_HEADLESS !== "false";
}

function buildLaunchArgs() {
  const args = [
    "--disable-blink-features=AutomationControlled"
  ];

  if (process.platform === "linux") {
    args.push(
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    );
  }

  return args;
}

function buildContextOptions() {
  return {
    userAgent: DEFAULT_USER_AGENT,
    locale: "en-US",
    viewport: {
      width: 1440,
      height: 1080
    },
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9"
    }
  };
}

let sharedBrowserPromise = null;
let sharedBrowser = null;

async function launchSharedBrowser() {
  const headless = isHeadlessEnabled();
  const browser = await chromium.launch({
    headless,
    ...(headless ? { channel: "chromium" } : {}),
    args: buildLaunchArgs()
  });

  browser.on("disconnected", () => {
    if (sharedBrowser === browser) {
      sharedBrowser = null;
      sharedBrowserPromise = null;
    }
  });

  sharedBrowser = browser;

  return browser;
}

async function getSharedBrowser() {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = launchSharedBrowser().catch((error) => {
      sharedBrowser = null;
      sharedBrowserPromise = null;
      throw error;
    });
  }

  return sharedBrowserPromise;
}

async function createInstagramContext() {
  const browser = await getSharedBrowser();
  const context = await browser.newContext(buildContextOptions());

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined
    });
  });

  return {
    browser,
    context
  };
}

async function closeSharedBrowser() {
  const browser = sharedBrowser;

  sharedBrowser = null;
  sharedBrowserPromise = null;

  if (!browser) {
    return;
  }

  await browser.close().catch(() => {});
}

module.exports = {
  createInstagramContext,
  closeSharedBrowser,
  DEFAULT_USER_AGENT
};
