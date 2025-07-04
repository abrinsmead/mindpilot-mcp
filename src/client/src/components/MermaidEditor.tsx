import { useRef, useEffect } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface MermaidEditorProps {
  value: string;
  onChange: (value: string) => void;
  isDarkMode: boolean;
}

export function MermaidEditor({ value, onChange, isDarkMode }: MermaidEditorProps) {
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorWillMount = (monaco: Monaco) => {
    // Define custom dark theme matching the app's dark mode
    monaco.editor.defineTheme('mindpilot-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1f2937', // gray-800
        'editor.foreground': '#f3f4f6', // gray-100
        'editor.lineHighlightBackground': '#ffffff10', // white with low opacity
        'editor.lineHighlightBorder': '#ffffff20', // white border with opacity
        'editor.selectionBackground': '#4b5563', // gray-600
        'editor.inactiveSelectionBackground': '#374151',
        'editorCursor.foreground': '#93c5fd', // sky-300
        'editorLineNumber.foreground': '#6b7280', // gray-500
        'editorLineNumber.activeForeground': '#d1d5db', // gray-300
      }
    });

    // Define custom light theme
    monaco.editor.defineTheme('mindpilot-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#e5e5e5', // neutral-200
        'editor.foreground': '#171717', // neutral-900
        'editor.lineHighlightBackground': '#00000015', // black with low opacity
        'editor.lineHighlightBorder': '#00000025', // black border with opacity
        'editor.selectionBackground': '#00000020',
        'editorCursor.foreground': '#000000',
        'editorLineNumber.foreground': '#737373', // neutral-500
        'editorLineNumber.activeForeground': '#404040', // neutral-700
      }
    });

    // Register Mermaid language
    monaco.languages.register({ id: 'mermaid' });

    // Set Mermaid language configuration
    monaco.languages.setLanguageConfiguration('mermaid', {
      comments: {
        lineComment: '%%',
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
    });

    // Set Mermaid syntax highlighting
    monaco.languages.setMonarchTokensProvider('mermaid', {
      keywords: [
        'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram',
        'erDiagram', 'gantt', 'pie', 'gitGraph', 'journey', 'quadrantChart',
        'TB', 'TD', 'BT', 'RL', 'LR', 'subgraph', 'end', 'participant',
        'actor', 'boundary', 'control', 'entity', 'database', 'collections',
        'queue', 'note', 'activate', 'deactivate', 'loop', 'alt', 'else',
        'opt', 'par', 'and', 'critical', 'break', 'rect', 'over', 'of',
        'left', 'right', 'class', 'click', 'call', 'state', 'choice',
        'fork', 'join', 'function', 'section', 'title', 'dateFormat',
        'axisFormat', 'excludes', 'includes', 'todayMarker', 'tickInterval',
        'style', 'linkStyle', 'classDef', 'callback', 'link', 'click',
      ],

      operators: [
        '-->', '---', '-.->',  '-.-', '==>', '===', '--|', '|--',
        '-->|', '|-->',
      ],

      tokenizer: {
        root: [
          // Comments
          [/%%.*$/, 'comment'],

          // Keywords
          [/\b(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|quadrantChart)\b/, 'keyword'],
          [/\b(TB|TD|BT|RL|LR|subgraph|end|participant|actor|note|loop|alt|else|opt|par|and|critical|break|rect|over|of|left|right)\b/, 'keyword'],
          [/\b(class|click|call|state|choice|fork|join|function|section|title|dateFormat|axisFormat|excludes|includes|todayMarker|tickInterval)\b/, 'keyword'],
          [/\b(style|linkStyle|classDef|callback|link)\b/, 'keyword'],

          // Node IDs and labels
          [/[A-Za-z][A-Za-z0-9_]*/, 'identifier'],

          // Strings
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],

          // Operators
          [/(-->|---|-.->|-.-|==>|===|--\||-->\||\|-->)/, 'operator'],

          // Brackets
          [/[\[\]]/, '@brackets'],
          [/[{}]/, '@brackets'],
          [/[()]/, '@brackets'],

          // Numbers
          [/\d+/, 'number'],
        ],

        string: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, 'string', '@pop'],
        ],
      },
    });
  };

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;
  };

  const handleChange = (value: string | undefined) => {
    onChange(value || '');
  };

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        theme: isDarkMode ? 'mindpilot-dark' : 'mindpilot-light',
      });
    }
  }, [isDarkMode]);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden">
      <Editor
        height="100%"
        defaultLanguage="mermaid"
        language="mermaid"
        value={value}
        onChange={handleChange}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
        theme={isDarkMode ? 'mindpilot-dark' : 'mindpilot-light'}
        options={{
          stickyScroll: {enabled: false},
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
          minimap: { enabled: false },
          lineNumbers: 'on',
          glyphMargin: false,
          folding: false,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          renderWhitespace: 'selection',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          wrappingStrategy: 'advanced',
          padding: { top: 16, bottom: 16 },
          scrollbar: {
            vertical: 'visible',
            horizontal: 'auto',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
      />
    </div>
  );
}
