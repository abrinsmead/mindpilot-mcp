import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import mermaid from "mermaid";
import { MCPServerStatus } from "@/components/MCPServerStatus";
import { Branding } from "@/components/Branding";
import { FloatingConnectionStatus } from "@/components/FloatingConnectionStatus";
import { ZoomControls } from "@/components/ZoomControls";
import { TopRightToolBar } from "@/components/TopRightToolBar";
import { useWebSocketStateMachine } from "@/hooks/useWebSocketStateMachine";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
  flowchart: {
    useMaxWidth: false,
    htmlLabels: true,
  },
});

function App() {
  const [diagram, setDiagram] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("mindpilot-mcp-dark-mode");
    return saved === "true";
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("mindpilot-mcp-panel-collapsed");
    return saved === "true";
  });
  const [panelSize, setPanelSize] = useState(() => {
    const saved = localStorage.getItem("mindpilot-mcp-panel-size");
    return saved ? parseFloat(saved) : 50;
  });
  const [status, setStatus] = useState("Ready");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [hasManuallyZoomed, setHasManuallyZoomed] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<any>(null);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection setup - memoize to prevent re-calculation
  const wsUrl = useMemo(() => {
    const currentPort = window.location.port;
    const isDev = currentPort === "5173";

    // In dev mode, always connect to port 4000 (MCP server)
    // In production, use the same port as the page
    const url = isDev
      ? `ws://${window.location.hostname}:4000/ws`
      : `ws://${window.location.hostname}:${window.location.port}/ws`;

    console.log('[WebSocket Setup]', {
      isDev,
      currentPort,
      hostname: window.location.hostname,
      wsUrl: url,
      fullUrl: window.location.href,
      note: isDev ? 'Dev mode - connecting to MCP server on port 4000' : 'Production mode - using same port'
    });

    return url;
  }, []); // Empty deps - URL shouldn't change during the session

  const { state, reconnect } = useWebSocketStateMachine({
    url: wsUrl,
    onMessage: (data) => {
      console.log('[WebSocket Message]', data);
      if (data.type === "render_result" && data.diagram) {
        console.log("Updating diagram from WebSocket broadcast");
        setDiagram(data.diagram);
        setStatus("Rendered successfully (via broadcast)");

        // Reset view to fit new diagram
        setHasManuallyZoomed(false);
        // Small delay to allow diagram to render before fitting
        setTimeout(() => {
          handleFitToScreen(true);
        }, 100);
      }
    },
  });

  // Map state machine states to UI status messages
  const connectionStatus = (() => {
    switch (state) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'reconnecting': return 'Reconnecting...';
      case 'failed': return 'Disconnected';
      case 'disconnected': return 'Disconnected';
      default: return 'Disconnected';
    }
  })();

  // Cleanup zoom timeout on unmount
  useEffect(() => {
    return () => {
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
    };
  }, []);

  // Render diagram
  useEffect(() => {
    if (!previewRef.current) return;

    const renderDiagram = async () => {
      try {
        // Clear previous content
        previewRef.current!.innerHTML = "";

        // Skip rendering if diagram is empty or null
        if (!diagram || diagram.trim() === "") {
          return;
        }

        // Update theme
        mermaid.initialize({
          startOnLoad: false,
          theme: isDarkMode ? "dark" : "default",
          securityLevel: "loose",
          suppressErrorRendering: true,
          flowchart: {
            useMaxWidth: false,
            htmlLabels: true,
          },
        });

        // Generate unique ID
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Render the diagram
        const { svg } = await mermaid.render(id, diagram);
        previewRef.current!.innerHTML = svg;

        // Reset pan when diagram changes and reset manual zoom flag
        setPan({ x: 0, y: 0 });
        setHasManuallyZoomed(false);

        setStatus("Rendered successfully");
      } catch (error: any) {
        previewRef.current!.innerHTML = `<div class="text-red-500 p-4">Error: ${error.message}</div>`;
        setStatus("Render error");
      }
    };

    const timeoutId = setTimeout(renderDiagram, 500);
    return () => clearTimeout(timeoutId);
  }, [diagram, isDarkMode]);

  const handleExport = () => {
    const svg = previewRef.current?.querySelector("svg");
    if (!svg) {
      setStatus("No diagram to export");
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "mermaid-diagram.svg";
    a.click();

    URL.revokeObjectURL(url);
    setStatus("SVG exported");
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.2, 5));
    setHasManuallyZoomed(true);
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.2, 0.1));
    setHasManuallyZoomed(true);
  };

  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHasManuallyZoomed(true);
  };

  const handleFitToScreen = (isAutoResize = false) => {
    const svgElement = previewRef.current?.querySelector("svg");
    const container = containerRef.current;

    if (svgElement && container) {
      // Get SVG's natural dimensions from viewBox or width/height attributes
      let svgWidth =
        svgElement.viewBox.baseVal.width || svgElement.width.baseVal.value;
      let svgHeight =
        svgElement.viewBox.baseVal.height || svgElement.height.baseVal.value;

      // If no viewBox, try to get from the rendered size
      if (!svgWidth || !svgHeight) {
        const bbox = svgElement.getBBox();
        svgWidth = bbox.width;
        svgHeight = bbox.height;
      }

      const containerRect = container.getBoundingClientRect();

      // Calculate scale to fit within container with padding
      const padding = 40;
      const scaleX = (containerRect.width - padding * 2) / svgWidth;
      const scaleY = (containerRect.height - padding * 2) / svgHeight;
      const fitScale = Math.min(scaleX, scaleY);

      // Apply the scale if valid
      if (fitScale > 0 && isFinite(fitScale)) {
        setZoom(fitScale);
        setPan({ x: 0, y: 0 });
        // Mark as manual zoom if triggered by button click
        if (!isAutoResize) {
          setHasManuallyZoomed(true);
        }
      }
    }
  };

  // Mouse handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left click
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Apply dark mode class to body and save to localStorage
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("mindpilot-mcp-dark-mode", isDarkMode.toString());
  }, [isDarkMode]);

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem("mindpilot-mcp-panel-collapsed", isCollapsed.toString());
  }, [isCollapsed]);

  // Apply initial collapsed state
  useEffect(() => {
    if (isCollapsed && panelRef.current?.collapse) {
      panelRef.current.collapse();
    }
  }, []);

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current) return;

    let timeoutId: NodeJS.Timeout;
    const resizeObserver = new ResizeObserver(() => {
      // Debounce the fit calculation
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Always fit on resize unless user has manually zoomed
        if (!hasManuallyZoomed) {
          handleFitToScreen(true);
        }
      }, 300);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [hasManuallyZoomed]); // Re-setup when manual zoom state changes

  // Keyboard shortcuts and prevent browser zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser zoom
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")
      ) {
        e.preventDefault();

        // Only handle our zoom if not in textarea
        if (!(e.target instanceof HTMLTextAreaElement)) {
          switch (e.key) {
            case "+":
            case "=":
              handleZoomIn();
              break;
            case "-":
              handleZoomOut();
              break;
            case "0":
              handleZoomReset();
              break;
          }
        }
      }
    };

    // Prevent browser zoom via mouse wheel
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Attach wheel handler to preview container with passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContainerWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Set zooming state to disable transitions
      setIsZooming(true);

      // Clear existing timeout
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }

      // Reset zooming state after wheel events stop
      zoomTimeoutRef.current = setTimeout(() => {
        setIsZooming(false);
      }, 150);

      // More natural zoom with logarithmic scaling
      // Detect if using trackpad (smaller delta values) vs mouse wheel (larger, discrete values)
      const isTrackpad = Math.abs(e.deltaY) < 50;
      const zoomSensitivity = isTrackpad ? 0.01 : 0.02; // Balanced sensitivity

      const deltaY = e.deltaY;

      // Apply logarithmic scaling for more natural feel
      const zoomFactor = Math.exp(-deltaY * zoomSensitivity);
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.1), 5);

      // Zoom towards mouse position
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate the point in diagram space (before zoom)
      const pointX = (x - rect.width / 2 - pan.x) / zoom;
      const pointY = (y - rect.height / 2 - pan.y) / zoom;

      // Calculate new pan to keep the same point under the mouse
      setPan({
        x: x - rect.width / 2 - pointX * newZoom,
        y: y - rect.height / 2 - pointY * newZoom,
      });

      setZoom(newZoom);
      setHasManuallyZoomed(true);
    };

    container.addEventListener('wheel', handleContainerWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleContainerWheel);
    };
  }, [zoom, pan]);

  return (
    <div
      className={`h-screen w-screen flex flex-col ${isDarkMode ? "bg-gray-900" : "bg-neutral-900"}`}
    >
      <ResizablePanelGroup direction="horizontal" className="flex-1 relative">
        {isCollapsed && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              panelRef.current?.expand();
            }}
            className="absolute z-10 top-4 left-4"
            title="Show editor"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        <ResizablePanel
          ref={panelRef}
          defaultSize={panelSize}
          minSize={20}
          maxSize={80}
          collapsible={true}
          collapsedSize={0}
          onResize={(size) => {
            if (size > 0) {
              setPanelSize(size);
              localStorage.setItem("mindpilot-mcp-panel-size", size.toString());
            }
          }}
          onCollapse={() => {
            setIsCollapsed(true);
            // Fit to screen when editor is collapsed
            setTimeout(() => {
              if (!hasManuallyZoomed) {
                handleFitToScreen(true);
              } else {
                // Reset manual zoom flag on panel state change
                setHasManuallyZoomed(false);
              }
            }, 300);
          }}
          onExpand={() => {
            setIsCollapsed(false);
            // Fit to screen when editor is expanded
            setTimeout(() => {
              if (!hasManuallyZoomed) {
                handleFitToScreen(true);
              } else {
                // Reset manual zoom flag on panel state change
                setHasManuallyZoomed(false);
              }
            }, 300);
          }}
        >
          {/* panel status bar */}
          <div
            className={`h-full flex flex-col relative ${isCollapsed ? "" : isDarkMode ? "bg-gray-800" : "bg-neutral-200"}`}
          >
            {!isCollapsed && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    panelRef.current?.collapse();
                  }}
                  className="absolute z-10 top-4 left-4"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <textarea
                  className={`flex-1 p-4 pl-[70px] font-mono text-sm resize-none focus:outline-none ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-neutral-200"}`}
                  value={diagram}
                  onChange={(e) => setDiagram(e.target.value)}
                  placeholder=""
                />
                <div
                  className={`p-2 text-xs border-t flex justify-between items-center ${isDarkMode ? "text-gray-400 border-gray-700" : "text-muted-foreground border-gray-300"}`}
                >
                  <MCPServerStatus
                    connectionStatus={connectionStatus}
                    onReconnect={reconnect}
                    isDarkMode={isDarkMode}
                    isCollapsedView={false}
                  />
                  <span>{status}</span>
                </div>
              </>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle className="bg-gray-300 dark:bg-gray-700" />

        <ResizablePanel defaultSize={50}>
          <div
            className={`h-full flex flex-col relative ${isDarkMode ? "bg-gray-800" : "bg-neutral-100"}`}
          >
            {/* Zoom Controls */}
            <ZoomControls
              zoom={zoom}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onZoomReset={handleZoomReset}
              onFitToScreen={() => handleFitToScreen()}
            />

            <div
              ref={containerRef}
              className={`flex-1 overflow-hidden relative ${isDarkMode ? "bg-gray-850" : ""}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              // onWheel handler moved to useEffect with passive: false
              style={{ cursor: isPanning ? "grabbing" : "grab" }}
            >
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center",
                  transition:
                    isPanning || isZooming ? "none" : "transform 0.1s ease-out",
                }}
              >
                <div
                  ref={previewRef}
                  className="[&>svg]:!max-width-none [&>svg]:!max-height-none"
                />
              </div>


            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Download and Dark Mode */}
      <TopRightToolBar
        isDarkMode={isDarkMode}
        onExport={handleExport}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />


      {/* MCP Server Status in bottom left when panel is collapsed */}
      <FloatingConnectionStatus
        isVisible={isCollapsed}
        connectionStatus={connectionStatus}
        onReconnect={reconnect}
        isDarkMode={isDarkMode}
      />

      { /* Mindpilot Logo */}
      <Branding />

    </div>
  );
}

export default App;
