import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface HotkeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  showPenTool?: boolean;
}

interface Shortcut {
  keys: string;
  description: string;
  category: string;
}

const getShortcuts = (showPenTool: boolean): Shortcut[] => {
  // Detect if we're on macOS
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl+';
  
  const shortcuts: Shortcut[] = [
    // Theme
    { keys: "D", description: "Toggle dark/light mode", category: "Theme" },

    // Panels
    { keys: "H", description: "Toggle history panel", category: "Panels" },
    { keys: "E", description: "Toggle editor panel", category: "Panels" },

    // Navigation
    { keys: "/", description: "Focus search bar", category: "Navigation" },
    { keys: `${modKey}←|${modKey}→`, description: "Navigate between diagrams", category: "Navigation" },
    { keys: `1-9`, description: "Jump to diagram in expanded sections", category: "Navigation" },
    { keys: "↑|↓|←|→", description: "Pan around diagram", category: "Navigation" },

    // View
    { keys: "PageUp|PageDown", description: "Zoom in / out", category: "View" },
    { keys: "F", description: "Fit to screen", category: "View" },
  ];

  if (showPenTool) {
    shortcuts.push({ keys: "P", description: "Toggle pen/drawing mode", category: "View" });
  }

  // Copy
  shortcuts.push(
    { keys: "I", description: "Copy image to clipboard", category: "Copy" },
    { keys: "S", description: "Copy source to clipboard", category: "Copy" }
  );

  // Help
  shortcuts.push({ keys: "?", description: "Show keyboard shortcuts", category: "Help" });

  return shortcuts;
};

export function HotkeyModal({ isOpen, onClose, isDarkMode, showPenTool = false }: HotkeyModalProps) {
  const shortcuts = getShortcuts(showPenTool);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-lg ${isDarkMode ? 'bg-neutral-800 text-neutral-100' : 'bg-white'} [&>button]:!ring-0 [&>button]:!ring-offset-0 [&>button]:!outline-none`}>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Keyboard Shortcuts
            <span className={`ml-3 text-sm font-normal ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              (Toggle Help ?)
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className={`flex items-center justify-between py-1.5 px-2 rounded ${
                isDarkMode ? 'hover:bg-neutral-700/50' : 'hover:bg-neutral-50'
              }`}
            >
              <span className={`text-sm ${
                isDarkMode ? 'text-neutral-200' : 'text-neutral-700'
              }`}>
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.includes('|') ? (
                  shortcut.keys.split('|').map((key, keyIndex) => (
                    <kbd
                      key={keyIndex}
                      className={`px-1.5 py-0.5 text-xs font-mono rounded ${
                        isDarkMode
                          ? 'bg-neutral-700 text-neutral-300 border border-neutral-600'
                          : 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                      }`}
                    >
                      {key}
                    </kbd>
                  ))
                ) : (
                  <kbd className={`px-1.5 py-0.5 text-xs font-mono rounded ${
                    isDarkMode
                      ? 'bg-neutral-700 text-neutral-300 border border-neutral-600'
                      : 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                  }`}>
                    {shortcut.keys}
                  </kbd>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={`mt-4 pt-3 border-t text-xs text-center ${
          isDarkMode ? 'border-neutral-700 text-neutral-500' : 'border-neutral-200 text-neutral-400'
        }`}>
          Press <kbd className={`px-1 py-0.5 mx-0.5 font-mono rounded text-[10px] ${
            isDarkMode
              ? 'bg-neutral-700 text-neutral-300'
              : 'bg-neutral-200 text-neutral-600'
          }`}>Esc</kbd> to close
        </div>
      </DialogContent>
    </Dialog>
  );
}
