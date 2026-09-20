import QRCode from "qrcode";
import { formatNumber } from "./math";
import type { ToolInput, ToolResult } from "./types";

function randInt(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error("Invalid range");
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
  let x = 0;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= limit);
  return x % maxExclusive;
}

function pick(alphabet: string, length: number): string {
  if (!alphabet) throw new Error("Select at least one character class");
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[randInt(alphabet.length)]!;
  return out;
}

function parseColor(input: string): { r: number; g: number; b: number } {
  const s = input.trim();
  const hex = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  const hsl = s.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i);
  if (hsl) return hslToRgb(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100);
  throw new Error("Enter HEX, rgb(), or hsl()");
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360;
  const x = c * (1 - Math.abs(((hp / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (hp < 60) [r, g, b] = [c, x, 0];
  else if (hp < 120) [r, g, b] = [x, c, 0];
  else if (hp < 180) [r, g, b] = [0, c, x];
  else if (hp < 240) [r, g, b] = [0, x, c];
  else if (hp < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

export function convertColor(input: string): ToolResult {
  const { r, g, b } = parseColor(input);
  const { h, s, l } = rgbToHsl(r, g, b);
  const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  return {
    stats: [
      { label: "HEX", value: hex },
      { label: "RGB", value: `rgb(${r}, ${g}, ${b})` },
      {
        label: "HSL",
        value: `hsl(${formatNumber(h)} ${formatNumber(s * 100)}% ${formatNumber(l * 100)}%)`,
      },
    ],
    text: hex,
    previewUrl: hex,
  };
}

export async function runGenerateTool(slug: string, input: ToolInput): Promise<ToolResult> {
  if (slug === "qr-generator") {
    const text = String(input.options.text ?? input.text ?? "").trim();
    if (!text) throw new Error("Enter text or a URL");
    const size = Number(input.options.size ?? 512);
    const ecc = String(input.options.ecc ?? "M") as "L" | "M" | "Q" | "H";
    const dataUrl = await QRCode.toDataURL(text, {
      width: size,
      margin: 2,
      errorCorrectionLevel: ecc,
      color: { dark: "#16161a", light: "#fbf9f4" },
    });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return {
      files: [{ name: "qr.png", mime: "image/png", blob }],
      previewUrl: dataUrl,
    };
  }

  if (slug === "uuid-generator") {
    const count = Math.min(100, Math.max(1, Number(input.options.count ?? 5)));
    const lines = Array.from({ length: count }, () => crypto.randomUUID());
    return { text: lines.join("\n"), stats: [{ label: "Count", value: String(count) }] };
  }

  if (slug === "password-generator") {
    const length = Math.min(128, Math.max(8, Number(input.options.length ?? 20)));
    let alphabet = "";
    if (input.options.lower !== false) alphabet += "abcdefghijklmnopqrstuvwxyz";
    if (input.options.upper !== false) alphabet += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (input.options.digits !== false) alphabet += "0123456789";
    if (input.options.symbols !== false) alphabet += "!@#$%^&*()-_=+[]{};:,.<>?";
    const pw = pick(alphabet, length);
    return { text: pw, message: "Copy this into a password manager. It is not stored." };
  }

  if (slug === "random-number") {
    const min = Number(input.options.min ?? 1);
    const max = Number(input.options.max ?? 100);
    const count = Math.min(200, Math.max(1, Number(input.options.count ?? 1)));
    const unique = Boolean(input.options.unique);
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new Error("Enter an integer range with max ≥ min");
    }
    const span = max - min + 1;
    if (unique && count > span) throw new Error("Unique count is larger than the range");
    const out: number[] = [];
    const used = new Set<number>();
    while (out.length < count) {
      const n = min + randInt(span);
      if (unique && used.has(n)) continue;
      used.add(n);
      out.push(n);
    }
    return { text: out.join("\n") };
  }

  if (slug === "random-string") {
    const length = Math.min(128, Math.max(1, Number(input.options.length ?? 12)));
    const count = Math.min(50, Math.max(1, Number(input.options.count ?? 5)));
    let alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz";
    if (!input.options.lookalikes) {
      alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
    }
    const lines = Array.from({ length: count }, () => pick(alphabet, length));
    return { text: lines.join("\n") };
  }

  if (slug === "color-converter") {
    return convertColor(String(input.options.color ?? input.text ?? ""));
  }

  if (slug === "timestamp-converter") {
    const raw = String(input.options.value ?? "now").trim();
    let date: Date;
    if (!raw || raw.toLowerCase() === "now") date = new Date();
    else if (/^-?\d+(\.\d+)?$/.test(raw)) {
      const n = Number(raw);
      date = new Date(Math.abs(n) >= 1e12 ? n : n * 1000);
    } else date = new Date(raw);
    if (Number.isNaN(date.getTime())) throw new Error("Could not parse that timestamp");
    return {
      stats: [
        { label: "Local", value: date.toString() },
        { label: "ISO", value: date.toISOString() },
        { label: "Unix seconds", value: String(Math.floor(date.getTime() / 1000)) },
        { label: "Unix ms", value: String(date.getTime()) },
      ],
    };
  }

  if (slug === "meta-tag-generator") {
    const title = String(input.options.title ?? "").trim();
    const description = String(input.options.description ?? "").trim();
    const canonical = String(input.options.canonical ?? "").trim();
    const image = String(input.options.image ?? "").trim();
    const site = String(input.options.site ?? "Anvil").trim();
    if (!title) throw new Error("Enter a title");
    const lines = [
      `<title>${esc(title)}</title>`,
      `<meta name="description" content="${esc(description)}" />`,
      canonical ? `<link rel="canonical" href="${esc(canonical)}" />` : "",
      `<meta property="og:title" content="${esc(title)}" />`,
      description ? `<meta property="og:description" content="${esc(description)}" />` : "",
      `<meta property="og:type" content="website" />`,
      site ? `<meta property="og:site_name" content="${esc(site)}" />` : "",
      canonical ? `<meta property="og:url" content="${esc(canonical)}" />` : "",
      image ? `<meta property="og:image" content="${esc(image)}" />` : "",
      `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
      `<meta name="twitter:title" content="${esc(title)}" />`,
      description ? `<meta name="twitter:description" content="${esc(description)}" />` : "",
      image ? `<meta name="twitter:image" content="${esc(image)}" />` : "",
    ].filter(Boolean);
    return { text: lines.join("\n") };
  }

  if (slug === "robots-txt-generator") {
    const mode = String(input.options.mode ?? "allow");
    const extra = String(input.options.disallow ?? "")
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const sitemap = String(input.options.sitemap ?? "").trim();
    const lines = ["User-agent: *", mode === "disallow" ? "Disallow: /" : "Allow: /"];
    for (const p of extra) lines.push(`Disallow: ${p.startsWith("/") ? p : `/${p}`}`);
    if (sitemap) lines.push(`Sitemap: ${sitemap}`);
    const text = `${lines.join("\n")}\n`;
    return {
      text,
      files: [{ name: "robots.txt", mime: "text/plain", blob: new Blob([text], { type: "text/plain" }) }],
    };
  }

  if (slug === "utm-builder") {
    const base = String(input.options.url ?? "").trim();
    if (!base) throw new Error("Enter a base URL");
    let url: URL;
    try {
      url = new URL(base);
    } catch {
      throw new Error("Enter an absolute URL");
    }
    const pairs: [string, string][] = [
      ["utm_source", String(input.options.source ?? "").trim()],
      ["utm_medium", String(input.options.medium ?? "").trim()],
      ["utm_campaign", String(input.options.campaign ?? "").trim()],
      ["utm_term", String(input.options.term ?? "").trim()],
      ["utm_content", String(input.options.content ?? "").trim()],
    ];
    for (const [k, v] of pairs) {
      if (v) url.searchParams.set(k, v);
    }
    return { text: url.toString() };
  }

  throw new Error("Unknown generator");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&" + "amp;")
    .replace(/"/g, "&" + "quot;")
    .replace(/</g, "&" + "lt;");
}
