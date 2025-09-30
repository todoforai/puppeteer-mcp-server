import { CallToolResult, TextContent, ImageContent } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../config/logger.js";
import { BrowserState } from "../types/global.js";
import { ensureBrowser, getAllTabs, selectTab, createNewTab, closeTab } from "../browser/connection.js";
import { notifyConsoleUpdate, notifyScreenshotUpdate } from "../resources/handlers.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DEFAULT_NAVIGATION_TIMEOUT } from "../config/browser.js";

export async function handleToolCall(
  name: string, 
  args: any, 
  state: BrowserState,
  server: Server
): Promise<CallToolResult> {
  logger.debug('Tool call received', { tool: name, arguments: args });

  // Ensure we have a browser page for all operations
  const page = await ensureBrowser();

  switch (name) {
    case "puppeteer_list_tabs":
      try {
        const tabs = await getAllTabs();
        const tabList = tabs.map((tab, index) => 
          `${index}: ${tab.title || 'Untitled'} - ${tab.url}`
        ).join('\n');

        return {
          content: [{
            type: "text",
            text: `Open tabs (${tabs.length}):\n${tabList}`,
          }],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to list tabs: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }

    case "puppeteer_select_tab":
      try {
        if (args.tabIndex === -1) {
          // Create new tab
          await createNewTab(args.url);
          const tabs = await getAllTabs();
          const newTabIndex = tabs.length - 1;
          return {
            content: [{
              type: "text",
              text: `Created new tab (index: ${newTabIndex})${args.url ? ` and navigated to ${args.url}` : ''}`,
            }],
            isError: false,
          };
        } else {
          // Switch to existing tab
          const selectedPage = await selectTab(args.tabIndex);
          const url = await selectedPage.url();
          const title = await selectedPage.title();
          return {
            content: [{
              type: "text",
              text: `Switched to tab ${args.tabIndex}: ${title} - ${url}`,
            }],
            isError: false,
          };
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to select tab: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }

    case "puppeteer_close_tab":
      try {
        await closeTab(args.tabIndex);
        const tabs = await getAllTabs();
        return {
          content: [{
            type: "text",
            text: `Closed tab ${args.tabIndex}. Remaining tabs: ${tabs.length}`,
          }],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to close tab: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }

    case "puppeteer_navigate":
      try {
        logger.info('Navigating to URL', { url: args.url });
        const response = await page.goto(args.url, {
          waitUntil: 'networkidle0',
          timeout: DEFAULT_NAVIGATION_TIMEOUT
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

      // Get actual viewport size for reporting
      const viewport = page.viewport();
      const viewportInfo = viewport ? `${viewport.width}x${viewport.height}` : "browser natural size";

      state.screenshots.set(args.name, screenshot);
      notifyScreenshotUpdate(server);

      return {
        content: [
          {
            type: "text",
            text: `Screenshot '${args.name}' taken at ${viewportInfo}`,
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
                selectors.push(`button[text*="${text.replace(/"/g, '\\"')}"]`);
              } else if (el.tagName === 'A') {
                selectors.push(`a[text*="${text.replace(/"/g, '\\"')}"]`);
              }
            }

            // Priority 7: Nth-child fallback
            const siblings = Array.from(el.parentNode?.children || []);
            const sameTagSibling = siblings.filter(child => child.tagName === el.tagName);
            const index = sameTagSibling.indexOf(el) + 1;
            selectors.push(`${el.tagName.toLowerCase()}:nth-of-type(${index})`);

            // Use the first available selector
            selector = selectors[0] || el.tagName.toLowerCase();

            // Collect useful attributes
            const hrefAttr = el.getAttribute('href');
            const valueAttr = el.getAttribute('value');
            const srcAttr = el.getAttribute('src');
            const actionAttr = el.getAttribute('action');
            const targetAttr = el.getAttribute('target');
            
            // Enhanced description
            const description = 
              text?.slice(0, 50) ||
              el.getAttribute('aria-label') ||
              el.getAttribute('title') ||
              el.getAttribute('placeholder') ||
              el.getAttribute('alt') ||
              hrefAttr ||
              valueAttr ||
              `${el.tagName}${typeAttr ? `[${typeAttr}]` : ''}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''}`;

            // Build attributes object
            const attributes: any = {};
            if (hrefAttr) attributes.href = hrefAttr;
            if (valueAttr) attributes.value = valueAttr;
            if (srcAttr) attributes.src = srcAttr;
            if (actionAttr) attributes.action = actionAttr;
            if (targetAttr) attributes.target = targetAttr;
            if (typeAttr) attributes.type = typeAttr;
            if (nameAttr) attributes.name = nameAttr;

            elements.push({
              selector,
              description: description || 'No description',
              tag: el.tagName,
              type: typeAttr || null,
              attributes,
              alternatives: selectors.slice(1, 3) // Show up to 2 alternative selectors
            });
          }

          return elements;
        }, includeHidden, maxElements);

        const summary = `Found ${clickableElements.length} interactable elements:\n\n` +
          clickableElements.map((el) => {
            // Build HTML-like representation
            const tag = el.tag.toLowerCase();
            const attrs = Object.entries(el.attributes)
              .map(([k, v]) => `${k}="${v}"`)
              .join(' ');
            const attrString = attrs ? ` ${attrs}` : '';
            
            // Self-closing tags
            const selfClosing = ['input', 'img', 'br', 'hr', 'meta', 'link'];
            if (selfClosing.includes(tag)) {
              return `<${tag}${attrString} />`;
            }
            
            // Regular tags with content
            const content = el.description !== 'No description' && 
                           !el.attributes.href && 
                           !el.attributes.value && 
                           !el.attributes.src ? el.description : '';
            
            return `<${tag}${attrString}>${content}</${tag}>`;
          }).join('\n');

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
