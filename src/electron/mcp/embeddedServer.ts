/**
 * Embedded MCP Server for Electron
 *
 * This runs inside the Electron main process and communicates with the
 * renderer via IPC instead of HTTP. No port conflicts possible!
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { BrowserWindow } from 'electron';
import { RenderResult } from '../../shared/types.js';
import { HistoryService } from '../../shared/historyService.js';
import { renderMermaid } from '../../shared/renderer.js';
import { detectGitRepo } from '../../shared/gitRepoDetector.js';

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

export class EmbeddedMCPServer {
  private server: Server;
  private historyService: HistoryService;
  private isRunning: boolean = false;
  private onDiagramUpdate: ((diagram: string, title: string, id: string) => void) | null = null;

  constructor(dataPath?: string) {
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

    this.setupHandlers();
  }

  /**
   * Set callback for when a new diagram is rendered
   */
  setDiagramUpdateHandler(handler: (diagram: string, title: string, id: string) => void) {
    this.onDiagramUpdate = handler;
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
          description: "Focus the Mindpilot window (always open in Electron mode)",
          inputSchema: {
            type: "object",
            properties: {
              autoOpen: {
                type: "boolean",
                description: "Automatically focus window",
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

  private async renderMermaid(
    diagram: string,
    background?: string,
    title?: string,
  ): Promise<RenderResult> {
    try {
      // Validate the diagram
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
          console.log(`[EmbeddedMCP] Saved diagram "${title}" with ID ${diagramId}`);
        } catch (error) {
          console.error('[EmbeddedMCP] Failed to save diagram to history:', error);
        }
      }

      // Notify renderer about new diagram via IPC
      if (this.onDiagramUpdate && diagramId && title) {
        this.onDiagramUpdate(diagram, title, diagramId);
      }

      // Focus/show the window
      this.focusWindow();

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

  private async openUI(autoOpen: boolean = true): Promise<{ message: string }> {
    if (autoOpen) {
      this.focusWindow();
    }

    return {
      message: "Mindpilot window focused",
    };
  }

  private focusWindow() {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const mainWindow = windows[0];
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  }

  /**
   * Start the MCP server on stdio
   * This should be called when the Electron app detects it was launched by an MCP host
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[EmbeddedMCP] Server already running');
      return;
    }

    console.log('[EmbeddedMCP] Starting embedded MCP server...');

    // Monitor parent process
    if (process.ppid) {
      const checkParent = () => {
        try {
          process.kill(process.ppid, 0);
          setTimeout(checkParent, 1000);
        } catch {
          console.log('[EmbeddedMCP] Parent process ended, but keeping Electron alive');
          // In Electron mode, we don't exit - just stop responding to MCP
          this.isRunning = false;
        }
      };
      setTimeout(checkParent, 1000);
    }

    // Handle stdin closure
    process.stdin.on("close", () => {
      console.log('[EmbeddedMCP] stdin closed, MCP connection ended');
      this.isRunning = false;
      // Don't exit - keep Electron running
    });

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.isRunning = true;

    console.log('[EmbeddedMCP] MCP server connected and ready');
  }

  /**
   * Check if the MCP server is currently running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the history service for IPC handlers
   */
  getHistoryService(): HistoryService {
    return this.historyService;
  }
}
