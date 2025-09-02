import { CallToolResult, TextContent, ImageContent } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../config/logger.js";
import { BrowserState } from "../types/global.js";
import { 
  ensureBrowser, 
  getDebuggerWebSocketUrl, 
  connectToExistingBrowser,
  getCurrentPage 
} from "../browser/connection.js";
import { notifyConsoleUpdate, notifyScreenshotUpdate } from "../resources/handlers.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

export async function handleToolCall(
  name: string, 
  args: any, 
  state: BrowserState,
  server: Server
): Promise<CallToolResult> {
  logger.debug('Tool call received', { tool: name, arguments: args });

  // Handle connect_active_tab separately - don't call ensureBrowser()
  if (name === "puppeteer_connect_active_tab") {
    try {
      const wsEndpoint = await getDebuggerWebSocketUrl(args.debugPort);
      const connectedPage = await connectToExistingBrowser(
        wsEndpoint,
        args.targetUrl,
        (logEntry) => {
          state.consoleLogs.push(logEntry);
          notifyConsoleUpdate(server);
        }
      );
      const url = await connectedPage.url();
      const title = await connectedPage.title();
      return {
        content: [{
          type: "text",
          text: `Successfully connected to browser\nActive webpage: ${title} (${url})`,
        }],
        isError: false,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      const isConnectionError = errorMessage.includes('connect to Chrome debugging port') ||
                              errorMessage.includes('Target closed');

      return {
        content: [{
          type: "text",
          text: `Failed to connect to browser: ${errorMessage}\n\n` +
                (isConnectionError ?
                  "To connect to Chrome:\n" +
                  "1. Close Chrome completely\n" +
                  "2. Reopen Chrome with remote debugging enabled:\n" +
                  "   Windows: chrome.exe --remote-debugging-port=9222\n" +
                  "   Mac: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222\n" +
                  "3. Navigate to your desired webpage\n" +
                  "4. Try the operation again" :
                  "Please check if Chrome is running and try again.")
        }],
        isError: true,
      };
    }
  }

  // For all other tools, ensure we have a page (either connected or launched)
  const page = getCurrentPage() || await ensureBrowser();

  switch (name) {
    case "puppeteer_navigate":
      try {
        logger.info('Navigating to URL', { url: args.url });
        const response = await page.goto(args.url, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        if (!response) {
          throw new Error('Navigation failed - no response received');
        }

        const status = response.status();
        if (status >= 400) {
          throw new Error(`HTTP error: ${status} ${response.statusText()}`);
        }

        logger.info('Navigation successful', { url: args.url, status });
        return {
          content: [{
            type: "text",
            text: `Successfully navigated to ${args.url} (Status: ${status})`,
          }],
          isError: false,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Navigation failed', { url: args.url, error: errorMessage });
        return {
          content: [{
            type: "text",
            text: `Navigation failed: ${errorMessage}\nThis could be due to:\n- Network connectivity issues\n- Site blocking automated access\n- Page requiring authentication\n- Navigation timeout\n\nTry using a different URL or checking network connectivity.`,
          }],
          isError: true,
        };
      }

    case "puppeteer_screenshot": {
      const width = args.width ?? 800;
      const height = args.height ?? 600;
      await page.setViewport({ width, height });

      const screenshot = await (args.selector ?
        (await page.$(args.selector))?.screenshot({ encoding: "base64" }) :
        page.screenshot({ encoding: "base64", fullPage: false }));

      if (!screenshot) {
        return {
          content: [{
            type: "text",
            text: args.selector ? `Element not found: ${args.selector}` : "Screenshot failed",
          }],
          isError: true,
        };
      }

      state.screenshots.set(args.name, screenshot);
      notifyScreenshotUpdate(server);

      return {
        content: [
          {
            type: "text",
            text: `Screenshot '${args.name}' taken at ${width}x${height}`,
          } as TextContent,
          {
            type: "image",
            data: screenshot,
            mimeType: "image/png",
          } as ImageContent,
        ],
        isError: false,
      };
    }

    case "puppeteer_click":
      try {
        await page.click(args.selector);
        return {
          content: [{
            type: "text",
            text: `Clicked: ${args.selector}`,
          }],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to click ${args.selector}: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }

    case "puppeteer_fill":
      try {
        await page.waitForSelector(args.selector);
        await page.type(args.selector, args.value);
        return {
          content: [{
            type: "text",
            text: `Filled ${args.selector} with: ${args.value}`,
          }],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to fill ${args.selector}: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }

    case "puppeteer_select":
      try {
        await page.waitForSelector(args.selector);
        await page.select(args.selector, args.value);
        return {
          content: [{
            type: "text",
            text: `Selected ${args.selector} with: ${args.value}`,
          }],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to select ${args.selector}: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }

    case "puppeteer_hover":
      try {
        await page.waitForSelector(args.selector);
        await page.hover(args.selector);
        return {
          content: [{
            type: "text",
            text: `Hovered ${args.selector}`,
          }],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to hover ${args.selector}: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }

    case "puppeteer_evaluate":
      try {
        // Set up console listener
        const logs: string[] = [];
        const consoleListener = (message: any) => {
          logs.push(`${message.type()}: ${message.text()}`);
        };

        page.on('console', consoleListener);

        // Execute script with proper serialization
        logger.debug('Executing script in browser', { scriptLength: args.script.length });

        // Wrap the script in a function that returns a serializable result
        const result = await page.evaluate(`(async () => {
          try {
            const result = (function() { ${args.script} })();
            return result;
          } catch (e) {
            console.error('Script execution error:', e.message);
            return { error: e.message };
          }
        })()`);

        // Remove the listener to avoid memory leaks
        page.off('console', consoleListener);

        logger.debug('Script execution result', {
          resultType: typeof result,
          hasResult: result !== undefined,
          logCount: logs.length
        });

        return {
          content: [{
            type: "text",
            text: `Execution result:\n${JSON.stringify(result, null, 2)}\n\nConsole output:\n${logs.join('\n')}`,
          }],
          isError: false,
        };
      } catch (error) {
        logger.error('Script evaluation failed', { error: error instanceof Error ? error.message : String(error) });
        return {
          content: [{
            type: "text",
            text: `Script execution failed: ${error instanceof Error ? error.message : String(error)}\n\nPossible causes:\n- Syntax error in script\n- Execution timeout\n- Browser security restrictions\n- Serialization issues with complex objects`,
          }],
          isError: true,
        };
      }

    case "puppeteer_interactable_elements":
      try {
        const includeHidden = args.includeHidden ?? false;
        const maxElements = args.maxElements ?? 200;

        const clickableElements = await page.evaluate((includeHidden, maxElements) => {
          const elements = [];
          const allElements = document.querySelectorAll('*');

          for (let i = 0; i < allElements.length && elements.length < maxElements; i++) {
            const el = allElements[i];

            // Skip hidden elements unless requested
            if (!includeHidden) {
              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                continue;
              }
            }

            // Balanced interactable element detection
            const isInteractable =
              // Standard interactive elements
              ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'DETAILS', 'SUMMARY', 'LABEL'].includes(el.tagName) ||
              // Editable content
              el.hasAttribute('contenteditable') ||
              // Direct interaction event handlers
              el.hasAttribute('onclick') || el.hasAttribute('onmousedown') || el.hasAttribute('ondblclick') ||
              el.hasAttribute('onchange') || el.hasAttribute('oninput') ||
              // ARIA roles for interactive elements
              (el.hasAttribute('role') && ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'slider', 'spinbutton', 'textbox'].includes(el.getAttribute('role')!)) ||
              // Focusable elements
              el.hasAttribute('tabindex') ||
              // Visual indicators
              window.getComputedStyle(el).cursor === 'pointer';

            if (!isInteractable) continue;

            // Enhanced selector generation with priority
            let selector = '';
            const selectors = [];

            // Priority 1: ID
            if (el.id) {
              selectors.push(`#${el.id}`);
            }

            // Priority 2: Name attribute
            const nameAttr = el.getAttribute('name');
            if (nameAttr) {
              selectors.push(`[name="${nameAttr}"]`);
            }

            // Priority 3: Data attributes
            for (let j = 0; j < el.attributes.length; j++) {
              const attr = el.attributes[j];
              if (attr.name.startsWith('data-') && attr.value) {
                selectors.push(`[${attr.name}="${attr.value}"]`);
                break; // Just take the first data attribute
              }
            }

            // Priority 4: Class (first class only)
            if (el.className && typeof el.className === 'string') {
              const firstClass = el.className.trim().split(/\s+/)[0];
              if (firstClass) {
                selectors.push(`.${firstClass}`);
              }
            }

            // Priority 5: Type-specific selectors
            const typeAttr = el.getAttribute('type');
            if (typeAttr) {
              selectors.push(`${el.tagName.toLowerCase()}[type="${typeAttr}"]`);
            }

            // Priority 6: Text-based (for buttons/links with short text)
            const text = el.textContent?.trim();
            if (text && text.length > 0 && text.length <= 30) {
              if (el.tagName === 'BUTTON') {
                selectors.push(`button:contains("${text.replace(/"/g, '\\"')}")`);
              } else if (el.tagName === 'A') {
                selectors.push(`a:contains("${text.replace(/"/g, '\\"')}")`);
              }
            }

            // Priority 7: Nth-child fallback
            const siblings = Array.from(el.parentNode?.children || []);
            const sameTagSiblings = siblings.filter(child => child.tagName === el.tagName);
            const index = sameTagSiblings.indexOf(el) + 1;
            selectors.push(`${el.tagName.toLowerCase()}:nth-of-type(${index})`);

            // Use the first available selector
            selector = selectors[0] || el.tagName.toLowerCase();

            // Enhanced description
            const hrefAttr = el.getAttribute('href');
            const valueAttr = el.getAttribute('value');
            const description = 
              text?.slice(0, 50) ||
              el.getAttribute('aria-label') ||
              el.getAttribute('title') ||
              el.getAttribute('placeholder') ||
              el.getAttribute('alt') ||
              hrefAttr ||
              valueAttr ||
              `${el.tagName}${typeAttr ? `[${typeAttr}]` : ''}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''}`;

            elements.push({
              selector,
              description: description || 'No description',
              tag: el.tagName,
              type: typeAttr || null,
              alternatives: selectors.slice(1, 3) // Show up to 2 alternative selectors
            });
          }

          return elements;
        }, includeHidden, maxElements);

        const summary = `Found ${clickableElements.length} interactable elements:\n\n` +
          clickableElements.map((el, index) => {
            let line = `${index + 1}. ${el.selector} - ${el.description}`;
            if (el.alternatives && el.alternatives.length > 0) {
              line += `\n   Alt: ${el.alternatives.join(', ')}`;
            }
            return line;
          }).join('\n\n');

        return {
          content: [{
            type: "text",
            text: summary,
          }],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to find interactable elements: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }

    default:
      return {
        content: [{
          type: "text",
          text: `Unknown tool: ${name}`,
        }],
        isError: true,
      };
  }
}
