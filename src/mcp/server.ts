#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { WebSocket } from "ws";
import { RenderResult, ServerStatus } from "../shared/types.js";
import { isPortInUse } from "../http/server.js";

export class MindpilotMCPClient {
  private server: Server;
  private ws: WebSocket | null = null;
  private clientId: string;
  private clientName: string;
  private httpPort: number;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(port: number = 4000) {
    this.httpPort = port;
    this.clientId = `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.clientName = `MCP Client ${new Date().toLocaleTimeString()}`;

    this.server = new Server(
      {
        name: "mindpilot-mcp",
        version: "2.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "render_mermaid",
          description:
            'Render a Mermaid diagram to SVG format. CRITICAL RULES: 1) Node IDs must be alphanumeric without spaces (use A1, nodeA, start_node). 2) For node labels with special characters, wrap in quotes: A["Label with spaces"] or A["Process (step 1)"]. 3) For quotes in labels use &quot;, for < use &lt;, for > use &gt;. 4) For square brackets in labels use A["Array&#91;0&#93;"]. 5) Always close all brackets and quotes. 6) Use consistent arrow styles (either --> or ->). Example: graph TD\\n  A["Complex Label"] --> B{Decision?}\\n  B -->|Yes| C["Result &quot;OK&quot;"]\\n\\nIMPORTANT: If the diagram fails validation, the error message will explain what needs to be fixed. Please read the error carefully and retry with a corrected diagram.',
          inputSchema: {
            type: "object",
            properties: {
              diagram: {
                type: "string",
                description:
                  "Mermaid diagram syntax. MUST start with diagram type (graph TD, flowchart LR, sequenceDiagram, etc). Node IDs cannot have spaces. Use quotes for labels with spaces/special chars.",
              },
              background: {
                type: "string",
                description: "Background color",
                default: "white",
              },
            },
            required: ["diagram"],
          },
        },
        {
          name: "open_ui",
          description: "Open the web-based user interface",
          inputSchema: {
            type: "object",
            properties: {
              autoOpen: {
                type: "boolean",
                description: "Automatically open browser",
                default: true,
              },
            },
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        await this.ensureConnection();

        switch (name) {
          case "render_mermaid":
            const renderResult = await this.renderMermaid(
              args?.diagram as string,
              args?.background as string,
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(renderResult, null, 2),
                },
              ],
            };

          case "open_ui":
            const uiResult = await this.openUI(args?.autoOpen as boolean);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(uiResult, null, 2),
                },
              ],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error instanceof Error ? error.message : "Unknown error",
              }),
            },
          ],
        };
      }
    });
  }

  private async ensureConnection(): Promise<void> {
    // First check if singleton server is running
    const serverRunning = await isPortInUse(this.httpPort);

    if (!serverRunning) {
      console.log("Starting singleton HTTP server...");
      await this.startSingletonServer();
      // Wait a bit for server to fully start
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Connect WebSocket if not connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connectWebSocket();
    }
  }

  private async startSingletonServer(): Promise<void> {
    // Start the singleton server as a separate process
    const serverProcess = spawn(
      "node",
      [
        new URL("../http/server.js", import.meta.url).pathname,
        this.httpPort.toString(),
      ],
      {
        detached: true,
        stdio: "ignore",
      },
    );

    serverProcess.unref();
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:${this.httpPort}/ws`;
      console.log(`Connecting to singleton server at ${wsUrl}...`);

      this.ws = new WebSocket(wsUrl);

      this.ws.on("open", () => {
        console.log("Connected to singleton server");
        this.reconnectAttempts = 0;

        // Register this MCP client
        this.ws!.send(
          JSON.stringify({
            type: "register",
            clientId: this.clientId,
            clientName: this.clientName,
          }),
        );

        resolve();
      });

      this.ws.on("error", (error) => {
        console.error("WebSocket error:", error as Error);
        if (this.reconnectAttempts === 0) {
          reject(error);
        }
      });

      this.ws.on("close", () => {
        console.log("Disconnected from singleton server");
        this.ws = null;
        this.attemptReconnect();
      });

      this.ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === "registered") {
            console.log(`Registered with server as ${message.clientId}`);
          }
        } catch (error) {
          console.error("Failed to parse message:", error as Error);
        }
      });
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
    );

    setTimeout(() => {
      this.connectWebSocket().catch((error: Error) => {
        console.error("Reconnection failed:", error);
      });
    }, delay);
  }

  private async renderMermaid(
    diagram: string,
    background?: string,
  ): Promise<RenderResult> {
    // Use HTTP API endpoint
    try {
      const response = await fetch(
        `http://localhost:${this.httpPort}/api/render`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            diagram,
            background,
            clientId: this.clientId,
            clientName: this.clientName,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as RenderResult;

      // Auto-open UI if no WebSocket clients connected
      const statusResponse = await fetch(
        `http://localhost:${this.httpPort}/api/status`,
      );
      if (statusResponse.ok) {
        const status = (await statusResponse.json()) as ServerStatus;
        if (status.clients.length <= 1) {
          // Only this MCP client
          await this.openUI(true);
        }
      }

      return result;
    } catch (error) {
      return {
        type: "error",
        diagram,
        error:
          error instanceof Error ? error.message : "Failed to render diagram",
      };
    }
  }

  private async openUI(
    autoOpen: boolean = true,
  ): Promise<{ url: string; message: string }> {
    const isProduction = process.env.NODE_ENV !== "development";
    const url = isProduction
      ? `http://localhost:${this.httpPort}`
      : `http://localhost:5173`;

    const message = isProduction
      ? `Mindpilot UI is available at ${url}`
      : `Mindpilot UI is available at ${url} (development mode)`;

    if (autoOpen) {
      try {
        const platform = process.platform;
        let command: string;
        let args: string[];

        if (platform === "darwin") {
          command = "open";
          args = [url];
        } else if (platform === "win32") {
          command = "cmd";
          args = ["/c", "start", url];
        } else {
          command = "xdg-open";
          args = [url];
        }

        spawn(command, args, { detached: true, stdio: "ignore" }).unref();
      } catch (error) {
        console.error("Failed to open browser:", error);
      }
    }

    return { url, message };
  }

  async start() {
    const isMCPMode = !process.stdin.isTTY;

    if (isMCPMode) {
      console.log("Starting Mindpilot MCP client...");

      // Monitor parent process in MCP mode
      if (process.ppid) {
        const checkParent = () => {
          try {
            process.kill(process.ppid, 0);
            setTimeout(checkParent, 1000);
          } catch {
            console.log("Parent process ended, shutting down...");
            this.cleanup();
            process.exit(0);
          }
        };
        setTimeout(checkParent, 1000);
      }

      // Handle stdin closure
      process.stdin.on("close", () => {
        console.log("stdin closed, shutting down...");
        this.cleanup();
        process.exit(0);
      });

      const transport = new StdioServerTransport();
      await this.server.connect(transport);
    } else {
      console.log(
        "This MCP server should be run from an MCP host such as Claude Code or Cursor.",
      );
      console.log("To start he server in development mode, run:");
      console.log("  npm run dev");
      process.exit(1);
    }
  }

  private cleanup() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "unregister",
          clientId: this.clientId,
        }),
      );
      this.ws.close();
    }
  }
}

// Start the MCP client
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.argv[2] || "4000", 10);
  const client = new MindpilotMCPClient(port);

  client.start().catch((error) => {
    console.error("Failed to start MCP client:", error);
    process.exit(1);
  });
}
