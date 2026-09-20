export type ToolCategoryId =
  | "pdf"
  | "image"
  | "text"
  | "developer"
  | "generators"
  | "calculators"
  | "converters"
  | "seo";

export type ToolFaq = { q: string; a: string };

export type ToolOption = {
  key: string;
  label: string;
  type: "select" | "number" | "text" | "boolean" | "range" | "textarea";
  default?: string | number | boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  help?: string;
};

export type ToolUi =
  | {
      kind: "files";
      accept: string;
      multiple?: boolean;
      maxFiles?: number;
      options?: ToolOption[];
    }
  | { kind: "text"; placeholder: string; options?: ToolOption[]; rows?: number }
  | { kind: "generate"; options?: ToolOption[] }
  | { kind: "form"; fields: ToolOption[] }
  | {
      kind: "calc";
      variant:
        | "basic"
        | "scientific"
        | "percentage"
        | "age"
        | "date"
        | "time"
        | "unit"
        | "data"
        | "download";
    }
  | { kind: "color" }
  | { kind: "crop" };

export type ToolDef = {
  id: string;
  slug: string;
  name: string;
  category: ToolCategoryId;
  icon: string;
  summary: string;
  description: string;
  instructions: string[];
  examples: string[];
  limitations: string[];
  faqs: ToolFaq[];
  featured: boolean;
  homepage: boolean;
  seo: boolean;
  cost: number;
  engine: "browser";
  related: string[];
  sort: number;
  ui: ToolUi;
  maxBytes?: number;
};

export type ToolInput = {
  files: File[];
  text: string;
  options: Record<string, string | number | boolean>;
};

export type ToolOutputFile = {
  name: string;
  mime: string;
  blob: Blob;
};

export type ToolStat = { label: string; value: string };

export type ToolResult = {
  files?: ToolOutputFile[];
  text?: string;
  stats?: ToolStat[];
  previewUrl?: string;
  message?: string;
};

export const CATEGORIES: {
  id: ToolCategoryId;
  name: string;
  blurb: string;
}[] = [
  { id: "pdf", name: "PDF", blurb: "Merge, split, compress, convert, and protect documents." },
  { id: "image", name: "Images", blurb: "Resize, crop, compress, and convert common formats." },
  { id: "text", name: "Text", blurb: "Count, clean, convert case, and tidy writing." },
  { id: "developer", name: "Developer", blurb: "JSON, encoding, hashes, UUIDs, and timestamps." },
  { id: "generators", name: "Generators", blurb: "QR codes, passwords, and random values." },
  { id: "calculators", name: "Calculators", blurb: "Everyday math, dates, units, and time." },
  { id: "converters", name: "Converters", blurb: "Color, data size, and unit conversions." },
  { id: "seo", name: "SEO", blurb: "Meta tags, robots.txt, sitemaps, and UTM links." },
];

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
