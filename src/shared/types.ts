export interface RenderResult {
  type: "success" | "error";
  diagram: string;
  svg?: string;
  error?: string;
  details?: string;
  background?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface MCPClient {
  id: string;
  name: string;
  connectedAt: Date;
  lastActivity: Date;
}

export interface DiagramBroadcast {
  type: "render_result";
  clientId?: string;
  clientName?: string;
  diagram: string;
  svg?: string;
  error?: string;
  details?: string;
  background?: string;
}

export interface ServerStatus {
  running: boolean;
  port: number;
  clients: MCPClient[];
  uptime: number;
}

export interface ClientMessage {
  type: "render" | "validate" | "register" | "unregister" | "ping";
  clientId?: string;
  clientName?: string;
  diagram?: string;
  background?: string;
}

export interface ServerMessage {
  type: "render_result" | "validation_result" | "registered" | "error" | "pong";
  clientId?: string;
  result?: RenderResult | ValidationResult;
  error?: string;
}