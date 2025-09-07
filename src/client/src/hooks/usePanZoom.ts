import { useState, useRef, useEffect, useCallback, RefObject, MouseEvent } from 'react';

export interface PanZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  zoomSensitivity?: {
    trackpad?: number;
    mouse?: number;
  };
  fitPadding?: number;
  enablePan?: boolean;
  enableZoom?: boolean;
}

export interface PanZoomState {
  zoom: number;
  pan: { x: number; y: number };
  isPanning: boolean;
  isZooming: boolean;
  hasManuallyZoomed: boolean;
}

export interface PanZoomHandlers {
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  handleFitToScreen: (isAutoResize?: boolean) => void;
  handleKeyPan: (dx: number, dy: number) => void;
  handleMouseDown: (e: MouseEvent) => void;
  handleMouseMove: (e: MouseEvent) => void;
  handleMouseUp: () => void;
  handleMouseLeave: () => void;
  setHasManuallyZoomed: (value: boolean) => void;
}

const defaultOptions: Required<PanZoomOptions> = {
  minZoom: 0.1,
  maxZoom: 5,
  zoomStep: 1.2,
  zoomSensitivity: {
    trackpad: 0.01,
    mouse: 0.02,
  },
  fitPadding: 40,
  enablePan: true,
  enableZoom: true,
};

export function usePanZoom(
  containerRef: RefObject<HTMLElement>,
  contentRef: RefObject<HTMLElement>,
  options: PanZoomOptions = {}
): PanZoomState & PanZoomHandlers {
  const opts = { ...defaultOptions, ...options };
  
  // State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [hasManuallyZoomed, setHasManuallyZoomed] = useState(false);
  
  // Refs
  const startPanRef = useRef({ x: 0, y: 0 });
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    if (!opts.enableZoom) return;
    setZoom((prev) => Math.min(prev * opts.zoomStep, opts.maxZoom));
    setHasManuallyZoomed(true);
  }, [opts.enableZoom, opts.zoomStep, opts.maxZoom]);

  const handleZoomOut = useCallback(() => {
    if (!opts.enableZoom) return;
    setZoom((prev) => Math.max(prev / opts.zoomStep, opts.minZoom));
    setHasManuallyZoomed(true);
  }, [opts.enableZoom, opts.zoomStep, opts.minZoom]);

  const handleZoomReset = useCallback(() => {
    if (!opts.enableZoom) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHasManuallyZoomed(true);
  }, [opts.enableZoom]);

  const handleFitToScreen = useCallback((isAutoResize = false) => {
    const svgElement = contentRef.current?.querySelector('svg');
    const container = containerRef.current;

    if (!svgElement || !container) return;

    // Get SVG's natural dimensions
    let svgWidth = svgElement.viewBox.baseVal.width || svgElement.width.baseVal.value;
    let svgHeight = svgElement.viewBox.baseVal.height || svgElement.height.baseVal.value;

    // If no viewBox, try to get from the rendered size
    if (!svgWidth || !svgHeight) {
      const bbox = svgElement.getBBox();
      svgWidth = bbox.width;
      svgHeight = bbox.height;
    }

    const containerRect = container.getBoundingClientRect();

    // Calculate scale to fit within container with padding
    const scaleX = (containerRect.width - opts.fitPadding * 2) / svgWidth;
    const scaleY = (containerRect.height - opts.fitPadding * 2) / svgHeight;
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
  }, [containerRef, contentRef, opts.fitPadding]);

  // Mouse handlers for panning
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!opts.enablePan || e.button !== 0) return; // Only left click
    
    setIsPanning(true);
    startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    e.preventDefault();
  }, [opts.enablePan, pan]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning || !opts.enablePan) return;
    
    setPan({
      x: e.clientX - startPanRef.current.x,
      y: e.clientY - startPanRef.current.y,
    });
  }, [isPanning, opts.enablePan]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Keyboard-based panning handler (dx, dy in pixels)
  const handleKeyPan = useCallback((dx: number, dy: number) => {
    if (!opts.enablePan) return;
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, [opts.enablePan]);

  // Wheel handler for zoom and pan
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Check if Shift is held for pan mode, or Ctrl/Cmd for zoom
      const isPanMode = e.shiftKey || (!e.ctrlKey && !e.metaKey);
      
      if (isPanMode && opts.enablePan) {
        // Pan mode: Shift+wheel for horizontal, regular wheel for vertical
        const panSpeed = 1.5; // Adjust for responsiveness
        
        if (e.shiftKey) {
          // Horizontal panning with Shift+wheel
          setPan((prev) => ({
            x: prev.x - e.deltaY * panSpeed,
            y: prev.y
          }));
        } else {
          // Regular scrolling: vertical pan (deltaY) and horizontal pan (deltaX for trackpads)
          setPan((prev) => ({
            x: prev.x - e.deltaX * panSpeed,
            y: prev.y - e.deltaY * panSpeed
          }));
        }
      } else if (opts.enableZoom) {
        // Zoom mode with Ctrl/Cmd+wheel
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

        // Detect if using trackpad vs mouse wheel
        const isTrackpad = Math.abs(e.deltaY) < 50;
        const sensitivity = isTrackpad 
          ? opts.zoomSensitivity.trackpad! 
          : opts.zoomSensitivity.mouse!;

        // Apply logarithmic scaling for natural feel
        const zoomFactor = Math.exp(-e.deltaY * sensitivity);
        const newZoom = Math.min(Math.max(zoom * zoomFactor, opts.minZoom), opts.maxZoom);

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
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
    };
  }, [containerRef, zoom, pan, opts]);

  return {
    // State
    zoom,
    pan,
    isPanning,
    isZooming,
    hasManuallyZoomed,
    // Handlers
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleFitToScreen,
    handleKeyPan,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    setHasManuallyZoomed,
  };
}
