import { getTool } from "./registry";
import { runPdfTool } from "./pdf";
import { runImageTool } from "./image";
import { runTextDevTool } from "./text-dev";
import { runCalcTool } from "./calc";
import { runGenerateTool } from "./generate";
import { MAX_UPLOAD_BYTES, type ToolInput, type ToolResult } from "./types";

const PDF = new Set([
  "merge-pdf",
  "split-pdf",
  "compress-pdf",
  "jpg-to-pdf",
  "png-to-pdf",
  "pdf-to-jpg",
  "pdf-to-png",
  "extract-pdf-pages",
  "rotate-pdf",
  "pdf-metadata",
  "protect-pdf",
  "unlock-pdf",
]);

const IMAGE = new Set([
  "compress-jpg",
  "compress-png",
  "resize-image",
  "jpg-to-png",
  "png-to-jpg",
  "jpg-to-webp",
  "webp-to-jpg",
]);

export async function runTool(slug: string, input: ToolInput): Promise<ToolResult> {
  const tool = getTool(slug);
  if (!tool) throw new Error("Unknown tool");
  for (const file of input.files) {
    if (file.size > (tool.maxBytes ?? MAX_UPLOAD_BYTES)) {
      throw new Error(`${file.name} exceeds the 25 MB limit`);
    }
  }
  if (PDF.has(slug)) return runPdfTool(slug, input);
  if (IMAGE.has(slug)) return runImageTool(slug, input);
  if (tool.category === "calculators" || slug === "unit-converter" || slug === "data-converter") {
    return runCalcTool(slug, input);
  }
  if (
    [
      "qr-generator",
      "password-generator",
      "random-number",
      "random-string",
      "uuid-generator",
      "color-converter",
      "timestamp-converter",
      "meta-tag-generator",
      "robots-txt-generator",
      "utm-builder",
    ].includes(slug)
  ) {
    return runGenerateTool(slug, input);
  }
  return runTextDevTool(slug, input);
}
