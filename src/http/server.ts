import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { WebSocket } from "ws";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import {
  RenderResult,
  MCPClient,
  DiagramBroadcast,
  ClientMessage,
  ServerMessage,
  ServerStatus,
} from "../shared/types.js";
import { renderMermaid } from "../shared/renderer.js";
import { validateMermaidSyntax } from "../shared/validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SingletonHTTPServer {
  private fastify: FastifyInstance | null = null;
  private port: number;
  private wsClients: Map<any, MCPClient> = new Map();
  private allConnections: Set<any> = new Set(); // Track ALL WebSocket connections
  private lastDiagram: DiagramBroadcast | null = null;
  private startTime: Date = new Date();
  private shutdownTimer: NodeJS.Timeout | null = null;
  private readonly SHUTDOWN_DELAY_MS = 5000; // 5 seconds grace period

  constructor(port: number = 4000) {
    this.port = port;
  }

  async start(): Promise<void> {
    if (this.fastify) {
      return; // Already running
    }

    this.fastify = Fastify({
      logger: false,
    });

    await this.setupRoutes();

    try {
      await this.fastify.listen({ port: this.port, host: "0.0.0.0" });
      console.log(`Singleton HTTP server started on port ${this.port}`);
      this.cancelShutdownTimer();
    } catch (error) {
      console.error("Failed to start HTTP server:", error);
      throw error;
    }
  }

  private async setupRoutes() {
    if (!this.fastify) return;

    // Register WebSocket plugin
    await this.fastify.register(fastifyWebsocket);

    // Serve static files in production mode
    const isProduction = process.env.NODE_ENV !== "development";
    if (isProduction) {
      const projectRoot = path.resolve(__dirname, "../..");
      const builtClientPath = path.join(projectRoot, "dist/public");

      // Check if built client exists
      try {
        await fs.access(builtClientPath);
        await this.fastify.register(fastifyStatic, {
          root: builtClientPath,
        });

        this.fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
          return reply.sendFile("index.html");
        });
      } catch {
        console.warn("Built client not found. Run 'npm run build' to build the client.");
      }
    }

    // Status endpoint
    this.fastify.get("/api/status", async (request: FastifyRequest, reply: FastifyReply) => {
      const status: ServerStatus = {
        running: true,
        port: this.port,
        clients: Array.from(this.wsClients.values()),
        uptime: Date.now() - this.startTime.getTime(),
      };
      return reply.send(status);
    });

    // Debug endpoint
    this.fastify.get("/api/debug", async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        wsClients: this.wsClients.size,
        serverRunning: true,
        fastifyReady: this.fastify ? true : false,
        clients: Array.from(this.wsClients.values()).map(client => ({
          ...client,
          connected: true,
        })),
      });
    });

    // API routes
    this.fastify.post("/api/render", async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { diagram, background, clientId, clientName } = request.body as any;
        const result = await renderMermaid(diagram, background);

        // Broadcast to all WebSocket clients
        this.broadcastToClients({
          type: "render_result",
          clientId,
          clientName,
          diagram: result.diagram,
          svg: result.svg,
          error: result.error,
          details: result.details,
          background: result.background,
        });

        return reply.send(result);
      } catch (error) {
        const errorResult: RenderResult = {
          type: "error",
          diagram: "",
          error: error instanceof Error ? error.message : "Unknown error",
        };
        return reply.code(500).send(errorResult);
      }
    });

    this.fastify.post("/api/validate", async (request: FastifyRequest, reply: FastifyReply) => {
      const { diagram } = request.body as any;
      const result = await validateMermaidSyntax(diagram);
      return reply.send(result);
    });

    // WebSocket route
    const self = this;
    this.fastify.register(async function (fastify) {
      fastify.get("/ws", { websocket: true }, (socket, request) => {
        let client: MCPClient | null = null;
        
        // Track ALL connections for broadcasting
        self.allConnections.add(socket);
        console.log(`New WebSocket connection. Total connections: ${self.allConnections.size}`);
        
        // Send last diagram if available to new connections
        if (self.lastDiagram) {
          socket.socket.send(JSON.stringify(self.lastDiagram));
        }

        socket.on("message", async (data) => {
          try {
            const message: ClientMessage = JSON.parse(data.toString());

            switch (message.type) {
              case "register":
                client = {
                  id: message.clientId || `client-${Date.now()}`,
                  name: message.clientName || "Unknown MCP Client",
                  connectedAt: new Date(),
                  lastActivity: new Date(),
                };
                self.wsClients.set(socket, client);
                self.cancelShutdownTimer();

                const response: ServerMessage = {
                  type: "registered",
                  clientId: client.id,
                };
                socket.socket.send(JSON.stringify(response));

                console.log(`MCP client registered: ${client.name} (${client.id})`);
                
                // Send last diagram if available
                if (self.lastDiagram) {
                  socket.socket.send(JSON.stringify(self.lastDiagram));
                }
                break;

              case "render":
                if (client) {
                  client.lastActivity = new Date();
                }
                const renderResult = await renderMermaid(message.diagram!, message.background);
                const broadcast: DiagramBroadcast = {
                  type: "render_result",
                  clientId: client?.id,
                  clientName: client?.name,
                  diagram: renderResult.diagram,
                  svg: renderResult.svg,
                  error: renderResult.error,
                  details: renderResult.details,
                  background: renderResult.background,
                };
                self.broadcastToClients(broadcast);
                break;

              case "validate":
                const validationResult = await validateMermaidSyntax(message.diagram!);
                const validationResponse: ServerMessage = {
                  type: "validation_result",
                  result: validationResult,
                };
                socket.socket.send(JSON.stringify(validationResponse));
                break;

              case "ping":
                if (client) {
                  client.lastActivity = new Date();
                }
                socket.socket.send(JSON.stringify({ type: "pong" }));
                break;
            }
          } catch (error) {
            console.error("WebSocket message error:", error);
            const errorResponse: ServerMessage = {
              type: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            };
            socket.socket.send(JSON.stringify(errorResponse));
          }
        });

        socket.on("close", () => {
          // Remove from all connections
          self.allConnections.delete(socket);
          console.log(`WebSocket disconnected. Total connections: ${self.allConnections.size}`);
          
          // Handle MCP client cleanup if registered
          const client = self.wsClients.get(socket as any);
          if (client) {
            console.log(`MCP client disconnected: ${client.name} (${client.id})`);
            self.wsClients.delete(socket as any);
            self.checkForShutdown();
          }
        });

        socket.on("error", (error) => {
          console.error("WebSocket error:", error);
          self.allConnections.delete(socket);
          self.wsClients.delete(socket as any);
          self.checkForShutdown();
        });
      });
    });
  }

  private broadcastToClients(message: DiagramBroadcast) {
    // Cache the last diagram
    this.lastDiagram = message;

    // Broadcast to ALL connected WebSocket clients (both browser and MCP)
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    this.allConnections.forEach((socket) => {
      try {
        socket.socket.send(messageStr);
        sentCount++;
      } catch (err) {
        // Socket might be closed
      }
    });
    console.log(`Broadcast diagram to ${sentCount} clients`);
  }

  private checkForShutdown() {
    // If no clients are connected, start shutdown timer
    if (this.wsClients.size === 0) {
      console.log(`No MCP clients connected. Server will shut down in ${this.SHUTDOWN_DELAY_MS / 1000} seconds if no new connections...`);
      
      this.shutdownTimer = setTimeout(() => {
        console.log("Shutting down singleton server - no active clients");
        this.stop();
      }, this.SHUTDOWN_DELAY_MS);
    }
  }

  private cancelShutdownTimer() {
    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
      this.shutdownTimer = null;
    }
  }

  async stop(): Promise<void> {
    this.cancelShutdownTimer();
    
    if (this.fastify) {
      await this.fastify.close();
      this.fastify = null;
    }
    
    this.wsClients.clear();
    process.exit(0);
  }

  async openUI(autoOpen: boolean = true): Promise<{ url: string; message: string }> {
    const isProduction = process.env.NODE_ENV !== "development";
    const url = isProduction
      ? `http://localhost:${this.port}`
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

  isRunning(): boolean {
    return this.fastify !== null;
  }

  getPort(): number {
    return this.port;
  }

  getClients(): MCPClient[] {
    return Array.from(this.wsClients.values());
  }
}

// Helper function to check if a server is already running on a port
export async function isPortInUse(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/api/status`);
    return response.ok;
  } catch {
    return false;
  }
}

// Start singleton server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.argv[2] || "4000", 10);
  const server = new SingletonHTTPServer(port);
  
  server.start().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down server...");
    await server.stop();
  });

  process.on("SIGTERM", async () => {
    console.log("\nShutting down server...");
    await server.stop();
  });
}