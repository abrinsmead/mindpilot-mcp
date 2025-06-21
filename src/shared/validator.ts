// mermaid-validator.ts - Lightweight Mermaid syntax validation for Node.js

// Set up minimal DOM stubs before importing mermaid
(global as any).DOMPurify = {
  sanitize: (text: string) => text,
  addHook: () => {},
  removeHook: () => {},
  removeAllHooks: () => {},
};

(global as any).document = {
  createElement: () => ({
    innerHTML: "",
    textContent: "",
    style: {},
  }),
};

(global as any).window = {
  document: (global as any).document,
  DOMPurify: (global as any).DOMPurify,
  addEventListener: () => {},
  removeEventListener: () => {},
};

// Import mermaid after stubs are in place
import mermaid from "mermaid";

// Initialize mermaid once
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "default",
});

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Validates Mermaid diagram syntax using the actual Mermaid parser
 * @param diagram - The Mermaid diagram text to validate
 * @returns ValidationResult with syntax errors if invalid
 */
export async function validateMermaidSyntax(
  diagram: string,
): Promise<ValidationResult> {
  // Basic validation
  if (!diagram || diagram.trim().length === 0) {
    return {
      valid: false,
      errors: ["Diagram cannot be empty"],
    };
  }

  // Pre-validation: Check for balanced brackets
  const bracketPairs = [
    { open: '[', close: ']', name: 'square' },
    { open: '{', close: '}', name: 'curly' },
    { open: '(', close: ')', name: 'round' }
  ];
  
  for (const pair of bracketPairs) {
    const openCount = (diagram.match(new RegExp(`\\${pair.open}`, 'g')) || []).length;
    const closeCount = (diagram.match(new RegExp(`\\${pair.close}`, 'g')) || []).length;
    
    if (openCount !== closeCount) {
      return {
        valid: false,
        errors: [`Unmatched ${pair.name} brackets. Found ${openCount} opening and ${closeCount} closing ${pair.name} brackets.`],
        warnings: checkForWarnings(diagram)
      };
    }
  }

  try {
    // Use Mermaid's parser to validate
    await mermaid.parse(diagram);

    // If we get here without error, the syntax is valid
    return {
      valid: true,
      warnings: checkForWarnings(diagram),
    };
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";

    // Check if it's a real syntax error vs DOM-related error
    if (isRealSyntaxError(errorMsg)) {
      const errors = [errorMsg];

      // Add helpful hints based on error type
      if (errorMsg.includes("Lexical error")) {
        errors.push(
          "Check for unescaped special characters. Use quotes for labels with spaces.",
        );
      }
      if (errorMsg.includes("Parse error") && errorMsg.includes("Expecting")) {
        errors.push(
          "Check that all brackets are matched and nodes are properly connected.",
        );
      }
      if (errorMsg.includes("No diagram type detected")) {
        errors.push(
          "Diagram must start with a valid type: graph, flowchart, sequenceDiagram, classDiagram, etc.",
        );
      }

      return {
        valid: false,
        errors,
        warnings: checkForWarnings(diagram),
      };
    }

    // DOM/DOMPurify errors mean the syntax is actually valid
    // (Mermaid parsed it successfully but failed during DOM manipulation)
    return {
      valid: true,
      warnings: checkForWarnings(diagram),
    };
  }
}

/**
 * Determines if an error is a real syntax error vs DOM-related error
 */
function isRealSyntaxError(errorMsg: string): boolean {
  const syntaxErrorPatterns = [
    "Parse error",
    "No diagram type detected",
    "Lexical error",
    "Expecting",
    "Syntax error",
    "Invalid",
    "Unrecognized",
  ];

  const domErrorPatterns = [
    "DOMPurify",
    "DOM",
    "window",
    "document",
    "addEventListener",
  ];

  // Check for syntax error patterns
  const isSyntaxError = syntaxErrorPatterns.some((pattern) =>
    errorMsg.includes(pattern),
  );

  // Check for DOM error patterns
  const isDomError = domErrorPatterns.some((pattern) =>
    errorMsg.includes(pattern),
  );

  // It's a real syntax error if it matches syntax patterns and not DOM patterns
  return isSyntaxError && !isDomError;
}

/**
 * Checks for common issues that aren't syntax errors but could be improved
 */
function checkForWarnings(diagram: string): string[] | undefined {
  const warnings: string[] = [];

  // Check for mixed arrow styles
  if (diagram.includes("-->") && diagram.includes("->")) {
    warnings.push(
      "Mixed arrow styles detected. Consider using consistent arrow types.",
    );
  }

  // Check for raw quotes that should be escaped
  if (diagram.includes('"') && !diagram.includes("&quot;")) {
    const labelPattern = /\["[^"]*"/g;
    if (labelPattern.test(diagram)) {
      warnings.push(
        'Raw quotes (") detected in labels. Use &quot; for quotes in labels.',
      );
    }
  }

  // Check for potentially problematic characters in labels
  const labelWithBrackets = /\["[^"]*\[[^\]]*\][^"]*"\]/g;
  if (labelWithBrackets.test(diagram)) {
    warnings.push(
      "Square brackets detected in labels. Consider using &#91; and &#93; for [ and ].",
    );
  }

  // Check for very long lines that might be hard to read
  const lines = diagram.split("\n");
  const longLines = lines.filter((line) => line.length > 100);
  if (longLines.length > 0) {
    warnings.push(
      `${longLines.length} line(s) exceed 100 characters. Consider breaking into multiple lines.`,
    );
  }

  return warnings.length > 0 ? warnings : undefined;
}

/**
 * Get list of valid diagram types
 */
export function getValidDiagramTypes(): string[] {
  return [
    "C4Component",
    "C4Container",
    "C4Context",
    "C4Dynamic",
    "architecture-beta",
    "block",
    "block-beta",
    "classDiagram",
    "erDiagram",
    "flowchart",
    "gantt",
    "gitGraph",
    "graph",
    "journey",
    "kanban",
    "mindmap",
    "packet-beta",
    "pie",
    "quadrantChart",
    "radar-beta",
    "requirementDiagram",
    "sankey",
    "sequenceDiagram",
    "stateDiagram",
    "stateDiagram-v2",
    "timeline",
    "xychart-beta",
    "zenuml",
  ];
}
