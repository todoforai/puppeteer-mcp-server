import puppeteer, { Browser, Page } from "puppeteer";
import { logger } from "../config/logger.js";
import { dockerConfig, npxConfig, DEFAULT_NAVIGATION_TIMEOUT } from "../config/browser.js";

// Global browser instance
let browser: Browser | undefined;
let currentPage: Page | undefined;
let disconnectHandlerAttached = false;

export async function ensureBrowser(): Promise<Page> {
  // Check if browser exists AND is actually connected
  if (!browser || !browser.connected || !currentPage || currentPage.isClosed()) {
    logger.info('Launching new browser instance');
    browser = await puppeteer.launch(process.env.DOCKER_CONTAINER ? dockerConfig : npxConfig);
    
    // Attach disconnect handler only once
    if (!disconnectHandlerAttached) {
      browser.on('disconnected', () => {
        logger.warn('Browser disconnected');
        browser = undefined;
        currentPage = undefined;
        disconnectHandlerAttached = false;
      });
      disconnectHandlerAttached = true;
    }
    
    const pages = await browser.pages();
    currentPage = pages.length > 0 ? pages[0] : await browser.newPage();

    // Set default navigation timeout
    await currentPage.setDefaultNavigationTimeout(DEFAULT_NAVIGATION_TIMEOUT);
    await currentPage.setJavaScriptEnabled(true);
    await currentPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    logger.info('Browser launched successfully');
  }
  
  return currentPage!;
}

export async function getAllTabs(): Promise<{ page: Page; url: string; title: string; index: number }[]> {
  if (!browser) {
    throw new Error('Browser not initialized');
  }

  const pages = await browser.pages();
  const tabs = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    try {
      const url = await page.url();
      const title = await page.title();
      tabs.push({ page, url, title, index: i });
    } catch (error) {
      // Skip pages that might be closed or inaccessible
      logger.warn(`Failed to get info for tab ${i}:`, error);
    }
  }

  return tabs;
}

export async function selectTab(tabIndex: number): Promise<Page> {
  if (!browser) {
    throw new Error('Browser not initialized');
  }

  const pages = await browser.pages();
  
  if (tabIndex < 0 || tabIndex >= pages.length) {
    throw new Error(`Tab index ${tabIndex} is out of range. Available tabs: 0-${pages.length - 1}`);
  }

  currentPage = pages[tabIndex];
  logger.info(`Switched to tab ${tabIndex}`);
  return currentPage;
}

export async function createNewTab(url?: string): Promise<Page> {
  if (!browser) {
    throw new Error('Browser not initialized');
  }

  const newPage = await browser.newPage();
  
  // Configure the new page
  await newPage.setDefaultNavigationTimeout(DEFAULT_NAVIGATION_TIMEOUT);
  await newPage.setJavaScriptEnabled(true);
  await newPage.setViewport({ width: 1280, height: 720 });
  await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  if (url) {
    await newPage.goto(url, { waitUntil: 'networkidle0', timeout: DEFAULT_NAVIGATION_TIMEOUT });
  }

  currentPage = newPage;
  logger.info(`Created new tab${url ? ` and navigated to ${url}` : ''}`);
  return newPage;
}

export async function closeTab(tabIndex: number): Promise<void> {
  if (!browser) {
    throw new Error('Browser not initialized');
  }

  const pages = await browser.pages();
  
  if (pages.length <= 1) {
    throw new Error('Cannot close the last remaining tab');
  }

  if (tabIndex < 0 || tabIndex >= pages.length) {
    throw new Error(`Tab index ${tabIndex} is out of range. Available tabs: 0-${pages.length - 1}`);
  }

  const pageToClose = pages[tabIndex];
  
  // If we're closing the current page, switch to another tab
  if (pageToClose === currentPage) {
    // Switch to the next tab, or the previous one if we're closing the last tab
    const newIndex = tabIndex < pages.length - 1 ? tabIndex : tabIndex - 1;
    currentPage = pages[newIndex === tabIndex ? newIndex - 1 : newIndex];
  }

  await pageToClose.close();
  logger.info(`Closed tab ${tabIndex}`);
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    logger.info('Closing browser');
    await browser.close();
    browser = undefined;
    currentPage = undefined;
    logger.info('Browser closed');
  }
}

export function getCurrentPage(): Page | undefined {
  return currentPage;
}

export function getBrowser(): Browser | undefined {
  return browser;
}
