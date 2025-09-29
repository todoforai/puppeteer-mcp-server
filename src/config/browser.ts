import { LaunchOptions } from 'puppeteer';

// Default navigation timeout in milliseconds
export const DEFAULT_NAVIGATION_TIMEOUT = 10000;

// Default debugging port for Chrome
export const DEFAULT_DEBUG_PORT = 9222;

// Configuration for running in Docker or headless environments
export const dockerConfig: LaunchOptions = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-translate',
    '--disable-sync',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ],
  defaultViewport: null
};

// Configuration for running with display (headed mode)
export const npxConfig: LaunchOptions = {
  headless: false,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--disable-default-apps',
    // Keep translate disabled for automation (remove if you want translation features)
    '--disable-translate',
    '--disable-features=TranslateUI',
    '--disable-sync',
    // Keep these for reliable automation performance
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-ipc-flooding-protection',
    // Use Chrome's default window size - it's usually reasonable for the screen
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ],
  defaultViewport: null,
  devtools: false,
  env: {
    ...process.env,
    DISPLAY: process.env.DISPLAY || ':1'
  }
};
