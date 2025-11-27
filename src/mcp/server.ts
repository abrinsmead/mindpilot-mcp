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
import { RenderResult } from "../shared/types.js";
import { HistoryService } from "../shared/historyService.js";
import { renderMermaid } from "../shared/renderer.js";
import { detectGitRepo } from "../shared/gitRepoDetector.js";
import { mcpLogger as logger } from "../shared/logger.js";
import { setMaxListeners } from "events";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Lightweight MCP Server for Mindpilot
 *
 * This is a standalone Node.js process that:
 * 1. Handles MCP protocol on stdio
 * 2. Renders diagrams directly using shared renderer
 * 3. Saves diagrams to history
 * 4. Launches the Electron UI app when needed to display diagrams
 *
 * NO HTTP server needed - everything runs locally!
 */
export class MindpilotMCPServer {
  private server: Server;
  private historyService: HistoryService;
  private dataPath: string | undefined;

  constructor(dataPath?: string) {
    this.dataPath = dataPath;
    this.historyService = new HistoryService(dataPath);

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
          description: "Open the Mindpilot UI application",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "render_mermaid":
            const renderResult = await this.handleRenderMermaid(
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
            const uiResult = await this.handleOpenUI();
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

  /**
   * Render a Mermaid diagram, save to history, and launch the UI
   */
  private async handleRenderMermaid(
    diagram: string,
    background?: string,
    title?: string,
  ): Promise<RenderResult> {
    try {
      // Render the diagram using shared renderer
      const result = await renderMermaid(diagram, background);

      if (result.type === 'error') {
        return result;
      }

      // Save to history
      let diagramId: string | undefined;
      if (title) {
        try {
          const workingDir = process.cwd();
          const collection = await detectGitRepo(workingDir);
          const savedEntry = await this.historyService.saveDiagram(diagram, title, collection);
          diagramId = savedEntry.id;
          logger.info(`Saved diagram "${title}" with ID ${diagramId}`);
        } catch (error) {
          logger.error('Failed to save diagram to history', { error });
        }
      }

      // Launch Electron UI to display the diagram
      if (diagramId) {
        this.launchElectronUI(diagramId);
      }

      return {
        ...result,
        type: 'success',
      };
    } catch (error) {
      return {
        type: "error",
        diagram,
        error: error instanceof Error ? error.message : "Failed to render diagram",
      };
    }
  }

  /**
   * Open the Mindpilot UI application
   */
  private async handleOpenUI(): Promise<{ message: string }> {
    this.launchElectronUI();
    return {
      message: "Mindpilot UI launched",
    };
  }

  /**
   * Launch the Electron UI application
   * Optionally with a specific diagram ID to display
   *
   * If an instance is already running, the new process will trigger the
   * 'second-instance' event on the existing instance and then exit.
   */
  private launchElectronUI(diagramId?: string) {
    try {
      // Path to the Electron main.js (relative to this file's dist location)
      const electronMainPath = path.resolve(__dirname, '../electron/main.js');

      const args = [electronMainPath];

      // Add diagram ID if provided
      if (diagramId) {
        args.push('--show-diagram', diagramId);
      }

      // Pass data path if configured
      if (this.dataPath) {
        args.push('--data-path', this.dataPath);
      }

      logger.info('Launching Electron UI', { diagramId, electronMainPath });

      // Find the electron binary - it's in node_modules/.bin relative to the package root
      // __dirname is dist/mcp, so we go up two levels to get to the package root
      const packageRoot = path.resolve(__dirname, '../..');
      const electronBinName = process.platform === 'win32' ? 'electron.cmd' : 'electron';
      const electronBin = path.join(packageRoot, 'node_modules', '.bin', electronBinName);

      logger.info('Using electron binary', { electronBin });

      // Spawn Electron - if an instance is already running, this will trigger
      // the 'second-instance' event on the existing instance and exit quickly.
      // We use 'pipe' for stdio to capture any errors, but don't detach so
      // we can ensure the single-instance handoff completes properly.
      const electronProcess = spawn(electronBin, args, {
        detached: true,
        stdio: ['ignore', 'ignore', 'pipe'], // Capture stderr for debugging
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'production',
        },
      });

      // Log any errors from the spawned process
      electronProcess.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) {
          logger.warn('Electron stderr', { message: msg });
        }
      });

      // Wait a brief moment before unref to ensure single-instance handoff completes
      setTimeout(() => {
        electronProcess.unref();
      }, 500);

    } catch (error) {
      logger.error('Failed to launch Electron UI', { error });
    }
  }

  /**
   * Start the MCP server
   */
  async start() {
    const isMCPMode = !process.stdin.isTTY;

    if (!isMCPMode) {
      logger.warn(
        "This MCP server should be run from an MCP host such as Claude Code or Cursor.",
      );
      logger.info("To test the UI directly, run: npm run start:electron");
      process.exit(1);
    }

    logger.info("Starting Mindpilot MCP server (lightweight mode)");

    // Monitor parent process
    if (process.ppid) {
      const checkParent = () => {
        try {
          process.kill(process.ppid, 0);
          setTimeout(checkParent, 1000);
        } catch {
          logger.info("Parent process ended, shutting down...");
          process.exit(0);
        }
      };
      setTimeout(checkParent, 1000);
    }

    // Handle stdin closure
    process.stdin.on("close", () => {
      logger.info("stdin closed, shutting down...");
      process.exit(0);
    });

    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info("MCP server connected and ready");
  }
}

// Start the MCP server if run directly
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
      'data-path': {
        type: 'string',
        default: undefined
      }
    }
  });

  const server = new MindpilotMCPServer(values['data-path'] as string | undefined);

  // Handle graceful shutdown
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  server.start().catch((error) => {
    logger.error("Failed to start MCP server", { error });
    process.exit(1);
  });
}
