import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { useDiagramContext, useThemeContext } from "@/contexts";
import { HistoryPanel, HistoryPanelRef } from "@/components/HistoryPanel";
import { ZoomControls, HotkeyModal, AppLayout } from "@/components/layout";
import { DiagramRenderer, PanZoomContainer, DiagramTitle, MermaidEditor, MermaidEditorHandle, DrawingCanvas } from "@/components/diagram";
import { useLocalStorageBoolean, useLocalStorageNumber } from "@/hooks/useLocalStorage";
import { useKeyboardShortcuts, usePreventBrowserZoom, KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";
import { usePanZoom } from "@/hooks/usePanZoom";
import { useKeyboardPanning } from "@/hooks/useKeyboardPanning";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useFeatureFlag } from "@/hooks/useQueryParam";
import { useExportDiagram } from "@/hooks";


export function App() {
  // Get state from contexts
  const { diagram, setDiagram, setTitle, title, collection, setCollection, currentDiagramId, setCurrentDiagramId, loadDiagramById, status, setStatus } = useDiagramContext();
  const { isDarkMode, toggleTheme } = useThemeContext();
  const { trackThemeChanged, trackPanelToggled } = useAnalytics();
  const isPenToolEnabled = useFeatureFlag('xMarker'); // Pen tool enabled with ?xMarker=1
  const { copyImageToClipboard } = useExportDiagram({ isDarkMode });

  // LocalStorage-backed state for UI preferences
  const [isEditCollapsed, setIsEditCollapsed] = useLocalStorageBoolean("mindpilot-mcp-edit-collapsed", true);
  const [editPanelSize, setEditPanelSize] = useLocalStorageNumber("mindpilot-mcp-edit-panel-size", 30);

  const [isHistoryCollapsed, setIsHistoryCollapsed] = useLocalStorageBoolean("mindpilot-mcp-history-collapsed", false);
  const [historyPanelSize, setHistoryPanelSize] = useLocalStorageNumber("mindpilot-mcp-history-panel-size", 20);
  const [showHotkeyModal, setShowHotkeyModal] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [orderedDiagramIds, setOrderedDiagramIds] = useState<string[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [clearDrawingTrigger, setClearDrawingTrigger] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editPanelRef = useRef<any>(null);
  const historyPanelRef = useRef<any>(null);
  const historyPanelMethodsRef = useRef<HistoryPanelRef>(null);
  const editorRef = useRef<MermaidEditorHandle>(null);
  const saveDiagramTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use the pan/zoom hook
  const {
    zoom,
    pan,
    isPanning,
    isZooming,
    hasManuallyZoomed,
    handleZoomIn,
    handleZoomOut,
    handleFitToScreen,
    handleKeyPan,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    setHasManuallyZoomed,
  } = usePanZoom(containerRef, previewRef);

  // Use smooth keyboard panning
  useKeyboardPanning(handleKeyPan, {
    isEnabled: !isEditorFocused && !isRenaming,
    panSpeed: 8,
    accelerationFactor: 1.05,
    maxSpeed: 25
  });

  // Shared state for forcing history refresh
  const [historyRefreshTrigger] = useState(0);

  // Handle title change from diagram title component
  const handleTitleChange = useCallback(async (newTitle: string) => {
    setTitle(newTitle);

    // If we have a current diagram ID, also save to server
    if (currentDiagramId) {
      try {
        await fetch(`/api/history/${currentDiagramId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: newTitle }),
        });

        // Don't refresh history - the history panel will update its local state
        // when it receives the title change via onCurrentDiagramTitleChange
      } catch (error) {
        console.error('Failed to update diagram title:', error);
      }
    }
  }, [setTitle, currentDiagramId]);

  // Handle diagram content change with auto-save
  const handleDiagramChange = useCallback((newDiagram: string) => {
    setDiagram(newDiagram);
    
    // If we have a current diagram ID, save the content after a delay
    if (currentDiagramId && newDiagram.trim()) {
      // Debounce the save operation
      if (saveDiagramTimeoutRef.current) {
        clearTimeout(saveDiagramTimeoutRef.current);
      }
      
      saveDiagramTimeoutRef.current = setTimeout(async () => {
        try {
          setStatus('Saving...');
          await fetch(`/api/history/${currentDiagramId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ diagram: newDiagram }),
          });
          console.log('[App] Saved diagram content for ID:', currentDiagramId);
          setStatus('Saved');
          // Clear saved status after 2 seconds
          setTimeout(() => setStatus('Ready'), 2000);
        } catch (error) {
          console.error('Failed to update diagram content:', error);
          setStatus('Save failed');
        }
      }, 2000); // Save after 2 seconds of inactivity
    }
  }, [setDiagram, currentDiagramId, setStatus]);

  // Parse URL to get initial diagram ID
  const getInitialDiagramId = () => {
    const pathMatch = window.location.pathname.match(/^\/artifacts\/([a-zA-Z0-9-]+)$/);
    return pathMatch ? pathMatch[1] : null;
  };
  
  const [urlDiagramId] = useState(getInitialDiagramId);

  // Handle showHotkeyModal event
  useEffect(() => {
    const handleShowHotkeyModal = () => {
      setShowHotkeyModal(true);
    };

    window.addEventListener('showHotkeyModal', handleShowHotkeyModal);
    return () => {
      window.removeEventListener('showHotkeyModal', handleShowHotkeyModal);
    };
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const pathMatch = window.location.pathname.match(/^\/artifacts\/([a-zA-Z0-9-]+)$/);

      if (pathMatch && pathMatch[1]) {
        const diagramId = pathMatch[1];
        if (diagramId !== currentDiagramId) {
          loadDiagramById(diagramId);
        }
      } else if (window.location.pathname === '/' && currentDiagramId) {
        // Clear selection when navigating to root
        setCurrentDiagramId(null);
        setDiagram('');
        setTitle('');
        setCollection(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentDiagramId, loadDiagramById, setCurrentDiagramId, setDiagram, setTitle, setCollection]);

  // Update URL when diagram selection changes
  const updateUrlForDiagram = useCallback((diagramId: string | null) => {
    const pathMatch = window.location.pathname.match(/^\/artifacts\/([a-zA-Z0-9-]+)$/);
    const currentUrlId = pathMatch ? pathMatch[1] : null;

    if (diagramId && diagramId !== currentUrlId) {
      window.history.pushState({}, '', `/artifacts/${diagramId}`);
    } else if (!diagramId && window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
  }, []);

  // Modified handleSelectDiagram to update URL
  const handleSelectDiagram = useCallback((diagramId: string) => {
    loadDiagramById(diagramId);
    updateUrlForDiagram(diagramId);
  }, [loadDiagramById, updateUrlForDiagram]);

  // Navigation between diagrams
  const navigateToNextDiagram = useCallback(() => {
    if (!currentDiagramId || orderedDiagramIds.length === 0) return;
    
    const currentIndex = orderedDiagramIds.indexOf(currentDiagramId);
    if (currentIndex === -1) return;
    
    // Blur any currently focused element to remove focus rings
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    // Move to next diagram, wrap around to beginning
    const nextIndex = (currentIndex + 1) % orderedDiagramIds.length;
    const nextDiagramId = orderedDiagramIds[nextIndex];
    
    handleSelectDiagram(nextDiagramId);
  }, [currentDiagramId, orderedDiagramIds, handleSelectDiagram]);

  const navigateToPreviousDiagram = useCallback(() => {
    if (!currentDiagramId || orderedDiagramIds.length === 0) return;
    
    const currentIndex = orderedDiagramIds.indexOf(currentDiagramId);
    if (currentIndex === -1) return;
    
    // Blur any currently focused element to remove focus rings
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    // Move to previous diagram, wrap around to end
    const prevIndex = currentIndex === 0 ? orderedDiagramIds.length - 1 : currentIndex - 1;
    const prevDiagramId = orderedDiagramIds[prevIndex];
    
    handleSelectDiagram(prevDiagramId);
  }, [currentDiagramId, orderedDiagramIds, handleSelectDiagram]);

  // Copy functions for keyboard shortcuts
  const handleCopyImage = useCallback(async () => {
    if (!diagram) return;
    await copyImageToClipboard(diagram, title || 'diagram');
  }, [diagram, title, copyImageToClipboard]);

  const handleCopySource = useCallback(async () => {
    if (!diagram) return;
    try {
      await navigator.clipboard.writeText(diagram);
      console.log('Source copied to clipboard');
    } catch (err) {
      console.error('Failed to copy source:', err);
      // Fallback: Select and copy text
      const textarea = document.createElement('textarea');
      textarea.value = diagram;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }, [diagram]);

  // Keyboard shortcuts
  const shortcuts = useMemo<KeyboardShortcut[]>(() => {
    const baseShortcuts: KeyboardShortcut[] = [
      // Prevent Ctrl/Cmd+A from selecting all page elements (except in Monaco editor)
      {
        key: 'a',
        ctrl: true,
        description: 'Select all (editor only)',
        preventDefault: true,
        isEnabled: () => !isEditorFocused, // Only prevent when editor is NOT focused
        handler: () => {
          // Do nothing - just prevent the default browser select all
        }
      },
      // Search focus
      {
        key: '/',
        description: 'Focus search bar',
        ignoreInputElements: true,
        isEnabled: () => !isEditorFocused && !isRenaming,
        handler: () => {
          historyPanelMethodsRef.current?.focusSearch();
        }
      },
      // Mode toggle
      {
        key: 'd',
        description: 'Toggle dark/light mode',
        ignoreInputElements: true,
        isEnabled: () => !isEditorFocused && !isRenaming,
        handler: () => {
          toggleTheme();
          trackThemeChanged({ theme: isDarkMode ? 'light' : 'dark' });
        }
      },
      // Panel toggles
      {
        key: 'h',
        description: 'Toggle history panel',
        ignoreInputElements: true,
        isEnabled: () => !isEditorFocused && !isRenaming,
        handler: () => {
          if (isHistoryCollapsed) {
            historyPanelRef.current?.expand();
          } else {
            historyPanelRef.current?.collapse();
          }
        }
      },
      {
        key: 'e',
        description: 'Toggle editor panel',
        ignoreInputElements: true,
        isEnabled: () => !isEditorFocused && !isRenaming,
        handler: () => {
          if (isEditCollapsed) {
            editPanelRef.current?.expand();
          } else {
            editPanelRef.current?.collapse();
          }
        }
      },
      // Copy shortcuts
      {
        key: 'i',
        description: 'Copy image to clipboard',
        ignoreInputElements: true,
        preventDefault: true,
        isEnabled: () => !isEditorFocused && !isRenaming && !!diagram,
        handler: () => handleCopyImage()
      },
      {
        key: 's',
        description: 'Copy source to clipboard',
        ignoreInputElements: true,
        preventDefault: true,
        isEnabled: () => !isEditorFocused && !isRenaming && !!diagram,
        handler: () => handleCopySource()
      },
      // Zoom controls (using PageUp/PageDown)
      {
        key: 'PageUp',
        description: 'Zoom in',
        ignoreInputElements: true,
        isEnabled: () => !isEditorFocused && !isRenaming,
        handler: () => handleZoomIn()
      },
      {
        key: 'PageDown',
        description: 'Zoom out',
        ignoreInputElements: true,
        isEnabled: () => !isEditorFocused && !isRenaming,
        handler: () => handleZoomOut()
      },
      // Pan controls are now handled by useKeyboardPanning hook for smooth movement
      {
        key: 'f',
        description: 'Fit to screen',
        ignoreInputElements: true,
        isEnabled: () => !isEditorFocused && !isRenaming,
        handler: () => handleFitToScreen()
      },
      // Drawing (only if feature flag is enabled)
      ...(isPenToolEnabled ? [{
        key: 'p',
        description: 'Toggle pen/drawing mode',
        ignoreInputElements: true,
        isEnabled: () => !isEditorFocused && !isRenaming,
        handler: () => setIsDrawingMode(!isDrawingMode)
      }] : []),
      // Navigation (Ctrl/Cmd + ArrowLeft/ArrowRight)
      {
        key: 'ArrowLeft',
        ctrl: true,
        description: 'Previous diagram',
        ignoreInputElements: true,
        isEnabled: () => !isEditorFocused && !isRenaming,
        handler: () => navigateToPreviousDiagram()
      },
      {
        key: 'ArrowRight',
        ctrl: true,
        description: 'Next diagram',
        ignoreInputElements: true,
        isEnabled: () => !isEditorFocused && !isRenaming,
        handler: () => navigateToNextDiagram()
      },
      // Help
      {
        key: '?',
        description: 'Show keyboard shortcuts',
        caseSensitive: true,
        handler: () => setShowHotkeyModal(prev => !prev)
      }
    ];
    
    // Add 1-9 shortcuts for jumping to nth diagram in expanded groups
    for (let i = 1; i <= 9; i++) {
      baseShortcuts.push({
        key: String(i),
        description: `Jump to diagram ${i} in expanded group`,
        ignoreInputElements: true,
        isEnabled: () => !isEditorFocused && !isRenaming && !isHistoryCollapsed,
        handler: () => {
          const diagramId = historyPanelMethodsRef.current?.getNthDiagramInExpandedGroups(i);
          if (diagramId) {
            handleSelectDiagram(diagramId);
          }
        }
      });
    }
    
    return baseShortcuts;
  }, [isHistoryCollapsed, isEditCollapsed, isEditorFocused, isRenaming, isDarkMode, toggleTheme, trackThemeChanged, navigateToNextDiagram, navigateToPreviousDiagram, isPenToolEnabled, isDrawingMode, handleSelectDiagram, diagram, handleCopyImage, handleCopySource]);

  useKeyboardShortcuts(shortcuts);
  usePreventBrowserZoom();

  // Create callback for diagram onFitToScreen
  const handleDiagramFitToScreen = useCallback((isAutoResize?: boolean) => {
    if (!isAutoResize) {
      setHasManuallyZoomed(true);
    }
    handleFitToScreen(isAutoResize);
  }, [handleFitToScreen, setHasManuallyZoomed]);

  // History panel content
  const historyPanelContent = (
    <HistoryPanel
      ref={historyPanelMethodsRef}
      onSelectDiagram={handleSelectDiagram}
      isDarkMode={isDarkMode}
      currentDiagramId={currentDiagramId}
      currentDiagramTitle={title}
      onCurrentDiagramTitleChange={setTitle}
      refreshTrigger={historyRefreshTrigger}
      initialDiagramId={urlDiagramId}
      onEditingChange={setIsRenaming}
      onDiagramListChange={setOrderedDiagramIds}
    />
  );

  // Center panel content
  const centerContent = (
    <div className={`h-full flex flex-col relative ${isDarkMode ? "bg-neutral-800" : "bg-neutral-100"}`}>
      <DiagramTitle
        title={title}
        collection={collection}
        isDarkMode={isDarkMode}
        isEditable={true}
        onTitleChange={handleTitleChange}
        onEditingChange={setIsRenaming}
      />

      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToScreen={() => handleFitToScreen()}
        isDarkMode={isDarkMode}
        onToggleTheme={() => {
          toggleTheme();
          trackThemeChanged({ theme: isDarkMode ? 'light' : 'dark' });
        }}
        isDrawingMode={isPenToolEnabled ? isDrawingMode : undefined}
        onToggleDrawing={isPenToolEnabled ? () => setIsDrawingMode(!isDrawingMode) : undefined}
        hasDrawing={isPenToolEnabled ? hasDrawing : false}
        onClearDrawing={isPenToolEnabled ? () => {
          setClearDrawingTrigger(prev => prev + 1);
          setHasDrawing(false);
          setIsDrawingMode(false);
        } : undefined}
      />

      <PanZoomContainer
          ref={containerRef}
          zoom={zoom}
          pan={pan}
          isPanning={isPanning}
          isZooming={isZooming}
          isDrawingMode={isPenToolEnabled && isDrawingMode}
          onMouseDown={isPenToolEnabled && isDrawingMode ? undefined : (e) => {
            // Blur any focused element when clicking on canvas
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            handleMouseDown(e);
          }}
          onMouseMove={isPenToolEnabled && isDrawingMode ? undefined : handleMouseMove}
          onMouseUp={isPenToolEnabled && isDrawingMode ? undefined : handleMouseUp}
          onMouseLeave={isPenToolEnabled && isDrawingMode ? undefined : handleMouseLeave}
        >
          <DiagramRenderer
            ref={previewRef}
            onFitToScreen={handleDiagramFitToScreen}
          />
          {isPenToolEnabled && (
            <DrawingCanvas
              isDrawingMode={isDrawingMode}
              zoom={zoom}
              isDarkMode={isDarkMode}
              clearDrawingTrigger={clearDrawingTrigger}
              onDrawingChange={setHasDrawing}
            />
          )}
        </PanZoomContainer>
    </div>
  );

  const editPanelContent = (
    <div className={`h-full flex flex-col ${isDarkMode ? "bg-neutral-800" : "bg-neutral-50"}`}>
      <div className="absolute z-10 top-4 right-4 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm rounded-lg border border-neutral-300 dark:border-neutral-500 p-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            editPanelRef.current?.collapse();
          }}
          className="h-8 w-8 group"
          title="Hide editor (E)"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {/* Header */}
      <div className={`relative px-4 py-6 border-b flex items-center justify-center font-medium ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : 'bg-neutral-50 border-neutral-200 text-neutral-800'}`}>
        Edit Source
      </div>

      <div className={`flex-1 p-4 ${isDarkMode ? "bg-neutral-800" : "bg-neutral-50"}`}>
        <MermaidEditor
          ref={editorRef}
          value={diagram}
          onChange={handleDiagramChange}
          isDarkMode={isDarkMode}
          onFocusChange={setIsEditorFocused}
        />
      </div>
      <div className={`p-2 text-xs border-t flex justify-end ${isDarkMode ? "text-neutral-400 border-neutral-700" : "text-muted-foreground border-neutral-300"}`}>
        <span>{status}</span>
      </div>
    </div>
  );

  const floatingElements = (
    <>
      {/* Hotkey Modal */}
      <HotkeyModal
        isOpen={showHotkeyModal}
        onClose={() => setShowHotkeyModal(false)}
        isDarkMode={isDarkMode}
        showPenTool={isPenToolEnabled}
      />
    </>
  );

  return (
    <AppLayout
      // History Panel
      historyPanel={historyPanelContent}
      isHistoryCollapsed={isHistoryCollapsed}
      historyPanelSize={historyPanelSize}
      onHistoryResize={setHistoryPanelSize}
      onHistoryCollapse={() => {
        setIsHistoryCollapsed(true);
        trackPanelToggled({ panel: 'history', action: 'close' });
      }}
      onHistoryExpand={() => {
        setIsHistoryCollapsed(false);
        trackPanelToggled({ panel: 'history', action: 'open' });
      }}
      historyPanelRef={historyPanelRef}

      // Center Content
      centerContent={centerContent}

      // Edit Panel
      editPanel={editPanelContent}
      isEditCollapsed={isEditCollapsed}
      editPanelSize={editPanelSize}
      onEditResize={setEditPanelSize}
      onEditCollapse={() => {
        setIsEditCollapsed(true);
        trackPanelToggled({ panel: 'editor', action: 'close' });
        // Fit to screen when editor is collapsed
        setTimeout(() => {
          if (!hasManuallyZoomed) {
            handleFitToScreen(true);
          } else {
            setHasManuallyZoomed(false);
          }
        }, 300);
      }}
      onEditExpand={() => {
        setIsEditCollapsed(false);
        trackPanelToggled({ panel: 'editor', action: 'open' });
        // Fit to screen when editor is expanded
        setTimeout(() => {
          if (!hasManuallyZoomed) {
            handleFitToScreen(true);
          } else {
            setHasManuallyZoomed(false);
          }
        }, 300);
      }}
      editPanelRef={editPanelRef}

      // Floating elements
      floatingElements={floatingElements}
    />
  );
}
