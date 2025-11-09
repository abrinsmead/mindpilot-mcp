# Mindpilot MCP
[![GitHub Repo stars](https://img.shields.io/github/stars/abrinsmead/mindpilot-mcp)](https://github.com/abrinsmead/mindpilot-mcp)
[![NPM Version](https://img.shields.io/npm/v/@mindpilot/mcp)](https://www.npmjs.com/package/@mindpilot/mcp)
[![GitHub License](https://img.shields.io/github/license/abrinsmead/mindpilot-mcp)](https://github.com/abrinsmead/mindpilot-mcp/blob/main/LICENSE)

See through your agent's eyes. Visualize legacy code, inspect complex flows, understand everything.

![Screenshot](https://raw.githubusercontent.com/abrinsmead/mindpilot-mcp/main/mindpilot-mcp-latest.png)

<a href="https://glama.ai/mcp/servers/@abrinsmead/mindpilot-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@abrinsmead/mindpilot-mcp/badge" alt="Mindpilot MCP server" />
</a>

## Why Mindpilot?
- **Visualize Anything**: Use your coding agent to generate on-demand architecture, code, and process diagrams to view your code from different perspectives.
- **Vibe Checks**: AI-generated code can accumulate unused and redundant constructs. Use visualizations to spot areas that need cleanup.
- **Local Processing**: Diagrams are never sent to the cloud. Everything stays between you, your agent, and your agent's LLM provider(s).
- **Export & Share**: Export any diagram as a vector image.

## Prerequisites

Node.js v20.0.0 or higher.

## Quickstart

### Claude Code
`claude mcp add mindpilot -- npx @mindpilot/mcp@latest`

### Cursor

#### One-click Installer
<a href="cursor://anysphere.cursor-deeplink/mcp/install?name=mindpilot&config=eyJjb21tYW5kIjoibnB4IEBtaW5kcGlsb3QvbWNwQGxhdGVzdCJ9">
  <img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install MCP Server" />
</a>

*Click the button above to automatically install Mindpilot in Cursor (requires Cursor to be installed)*

#### Manual Configuration
Under `Settings` > `Cursor Settings` > `MCP` > Click `Add new global MCP server` and configure mindpilot in the `mcpServers` object.

```
{
  "mcpServers": {
    "mindpilot": {
      "command": "npx",
      "args": ["@mindpilot/mcp@latest"]
    }
  }
}
```

### VS Code

#### One-click Installers
<a href="vscode:mcp/install?%7B%22name%22%3A%22Mindpilot%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22%40mindpilot%2Fmcp%22%5D%7D">
  <img src="https://img.shields.io/badge/VS_Code-Install_Mindpilot-0098FF?style=flat-square&logo=visualstudiocode&logoColor=ffffff" alt="Install in VS Code" />
</a>

<a href="vscode-insiders:mcp/install?%7B%22name%22%3A%22Mindpilot%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22%40mindpilot%2Fmcp%22%5D%7D">
  <img src="https://img.shields.io/badge/VS_Code_Insiders-Install_Mindpilot-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=ffffff" alt="Install in VS Code Insiders" />
</a>

*Click the buttons above to automatically install Mindpilot (requires VS Code/VS Code Insiders to be installed)*

#### Manual Configuration

Follow the instructions here for enabling MCPs in VS Code:  https://code.visualstudio.com/docs/copilot/chat/mcp-servers

Go to `Settings` > `Features` > `MCP`, then click `Edit in settings json`

Then add mindpilot to your MCP configuration:

```
{
  "mcp": {
    "servers": {
      "mindpilot": {
        "type": "stdio",
        "command": "npx",
        "args": ["@mindpilot/mcp@latest"]
      }
    }
  }
}
```

### Windsurf

Under `Settings` > `Windsurf Settings` > `Manage Plugins`, click `view raw config` and configure mindpilot in the `mcpServers` object:

```
{
  "mcpServers": {
    "mindpilot": {
      "command": "npx",
      "args": ["@mindpilot/mcp@latest"]
    }
  }
}
```

### Zed
In the AI Thread panel click on the three dots `...`, then click `Add Custom Server...`

In the `Command to run MCPserver` field enter `npx @mindpilot/mcp@latest` and click `Add Server`.

## Configuration Options
- **Port**: The server defaults to port 4000 but can be configured using the `--port` command line switch.
- **Data Path**: By default, diagrams are saved to `~/.mindpilot/data/`. You can specify a custom location using the `--data-path` command line switch.

## Multi-Client Support

Mindpilot intelligently handles multiple AI assistants running simultaneously. When you have multiple Claude Desktop windows or IDE instances open:

- The first mcp client to use Mindpilot starts a shared web server
- Additional assistants automatically connect to the existing server
- All assistants share the same diagram history and web interface
- The server will automatically shuts down a minute after the last MCP clinet disconnects

This means you can work with multiple MCP hosts at once without port conflicts, and they'll all contribute to the same collection of diagrams.

## Anonymous Usage Tracking

Mindpilot MCP collects anonymous usage data to help us understand how the product is being used and improve the user experience.

### Disabling Analytics
If you prefer not to share anonymous usage data, you can disable analytics by adding the `--disable-analytics` flag to your MCP configuration:

**Claude Code:**
```bash
claude mcp add mindpilot -- npx @mindpilot/mcp@latest --disable-analytics
```

**Other IDEs:**
Add `"--disable-analytics"` to the args array in your configuration:
```json
{
  "command": "npx",
  "args": ["@mindpilot/mcp@latest", "--disable-analytics"]
}
```

## Using the MCP server
After configuring the MCP in your coding agent you can make requests like "create a diagram about x" and it should use the MCP server to render Mermaid diagrams for you in a browser connected to the MCP server.

You can optionally update your agent's rules file to give specific instructions about when to use mindpilot-mcp.

### Example requests
- "Show me the state machine for WebSocket connection logic"
- "Create a C4 context diagram of this project's architecture."
- "Show me the OAuth flow as a sequence diagram"

## How it works
Frontier LLMs are well trained to generate valid Mermaid syntax. The MCP is designed to accept Mermaid syntax and render diagrams in a web app running on http://localhost:4000 (default port).

## Troubleshooting

### Port Conflicts
If you use port 4000 for another service you can configure the MCP to use a different port.

Claude Code example:
`claude mcp add mindpilot -- npx @mindpilot/mcp@latest --port 5555`

### Custom Data Path
To save diagrams to a custom location (e.g., for syncing with cloud storage):

Claude Code example:
`claude mcp add mindpilot -- npx @mindpilot/mcp@latest --data-path /path/to/custom/location`

Other IDEs:
```json
{
  "command": "npx",
  "args": ["@mindpilot/mcp@latest", "--data-path", "/path/to/custom/location"]
}
```

### asdf Issues
If you use `asdf` as a version manager and have trouble getting MCPs to work (not just mindpilot), you may need to set a "global" nodejs version from your home directory.

```
cd
asdf set nodejs x.x.x
```

## Development Configuration
Configure the MCP in your coding agent (using `claude` in this example)

`claude mcp add mindpilot -- npx tsx <path to...>/src/server/server.ts`

Run `claude` with the `--debug` flag if you need to see MCP errors

Start the development client (Vite) to get hot module reloading while developing.

`npm run dev`

Open the development client
`localhost:5173`