import { ReactNode } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  Braces,
  PanelLeft,
  ChevronLeft,
} from "lucide-react";
import { useThemeContext } from '@/contexts';
import { isWindows, isElectron } from '@/lib/electron';

export interface AppLayoutProps {
  // History Panel
  historyPanel: ReactNode;
  isHistoryCollapsed: boolean;
  historyPanelSize: number;
  onHistoryResize: (size: number) => void;
  onHistoryCollapse: () => void;
  onHistoryExpand: () => void;
  historyPanelRef: React.RefObject<any>;

  // Center Content
  centerContent: ReactNode;

  // Edit Panel
  editPanel: ReactNode;
  isEditCollapsed: boolean;
  editPanelSize: number;
  onEditResize: (size: number) => void;
  onEditCollapse: () => void;
  onEditExpand: () => void;
  editPanelRef: React.RefObject<any>;

  // Floating elements
  floatingElements?: ReactNode;
}

export function AppLayout({
  historyPanel,
  isHistoryCollapsed,
  historyPanelSize,
  onHistoryResize,
  onHistoryCollapse,
  onHistoryExpand,
  historyPanelRef,
  centerContent,
  editPanel,
  isEditCollapsed,
  editPanelSize,
  onEditResize,
  onEditCollapse,
  onEditExpand,
  editPanelRef,
  floatingElements,
}: AppLayoutProps) {
  const { isDarkMode } = useThemeContext();

  // Windows needs a custom titlebar region for window dragging
  const showWindowsTitlebar = isElectron && isWindows;

  return (
    <div className={`h-screen w-screen flex flex-col ${isDarkMode ? "bg-neutral-900" : "bg-neutral-900"}`}>
      {/* Windows titlebar drag region */}
      {showWindowsTitlebar && (
        <div
          className={`titlebar-drag-region flex items-center justify-center h-8 shrink-0 ${
            isDarkMode ? 'bg-[#1a1a2e]' : 'bg-white'
          }`}
          style={{ paddingRight: '138px' }} // Space for window controls (min/max/close buttons)
        >
          <span className={`text-xs font-medium select-none ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Mindpilot
          </span>
        </div>
      )}
      <ResizablePanelGroup direction="horizontal" className="flex-1 relative">
        {/* History Panel - Left Side */}
        <ResizablePanel
          ref={historyPanelRef}
          defaultSize={isHistoryCollapsed ? 0 : Math.min(historyPanelSize, 33)}
          minSize={20}
          maxSize={33}
          collapsible={true}
          collapsedSize={0}
          onResize={(size) => {
            // Only save if size changed significantly (more than 0.5%)
            if (!isHistoryCollapsed && size > 1 && Math.abs(size - historyPanelSize) > 0.5) {
              onHistoryResize(Math.round(size));
            }
          }}
          onCollapse={onHistoryCollapse}
          onExpand={onHistoryExpand}
        >
          {historyPanel}
        </ResizablePanel>

        <ResizableHandle className="bg-neutral-300 dark:bg-neutral-700" />

        {/* Center Panel - Diagram View */}
        <ResizablePanel defaultSize={50}>
          {centerContent}
        </ResizablePanel>

        <ResizableHandle className="bg-neutral-300 dark:bg-neutral-700" />

        {/* Edit Panel - Right Side */}
        <ResizablePanel
          ref={editPanelRef}
          defaultSize={isEditCollapsed ? 0 : Math.min(editPanelSize, 33)}
          minSize={25}
          maxSize={33}
          collapsible={true}
          collapsedSize={0}
          onResize={(size) => {
            // Only save if size changed significantly (more than 0.5%)
            if (!isEditCollapsed && size > 1 && Math.abs(size - editPanelSize) > 0.5) {
              onEditResize(Math.round(size));
            }
          }}
          onCollapse={onEditCollapse}
          onExpand={onEditExpand}
        >
          {editPanel}
        </ResizablePanel>

        {/* Menu button - always visible */}
        <div className="absolute z-10 top-4 left-4 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm rounded-lg border border-neutral-200 dark:border-neutral-600 p-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (isHistoryCollapsed) {
                historyPanelRef.current?.expand();
              } else {
                historyPanelRef.current?.collapse();
              }
            }}
            className="h-8 w-8 group"
            title={isHistoryCollapsed ? "Show history panel (H)" : "Hide history panel (H)"}
          >
            {isHistoryCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Edit button - only when collapsed */}
        {isEditCollapsed && (
          <div className="absolute z-10 top-4 right-4 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm rounded-lg border border-neutral-200 dark:border-neutral-600 p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                editPanelRef.current?.expand();
              }}
              className="h-8 w-8 group"
              title="Show editor (E)"
            >
              <Braces className="h-4 w-4" />
            </Button>
          </div>
        )}
      </ResizablePanelGroup>

      {floatingElements}
    </div>
  );
}
