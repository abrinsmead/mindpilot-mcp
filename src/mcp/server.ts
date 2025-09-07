#!/usr/bin/env node

// Suppress npm warnings that can contaminate stdout when running as MCP server
// This must be done before any imports that might trigger npm
if (!process.stdout.isTTY) {
  process.env.npm_config_loglevel = "silent";
  process.env.npm_config_quiet = "true";
  process.env.NODE_NO_WARNINGS = "1";
}

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import { RenderResult, ServerStatus } from "../shared/types.js";
import { isPortInUse } from "../http/server.js";
import { mcpLogger as logger } from "../shared/logger.js";
import { StateMachine, State, Event, StateContext } from "./stateMachine.js";
import { setMaxListeners } from "events";

const colorPrompt = `
  classDef coral fill:#ff6b6b,stroke:#c92a2a,color:#fff
  classDef ocean fill:#4c6ef5,stroke:#364fc7,color:#fff
  classDef forest fill:#51cf66,stroke:#2f9e44,color:#fff
  classDef sunshine fill:#ffd43b,stroke:#fab005,color:#000
  classDef grape fill:#845ef7,stroke:#5f3dc4,color:#fff
  classDef amber fill:#ff922b,stroke:#e8590c,color:#fff
  classDef teal fill:#20c997,stroke:#12b886,color:#fff
  classDef pink fill:#ff8cc8,stroke:#e64980,color:#fff
  classDef tangerine fill:#fd7e14,stroke:#e8590c,color:#fff
  classDef sky fill:#74c0fc,stroke:#339af0,color:#000
  classDef lavender fill:#d0bfff,stroke:#9775fa,color:#000
  classDef mint fill:#8ce99a,stroke:#51cf66,color:#000
  classDef rose fill:#ffa8a8,stroke:#ff6b6b,color:#000
  classDef lemon fill:#ffe066,stroke:#ffd43b,color:#000
  classDef violet fill:#a78bfa,stroke:#8b5cf6,color:#fff
  classDef peach fill:#ffc9c9,stroke:#ffa8a8,color:#000
`;

export class MindpilotMCPClient {
  private server: Server;
  private clientId: string;
  private clientName: string;
  private httpPort: number;
  private keepaliveInterval: NodeJS.Timeout | null = null;
  private stateMachine: StateMachine;
  private abortController: AbortController | null = null;
  private waitServerController: AbortController | null = null;
  private disableAnalytics: boolean;
  private dataPath: string | undefined;

  constructor(port: number = 4000, disableAnalytics: boolean = false, dataPath?: string) {
    this.httpPort = port;
    this.disableAnalytics = disableAnalytics;
    this.dataPath = dataPath;
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

    logger.setMcpServer(this.server);

    // Initialize state machine
    const context: StateContext = {
      httpPort: this.httpPort,
      retryCount: 0,
      maxRetries: 5,
    };
    this.stateMachine = new StateMachine(context);
    this.setupStateHandlers();
    this.setupHandlers();
  }

  private getAbortSignal(): AbortSignal | undefined {
    // Use a single controller for all regular operations
    if (!this.abortController || this.abortController.signal.aborted) {
      this.abortController = new AbortController();
    }
    return this.abortController.signal;
  }

  private getWaitServerSignal(): AbortSignal | undefined {
    // Reuse the same controller for the wait server loop to avoid listener accumulation
    if (!this.waitServerController || this.waitServerController.signal.aborted) {
      this.waitServerController = new AbortController();
    }
    return this.waitServerController.signal;
  }

  private cancelAllRequests() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.waitServerController) {
      this.waitServerController.abort();
      this.waitServerController = null;
    }
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "render_mermaid",
          description:
            'Render a Mermaid diagram to SVG format. CRITICAL RULES: 1) Node IDs must be alphanumeric without spaces (use A1, nodeA, start_node). 2) For node labels with special characters, wrap in quotes: A["Label with spaces"] or A["Process (step 1)"]. 3) For quotes in labels use &quot;, for < use &lt;, for > use &gt;. 4) For square brackets in labels use A["Array&#91;0&#93;"]. 5) Always close all brackets and quotes. 6) Use consistent arrow styles (either --> or ->). 7) Avoid starting node labels with numbers (e.g., "3. Step") as they may be interpreted as markdown lists - use Roman numerals instead (e.g., "III. Step"). Example: graph TD\\n  A["Complex Label"] --> B{Decision?}\\n  B -->|Yes| C["Result &quot;OK&quot;"]\\n\\nIMPORTANT: If the diagram fails validation, the error message will explain what needs to be fixed. Please read the error carefully and retry with a corrected diagram.',
          inputSchema: {
            type: "object",
            properties: {
              diagram: {
                type: "string",
                description: `Mermaid diagram syntax. MUST start with diagram type (graph TD, flowchart LR, sequenceDiagram, etc). Node IDs cannot have spaces. Use quotes for labels with spaces/special chars. Avoid forward slashes. Use this colors which work well for both light and dark mode: ${colorPrompt}`,
              },
              background: {
                type: "string",
                description: "Background color",
                default: "white",
              },
              title: {
                type: "string",
                description: "Title for the diagram (max 50 characters)",
                maxLength: 50,
              },
            },
            required: ["diagram", "title"],
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
              args?.title as string,
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
    const state = this.stateMachine.getState();

    if (state !== State.CONNECTED) {
      logger.info("Not connected, waiting for connection...", {
        currentState: state,
      });

      // Wait for connection with timeout
      const timeout = 10000; // 10 seconds
      const startTime = Date.now();

      while (this.stateMachine.getState() !== State.CONNECTED) {
        if (Date.now() - startTime > timeout) {
          throw new Error("Timeout waiting for server connection");
        }

        if (this.stateMachine.getState() === State.ERROR) {
          throw new Error("Server connection failed");
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  private async startSingletonServer(): Promise<void> {
    // Check if debug mode is enabled
    const isDebugMode = process.argv.includes("--debug");

    // Resolve the HTTP server path in a cross-platform way that works with npm installs
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const httpServerPath = path.resolve(__dirname, "../http/server.js");

    // Start the HTTP server as a separate process
    const args = [httpServerPath, '--port', this.httpPort.toString()];

    // Debug mode is communicated via MINDPILOT_DEBUG env; no CLI flag needed

    // Pass disable-analytics flag to server if enabled
    if (this.disableAnalytics) {
      args.push("--disable-analytics");
    }

    // Pass data-path flag to server if provided
    if (this.dataPath) {
      args.push("--data-path");
      args.push(this.dataPath);
    }

    // Use the same Node executable that launched this process to
    // avoid PATH issues inside MCP hosts or GUI environments.
    const serverProcess = spawn(process.execPath, args, {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        MINDPILOT_DEBUG: isDebugMode ? "true" : "false",
      },
    });

    serverProcess.unref();
  }

  private async renderMermaid(
    diagram: string,
    background?: string,
    title?: string,
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
            title,
            clientId: this.clientId,
            clientName: this.clientName,
            workingDir: process.cwd(),
          }),
          signal: this.getAbortSignal(),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as RenderResult;

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
        logger.error("Failed to open browser", { error });
      }
    }

    return { url, message };
  }

  private startKeepalive() {
    // Send initial keepalive
    this.sendKeepalive();

    // Send keepalive every 30 seconds
    this.keepaliveInterval = setInterval(() => {
      this.sendKeepalive();
    }, 30000);
  }

  private async sendKeepalive() {
    try {
      const response = await fetch(
        `http://localhost:${this.httpPort}/api/keepalive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: this.clientId }),
          signal: this.getAbortSignal(),
        },
      );

      if (!response.ok) {
        logger.warn("Keepalive failed", { status: response.status });
        await this.stateMachine.transition(Event.KEEPALIVE_FAILED);
      }
    } catch (error) {
      logger.warn("Keepalive error", { error });
      await this.stateMachine.transition(Event.KEEPALIVE_FAILED);
    }
  }

  private setupStateHandlers() {
    // CHECKING_SERVER state handler
    this.stateMachine.setStateHandler(
      State.CHECKING_SERVER,
      async (context) => {
        try {
          const serverRunning = await isPortInUse(
            context.httpPort,
            this.getAbortSignal(),
          );
          context.serverRunning = serverRunning;

          if (serverRunning) {
            logger.info("Server already running");
            await this.stateMachine.transition(Event.SERVER_CHECK_COMPLETE);
          } else {
            logger.info("Server not running");
            await this.stateMachine.transition(Event.ERROR_OCCURRED);
          }
        } catch (error) {
          context.error = error as Error;
          await this.stateMachine.transition(Event.ERROR_OCCURRED);
        }
      },
    );

    // STARTING_SERVER state handler
    this.stateMachine.setStateHandler(
      State.STARTING_SERVER,
      async (context) => {
        try {
          logger.info("Starting HTTP server...");
          await this.startSingletonServer();
          await this.stateMachine.transition(Event.SERVER_STARTED);
        } catch (error) {
          context.error = error as Error;
          await this.stateMachine.transition(Event.ERROR_OCCURRED);
        }
      },
    );

    // WAITING_FOR_SERVER state handler
    this.stateMachine.setStateHandler(
      State.WAITING_FOR_SERVER,
      async (context) => {
        // Wait for server to be ready
        let attempts = 0;
        const maxAttempts = 20; // 10 seconds total

        while (attempts < maxAttempts) {
          try {
            const serverRunning = await isPortInUse(
              context.httpPort,
              this.getWaitServerSignal(),
            );
            if (serverRunning) {
              logger.info("Server is now ready");
              await this.stateMachine.transition(Event.CONNECTION_ESTABLISHED);
              return;
            }
          } catch (error) {
            // Ignore errors while waiting
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
          attempts++;
        }

        context.error = new Error("Server failed to start within timeout");
        await this.stateMachine.transition(Event.ERROR_OCCURRED);
      },
    );

    // CONNECTED state handler
    this.stateMachine.setStateHandler(State.CONNECTED, async (context) => {
      logger.info("Connected to server, starting keepalive");
      this.startKeepalive();
    });

    // RECONNECTING state handler
    this.stateMachine.setStateHandler(State.RECONNECTING, async (context) => {
      logger.warn("Connection lost, attempting to reconnect...");

      // Stop keepalive during reconnection
      if (this.keepaliveInterval) {
        clearInterval(this.keepaliveInterval);
        this.keepaliveInterval = null;
      }

      // Cancel any pending requests
      this.cancelAllRequests();

      // Wait a bit before reconnecting
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        const serverRunning = await isPortInUse(
          context.httpPort,
          this.getAbortSignal(),
        );
        if (serverRunning) {
          await this.stateMachine.transition(Event.CONNECTION_ESTABLISHED);
        } else {
          context.error = new Error("Server no longer running");
          await this.stateMachine.transition(Event.ERROR_OCCURRED);
        }
      } catch (error) {
        context.error = error as Error;
        await this.stateMachine.transition(Event.ERROR_OCCURRED);
      }
    });

    // ERROR state handler
    this.stateMachine.setStateHandler(State.ERROR, async (context) => {
      logger.error("Server connection error", { error: context.error });

      if (context.retryCount < context.maxRetries) {
        context.retryCount++;
        logger.info(
          `Retrying connection (attempt ${context.retryCount}/${context.maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await this.stateMachine.transition(Event.START);
      } else {
        logger.error("Max retries exceeded, exiting MCP client");
        process.exit(1);
      }
    });

    // SHUTDOWN state handler
    this.stateMachine.setStateHandler(State.SHUTDOWN, async (context) => {
      logger.info("Shutting down MCP client");
      if (this.keepaliveInterval) {
        clearInterval(this.keepaliveInterval);
        this.keepaliveInterval = null;
      }

      // Cancel all pending requests
      this.cancelAllRequests();
    });

    // Log state transitions
    this.stateMachine.setOnTransition((from, to, event) => {
      logger.debug("State transition", { from, to, event });
    });
  }

  async start(options: { test?: boolean; debug?: boolean } = {}) {
    const isTestMode = options.test || false;
    const isMCPMode = !process.stdin.isTTY || isTestMode;

    if (isMCPMode) {
      const isDebugMode = options.debug || false;
      logger.info("Starting Mindpilot MCP client", {
        debugMode: isDebugMode,
        testMode: isTestMode,
      });

      // Start the state machine to ensure server connection
      await this.stateMachine.transition(Event.START);

      // Wait for connection to be established before connecting stdio
      await this.ensureConnection();

      // In test mode, don't connect stdio transport
      if (isTestMode) {
        logger.info(
          `Test mode: Server started successfully. UI available at http://localhost:${this.httpPort}`,
        );
        logger.info("Use Ctrl+C to exit");
        // Keep the process alive in test mode
        process.stdin.resume();
        return;
      }

      // Monitor parent process in MCP mode
      if (process.ppid) {
        const checkParent = () => {
          try {
            process.kill(process.ppid, 0);
            setTimeout(checkParent, 1000);
          } catch {
            logger.info("Parent process ended, shutting down...");
            this.cleanup();
            process.exit(0);
          }
        };
        setTimeout(checkParent, 1000);
      }

      // Handle stdin closure
      process.stdin.on("close", () => {
        logger.info("stdin closed, shutting down...");
        this.cleanup();
        process.exit(0);
      });

      const transport = new StdioServerTransport();
      await this.server.connect(transport);
    } else {
      logger.warn(
        "This MCP server should be run from an MCP host such as Claude Code or Cursor.",
      );
      logger.info("To test the UI directly, run: npm run dev");
      logger.info("To test the MCP server directly, run with --test flag");
      process.exit(1);
    }
  }

  async cleanup() {
    await this.stateMachine.transition(Event.SHUTDOWN_REQUESTED);
  }
}

// Start the MCP client
// Check if this file is being run directly (works with npm global installs)
const isMainModule = () => {
  const currentFile = fileURLToPath(import.meta.url);
  const mainFile = process.argv[1];

  // Handle npm global installs where argv[1] might be a wrapper
  if (mainFile && mainFile.includes("mindpilot-mcp")) {
    return true;
  }

  // Standard check for direct execution
  return currentFile === mainFile;
};

if (isMainModule()) {
  // Increase the MaxListeners limit to prevent warnings
  setMaxListeners(20, process);

  const { parseArgs } = await import('node:util');
  
  const { values } = parseArgs({
    options: {
      port: {
        type: 'string',
        short: 'p',
        default: '4000'
      },
      test: {
        type: 'boolean',
        default: false
      },
      debug: {
        type: 'boolean',
        default: false
      },
      'disable-analytics': {
        type: 'boolean',
        default: false
      },
      'data-path': {
        type: 'string',
        default: undefined
      }
    }
  });
  
  const port = parseInt(values.port!, 10);
  const client = new MindpilotMCPClient(port, values['disable-analytics'] as boolean, values['data-path'] as string | undefined);

  // Handle graceful shutdown
  const shutdown = async () => {
    await client.cleanup();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown());
  process.on("SIGTERM", () => shutdown());
  process.on("beforeExit", async () => {
    await client.cleanup();
  });

  client.start({ test: values.test, debug: values.debug }).catch((error) => {
    logger.error("Failed to start MCP client", { error });
    process.exit(1);
  });
}
