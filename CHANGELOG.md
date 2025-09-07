# CHANGELOG

## 0.6.0
- Enhanced navigation system with smooth, intuitive controls ([see visualizations](docs/visualizations/navigation-features.md))
  - Mouse wheel now pans by default (matching user expectations)
  - Shift+wheel for horizontal panning
  - Ctrl/Cmd+wheel for zooming
- Implement smooth keyboard panning with arrow keys
  - Continuous movement with acceleration (1.05x up to 25px/frame)
  - 8-way diagonal movement support (hold multiple arrow keys)
  - Proper velocity normalization for consistent diagonal speed
- Remap zoom controls to PageUp/PageDown keys
- Add new `useKeyboardPanning` hook for advanced keyboard navigation
- Refactor and improve test coverage (27 tests passing)
- Fix TypeScript build errors in test files

## 0.5.0
- Add right-click context menu for diagram panel with copy and export options
- Add keyboard shortcuts 'i' and 's' for quick copy image and copy source operations
- Update hotkey modal to display new copy shortcuts

## 0.4.1
- Fix Ctrl/Cmd+A to only select text in Monaco editor when focused
- Prevent Ctrl/Cmd+A from selecting entire page content
- Improve keyboard shortcut handling for better editor experience

## 0.4.0
- Add "/" hotkey to focus search in history panel
- Remove one-click install badges (moved to documentation)

## 0.3.6
- Add keyboard shortcuts for jumping between diagram groups (Ctrl/Cmd + Up/Down)
- Improve keyboard navigation within diagram history

## 0.3.5
- Update documentation and screenshots to latest version
- Improve README clarity

## 0.3.4
- Add Ctrl/Cmd + number key navigation shortcuts to quickly jump to specific diagrams
- Remove deprecated WebSocket code
- Simplify HTTP server shutdown logic
- Improve multi-client support documentation

## 0.3.3
- Refactor data model and history components
- Update diagram history sorting to use lastEdited timestamp
- Add keyboard navigation support throughout the app
- Improve UI focus states and accessibility
- Add experimental drawing canvas feature (behind feature flag)

## 0.3.2
- Add auto-save functionality for diagram content
- Add multiple export formats (SVG, PNG, PDF) to diagram history
- Update data path configuration and terminology
- Refactor UI components for improved usability

## 0.3.1
- Add anonymous usage analytics with PostHog (opt-out available)
- Add title editing functionality for diagrams
- Add URL-based diagram navigation support
- Improve diagram loading and state management

## 0.3.0
- Major architecture refactor to React Context API for state management
- Refactor components into modular, reusable pieces
- Add custom hooks (usePanZoom, useWebSocket) for better code organization
- Improve panel resizing and layout management
- Fix various UI bugs and improve overall stability

## 0.2.10
- Line number and mermaid syntax highlighting in the editor

# 0.2.9
- Actually fix the MaxListeners warning bug

# 0.2.8
- Fix MaxListeners warning bug

# 0.2.7
- Auto-open new browser tab if existing tabs are hidden

# 0.2.6
- Replace Winston with custom logger that uses MCP's sendLoggingMessage API
- Suppress npm warnings that were corrupting JSON-RPC communication

# 0.2.5
- Update engines requirement to nodejs 20.0.0
- README.md cleanup

# 0.2.4
- New color scheme
- README.md cleanup

# 0.2.3
- Fix bug when run from npm package

# 0.2.2
- Fix port assignment bug

# 0.2.1
- Now supports running mindpilot MCP from multiple concurrent MCP hosts
- Light and dark mode UI cleanup
- Editor panel cleanup
- Default to closed editor on first use
