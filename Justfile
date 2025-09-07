set shell := ["bash", "-euxo", "pipefail", "-c"]

# Defaults
port := "4000"
dev_port := "4001"
log_file := "/tmp/mindpilot-http.log"
server_js := "{{ justfile_directory() }}/dist/http/server.js"
dev_http_log := "/tmp/mindpilot-http-dev.log"
vite_log := "/tmp/mindpilot-vite.log"
dev_http_pid := "/tmp/mindpilot-http-dev.pid"
vite_pid := "/tmp/mindpilot-vite.pid"

help:
  @echo "Usage:"
  @echo "  just restart                  # Stop any running instances and start local HTTP server"
  @echo "  just start                    # Start local HTTP server"
  @echo "  just stop                     # Stop HTTP/MCP processes"
  @echo "  just status                   # Show processes listening on port and related nodes"
  @echo "  just logs                     # Tail server log"
  @echo "  just build                    # Build client + server (npm run build)"
  @echo "  just dev                      # Start dev HTTP (:4001) + Vite (:5173)"
  @echo "  just dev-stop                 # Stop dev HTTP + Vite"

build:
  npm run build

# Start the local HTTP server from dist/
start:
  if [ ! -f "{{server_js}}" ]; then \
    echo "dist HTTP server missing, building..."; \
    npm run build; \
  fi
  echo "Starting HTTP server on :{{port}} -> {{server_js}}";
  nohup node "{{server_js}}" --port "{{port}}" --disable-analytics >> "{{log_file}}" 2>&1 & echo $! > /tmp/mindpilot-http.pid
  sleep 0.5
  echo "Started. Log: {{log_file}}"

# Stop any running HTTP/MCP processes that could conflict
stop:
  # Stop process started via this Justfile (if recorded)
  if [ -f /tmp/mindpilot-http.pid ]; then \
    kill $(cat /tmp/mindpilot-http.pid) 2>/dev/null || true; \
    rm -f /tmp/mindpilot-http.pid; \
  fi
  # Kill npx-installed mindpilot MCP wrappers (if any)
  pkill -f '/\.npm/_npx/.*/node_modules/.bin/mindpilot-mcp' 2>/dev/null || true
  # Kill npx-installed HTTP server (global @mindpilot/mcp)
  pkill -f '@mindpilot/mcp/dist/http/server.js' 2>/dev/null || true
  # Kill local repo HTTP/MCP servers
  pkill -f '/programming/mindpilot-mcp/dist/http/server.js' 2>/dev/null || true
  pkill -f '/programming/mindpilot-mcp/dist/mcp/server.js' 2>/dev/null || true
  # As a last resort, kill whatever is bound to the port (if ss is available)
  if command -v ss >/dev/null 2>&1; then \
    PIDS=$(ss -ltnp 2>/dev/null | awk '$4 ~ /:{{port}}$/ { for (i=1;i<=NF;i++) if ($i ~ /pid=/) { match($i, /pid=([0-9]+)/, a); if (a[1]) print a[1] } }' | sort -u); \
    if [ -n "$PIDS" ]; then echo "$PIDS" | xargs -r kill -9 || true; fi; \
  fi
  echo "Stopped anything resembling mindpilot servers."

# Restart = stop, then start
restart:
  just stop
  just start

# Show current process and port usage
status:
  echo "Processes bound to :{{port}}:";
  if command -v ss >/dev/null 2>&1; then ss -ltnp | grep -E ":{{port}}\b" || true; fi
  echo
  echo "Relevant Node processes:";
  ps -ef | grep -E "/mindpilot-mcp/dist/(http|mcp)/server\.js|@mindpilot/mcp/dist/http/server\.js|mindpilot-mcp" | grep -v grep || true

# Tail logs
logs:
  test -f "{{log_file}}" || { echo "No log at {{log_file}} yet"; exit 1; }
  tail -n 200 -f "{{log_file}}"

# Start development servers in background with logs
dev:
  echo "Starting dev HTTP server on :{{dev_port}} (tsx) -> src/http/server.ts";
  nohup env NODE_ENV=development tsx "{{justfile_directory()}}/src/http/server.ts" --port "{{dev_port}}" >> "{{dev_http_log}}" 2>&1 & echo $! > "{{dev_http_pid}}"
  sleep 0.5
  echo "Starting Vite dev server on :5173 -> src/client";
  cd "{{justfile_directory()}}/src/client" && nohup env MINDPILOT_API_PORT={{dev_port}} vite >> "{{vite_log}}" 2>&1 & echo $! > "{{vite_pid}}"
  echo "Dev servers started. Logs: HTTP={{dev_http_log}} Vite={{vite_log}}"

# Stop development servers
dev-stop:
  # Stop via recorded PIDs first
  if [ -f "{{dev_http_pid}}" ]; then kill $(cat "{{dev_http_pid}}") 2>/dev/null || true; rm -f "{{dev_http_pid}}"; fi
  if [ -f "{{vite_pid}}" ]; then kill $(cat "{{vite_pid}}") 2>/dev/null || true; rm -f "{{vite_pid}}"; fi
  # Fallback: kill by patterns and ports
  pkill -f 'tsx .*src/http/server\.ts' 2>/dev/null || true
  pkill -f '/src/client.*vite' 2>/dev/null || true
  if command -v ss >/dev/null 2>&1; then \
    PIDS=$(ss -ltnp 2>/dev/null | awk '$4 ~ /:5173$/ { for (i=1;i<=NF;i++) if ($i ~ /pid=/) { match($i, /pid=([0-9]+)/, a); if (a[1]) print a[1] } }' | sort -u); \
    if [ -n "$PIDS" ]; then echo "$PIDS" | xargs -r kill -9 || true; fi; \
  fi
  if command -v ss >/dev/null 2>&1; then \
    PIDS=$(ss -ltnp 2>/dev/null | awk '$4 ~ /:{{dev_port}}$/ { for (i=1;i<=NF;i++) if ($i ~ /pid=/) { match($i, /pid=([0-9]+)/, a); if (a[1]) print a[1] } }' | sort -u); \
    if [ -n "$PIDS" ]; then echo "$PIDS" | xargs -r kill -9 || true; fi; \
  fi
  echo "Stopped dev HTTP and Vite"
