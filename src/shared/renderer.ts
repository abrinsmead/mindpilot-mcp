import { RenderResult } from "./types.js";
import { validateMermaidSyntax } from "./validator.js";

export async function renderMermaid(
  diagram: string,
  background?: string,
): Promise<RenderResult> {
  try {
    // Validate the diagram first
    const validation = await validateMermaidSyntax(diagram);

    if (!validation.valid) {
      return {
        type: "error",
        diagram,
        error: validation.errors?.[0] || "Invalid diagram syntax",
        details: validation.errors?.join("\n"),
      };
    }

    // Return the validated diagram for client-side rendering
    // The actual SVG rendering happens in the browser
    return {
      type: "success",
      diagram,
      background,
      // Note: svg field is populated by the client after rendering
    };
  } catch (error) {
    return {
      type: "error",
      diagram,
      error: error instanceof Error ? error.message : "Failed to process diagram",
    };
  }
}