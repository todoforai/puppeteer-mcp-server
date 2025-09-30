import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const TOOLS: Tool[] = [
  {
    name: "puppeteer_navigate",
    description: "Navigate to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "puppeteer_list_tabs",
    description: "List all open tabs in the browser with their URLs, titles, and tab IDs",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "puppeteer_select_tab",
    description: "Switch to a specific tab by its index or create a new tab",
    inputSchema: {
      type: "object",
      properties: {
        tabIndex: { 
          type: "number", 
          description: "Index of the tab to switch to (0-based). Use -1 to create a new tab." 
        },
        url: {
          type: "string",
          description: "Optional URL to navigate to when creating a new tab (only used when tabIndex is -1)"
        }
      },
      required: ["tabIndex"],
    },
  },
  {
    name: "puppeteer_close_tab",
    description: "Close a specific tab by its index. Cannot close the last remaining tab.",
    inputSchema: {
      type: "object",
      properties: {
        tabIndex: { 
          type: "number", 
          description: "Index of the tab to close (0-based)" 
        }
      },
      required: ["tabIndex"],
    },
  },
  {
    name: "puppeteer_interactable_elements",
    description: "Primary navigation tool - Lists all interactive elements (buttons, links, inputs, dropdowns) with their selectors and descriptions. Use this to understand available actions, then take screenshots for visual context if needed.",
    inputSchema: {
      type: "object",
      properties: {
        includeHidden: { 
          type: "boolean", 
          description: "Include hidden elements (default: false)",
          default: false
        },
        maxElements: {
          type: "number",
          description: "Maximum number of elements to return (default: 200)",
          default: 200
        }
      },
      required: [],
    },
  },
  {
    name: "puppeteer_screenshot",
    description: "Take a screenshot of the current page or a specific element",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name for the screenshot" },
        selector: { type: "string", description: "CSS selector for element to screenshot" },
      },
      required: ["name"],
    },
  },
  {
    name: "puppeteer_click",
    description: "Click an element on the page",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for element to click" },
      },
      required: ["selector"],
    },
  },
  {
    name: "puppeteer_fill",
    description: "Fill out an input field",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for input field" },
        value: { type: "string", description: "Value to fill" },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "puppeteer_select",
    description: "Select an element on the page with Select tag",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for element to select" },
        value: { type: "string", description: "Value to select" },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "puppeteer_hover",
    description: "Hover an element on the page",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for element to hover" },
      },
      required: ["selector"],
    },
  },
  {
    name: "puppeteer_evaluate",
    description: "Execute JavaScript in the browser console",
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "JavaScript code to execute" },
      },
      required: ["script"],
    },
  },
];
