import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const TOOLS: Tool[] = [
  {
    name: "puppeteer_connect_active_tab",
    description: "Connect to an existing Chrome instance with remote debugging enabled",
    inputSchema: {
      type: "object",
      properties: {
        targetUrl: { 
          type: "string", 
          description: "Optional URL of the target tab to connect to. If not provided, connects to the first available tab." 
        },
        debugPort: {
          type: "number",
          description: "Optional Chrome debugging port (default: 9222)",
          default: 9222
        }
      },
      required: [],
    },
  },
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
    name: "puppeteer_interactable_elements",
    description: "Get all interactable elements on the page with their selectors and descriptions to use page elements for interaction",
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
        // Remove width and height options since we're not changing viewport
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
