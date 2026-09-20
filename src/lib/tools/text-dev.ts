import { stemName } from "@/lib/utils";
import type { ToolInput, ToolResult } from "./types";

function md5(bytes: Uint8Array): string {
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = (a + q + x + t) | 0;
    return (((a << s) | (a >>> (32 - s))) + b) | 0;
  }
  const ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    cmn((b & c) | (~b & d), a, b, x, s, t);
  const gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    cmn((b & d) | (c & ~d), a, b, x, s, t);
  const hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    cmn(b ^ c ^ d, a, b, x, s, t);
  const ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    cmn(c ^ (b | ~d), a, b, x, s, t);

  const n = bytes.length;
  const tail = (((n + 8) >> 6) + 1) * 16;
  const blk = new Int32Array(tail);
  for (let i = 0; i < n; i += 1) blk[i >> 2] |= bytes[i]! << ((i % 4) * 8);
  blk[n >> 2] |= 0x80 << ((n % 4) * 8);
  blk[tail - 2] = n * 8;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;
  for (let i = 0; i < tail; i += 16) {
    const oa = a,
      ob = b,
      oc = c,
      od = d;
    a = ff(a, b, c, d, blk[i]!, 7, -680876936);
    d = ff(d, a, b, c, blk[i + 1]!, 12, -389564586);
    c = ff(c, d, a, b, blk[i + 2]!, 17, 606105819);
    b = ff(b, c, d, a, blk[i + 3]!, 22, -1044525330);
    a = ff(a, b, c, d, blk[i + 4]!, 7, -176418897);
    d = ff(d, a, b, c, blk[i + 5]!, 12, 1200080426);
    c = ff(c, d, a, b, blk[i + 6]!, 17, -1473231341);
    b = ff(b, c, d, a, blk[i + 7]!, 22, -45705983);
    a = ff(a, b, c, d, blk[i + 8]!, 7, 1770035416);
    d = ff(d, a, b, c, blk[i + 9]!, 12, -1958414417);
    c = ff(c, d, a, b, blk[i + 10]!, 17, -42063);
    b = ff(b, c, d, a, blk[i + 11]!, 22, -1990404162);
    a = ff(a, b, c, d, blk[i + 12]!, 7, 1804603682);
    d = ff(d, a, b, c, blk[i + 13]!, 12, -40341101);
    c = ff(c, d, a, b, blk[i + 14]!, 17, -1502002290);
    b = ff(b, c, d, a, blk[i + 15]!, 22, 1236535329);
    a = gg(a, b, c, d, blk[i + 1]!, 5, -165796510);
    d = gg(d, a, b, c, blk[i + 6]!, 9, -1069501632);
    c = gg(c, d, a, b, blk[i + 11]!, 14, 643717713);
    b = gg(b, c, d, a, blk[i]!, 20, -373897302);
    a = gg(a, b, c, d, blk[i + 5]!, 5, -701558691);
    d = gg(d, a, b, c, blk[i + 10]!, 9, 38016083);
    c = gg(c, d, a, b, blk[i + 15]!, 14, -660478335);
    b = gg(b, c, d, a, blk[i + 4]!, 20, -405537848);
    a = gg(a, b, c, d, blk[i + 9]!, 5, 568446438);
    d = gg(d, a, b, c, blk[i + 14]!, 9, -1019803690);
    c = gg(c, d, a, b, blk[i + 3]!, 14, -187363961);
    b = gg(b, c, d, a, blk[i + 8]!, 20, 1163531501);
    a = gg(a, b, c, d, blk[i + 13]!, 5, -1444681467);
    d = gg(d, a, b, c, blk[i + 2]!, 9, -51403784);
    c = gg(c, d, a, b, blk[i + 7]!, 14, 1735328473);
    b = gg(b, c, d, a, blk[i + 12]!, 20, -1926607734);
    a = hh(a, b, c, d, blk[i + 5]!, 4, -378558);
    d = hh(d, a, b, c, blk[i + 8]!, 11, -2022574463);
    c = hh(c, d, a, b, blk[i + 11]!, 16, 1839030562);
    b = hh(b, c, d, a, blk[i + 14]!, 23, -35309556);
    a = hh(a, b, c, d, blk[i + 1]!, 4, -1530992060);
    d = hh(d, a, b, c, blk[i + 4]!, 11, 1272893353);
    c = hh(c, d, a, b, blk[i + 7]!, 16, -155497632);
    b = hh(b, c, d, a, blk[i + 10]!, 23, -1094730640);
    a = hh(a, b, c, d, blk[i + 13]!, 4, 681279174);
    d = hh(d, a, b, c, blk[i]!, 11, -358537222);
    c = hh(c, d, a, b, blk[i + 3]!, 16, -722521979);
    b = hh(b, c, d, a, blk[i + 6]!, 23, 76029189);
    a = hh(a, b, c, d, blk[i + 9]!, 4, -640364487);
    d = hh(d, a, b, c, blk[i + 12]!, 11, -421815835);
    c = hh(c, d, a, b, blk[i + 15]!, 16, 530742520);
    b = hh(b, c, d, a, blk[i + 2]!, 23, -995338651);
    a = ii(a, b, c, d, blk[i]!, 6, -198630844);
    d = ii(d, a, b, c, blk[i + 7]!, 10, 1126891415);
    c = ii(c, d, a, b, blk[i + 14]!, 15, -1416354905);
    b = ii(b, c, d, a, blk[i + 5]!, 21, -57434055);
    a = ii(a, b, c, d, blk[i + 12]!, 6, 1700485571);
    d = ii(d, a, b, c, blk[i + 3]!, 10, -1894986606);
    c = ii(c, d, a, b, blk[i + 10]!, 15, -1051523);
    b = ii(b, c, d, a, blk[i + 1]!, 21, -2054922799);
    a = ii(a, b, c, d, blk[i + 8]!, 6, 1873313359);
    d = ii(d, a, b, c, blk[i + 15]!, 10, -30611744);
    c = ii(c, d, a, b, blk[i + 6]!, 15, -1560198380);
    b = ii(b, c, d, a, blk[i + 13]!, 21, 1309151649);
    a = ii(a, b, c, d, blk[i + 4]!, 6, -145523070);
    d = ii(d, a, b, c, blk[i + 11]!, 10, -1120210379);
    c = ii(c, d, a, b, blk[i + 2]!, 15, 718787259);
    b = ii(b, c, d, a, blk[i + 9]!, 21, -343485551);
    a = (a + oa) | 0;
    b = (b + ob) | 0;
    c = (c + oc) | 0;
    d = (d + od) | 0;
  }
  const hex = (n: number) =>
    [n, n >> 8, n >> 16, n >> 24].map((v) => (v & 255).toString(16).padStart(2, "0")).join("");
  return hex(a) + hex(b) + hex(c) + hex(d);
}

async function shaHex(algo: string, bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(algo, bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function countWords(text: string) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const lines = text.length ? text.split(/\n/).length : 0;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0;
  const sentences = trimmed ? (trimmed.match(/[.!?]+(\s|$)/g) ?? []).length || (trimmed ? 1 : 0) : 0;
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, "").length;
  return { words: words.length, chars, charsNoSpace, lines, paragraphs, sentences };
}

function toSlug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function b64Encode(bytes: Uint8Array, urlsafe: boolean): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  let out = btoa(bin);
  if (urlsafe) out = out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return out;
}

function b64Decode(input: string): Uint8Array {
  const cleaned = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = cleaned.length % 4 === 0 ? "" : "=".repeat(4 - (cleaned.length % 4));
  try {
    const bin = atob(cleaned + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    throw new Error("Invalid Base64");
  }
}

export async function runTextDevTool(slug: string, input: ToolInput): Promise<ToolResult> {
  const text = input.text;

  if (slug === "word-counter") {
    const c = countWords(text);
    return {
      stats: [
        { label: "Words", value: String(c.words) },
        { label: "Characters", value: String(c.chars) },
        { label: "Characters (no spaces)", value: String(c.charsNoSpace) },
        { label: "Sentences", value: String(c.sentences) },
        { label: "Paragraphs", value: String(c.paragraphs) },
        { label: "Lines", value: String(c.lines) },
      ],
    };
  }

  if (slug === "character-counter") {
    const c = countWords(text);
    return {
      stats: [
        { label: "Characters", value: String(c.chars) },
        { label: "Without spaces", value: String(c.charsNoSpace) },
        { label: "Words", value: String(c.words) },
      ],
    };
  }

  if (slug === "case-converter") {
    const mode = String(input.options.mode ?? "lower");
    let out = text;
    if (mode === "lower") out = text.toLowerCase();
    else if (mode === "upper") out = text.toUpperCase();
    else if (mode === "title")
      out = text.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    else if (mode === "sentence")
      out = text
        .toLowerCase()
        .replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (m) => m.toUpperCase());
    else if (mode === "invert")
      out = [...text].map((ch) => (ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase())).join("");
    return { text: out };
  }

  if (slug === "duplicate-line-remover") {
    const trim = Boolean(input.options.trim ?? true);
    const insensitive = Boolean(input.options.insensitive);
    const seen = new Set<string>();
    const lines = text.split("\n");
    const kept: string[] = [];
    let dropped = 0;
    for (const line of lines) {
      const cmp = (trim ? line.trim() : line)[insensitive ? "toLowerCase" : "toString"]();
      const key = insensitive ? cmp.toLowerCase() : cmp;
      if (seen.has(key)) {
        dropped += 1;
        continue;
      }
      seen.add(key);
      kept.push(trim ? line.trim() : line);
    }
    return { text: kept.join("\n"), stats: [{ label: "Removed", value: String(dropped) }] };
  }

  if (slug === "slug-generator") {
    return { text: toSlug(text) };
  }

  if (slug === "text-cleaner") {
    let out = text.replace(/\r\n/g, "\n");
    if (input.options.quotes !== false) {
      out = out.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
    }
    if (input.options.spaces !== false) {
      out = out.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ");
    }
    if (input.options.blanks !== false) {
      out = out.replace(/\n{3,}/g, "\n\n");
    }
    return { text: out.trim() };
  }

  if (slug === "json-formatter" || slug === "json-minifier" || slug === "json-validator") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Invalid JSON");
    }
    if (slug === "json-validator") {
      return { message: "Valid JSON.", stats: [{ label: "Type", value: Array.isArray(parsed) ? "array" : typeof parsed }] };
    }
    const indent = slug === "json-minifier" ? 0 : String(input.options.indent ?? "2") === "tab" ? "\t" : Number(input.options.indent ?? 2);
    return { text: JSON.stringify(parsed, null, indent) };
  }

  if (slug === "base64-encoder") {
    const urlsafe = Boolean(input.options.urlsafe);
    let bytes: Uint8Array;
    if (input.files[0]) bytes = new Uint8Array(await input.files[0].arrayBuffer());
    else bytes = new TextEncoder().encode(String(input.options.text ?? text ?? ""));
    if (!bytes.length) throw new Error("Add text or a file");
    return { text: b64Encode(bytes, urlsafe) };
  }

  if (slug === "base64-decoder") {
    const bytes = b64Decode(text);
    const name = String(input.options.filename || "decoded.bin");
    let asText = "";
    try {
      asText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      asText = "";
    }
    return {
      text: asText || undefined,
      files: [{ name, mime: "application/octet-stream", blob: new Blob([bytes.slice() as unknown as BlobPart]) }],
      message: asText ? "Decoded as UTF-8 text and as a download." : "Bytes are not valid UTF-8. Download the file.",
    };
  }

  if (slug === "url-encoder") {
    const mode = String(input.options.mode ?? "component");
    return { text: mode === "uri" ? encodeURI(text) : encodeURIComponent(text) };
  }

  if (slug === "url-decoder") {
    try {
      return { text: decodeURIComponent(text.replace(/\+/g, "%20")) };
    } catch {
      throw new Error("Invalid percent-encoding");
    }
  }

  if (slug === "hash-generator") {
    let bytes: Uint8Array;
    if (input.files[0]) bytes = new Uint8Array(await input.files[0].arrayBuffer());
    else bytes = new TextEncoder().encode(String(input.options.text ?? text ?? ""));
    if (!bytes.length) throw new Error("Add text or a file");
    const stats: { label: string; value: string }[] = [];
    if (input.options.md5 !== false) stats.push({ label: "MD5", value: md5(bytes) });
    if (input.options.sha1 !== false) stats.push({ label: "SHA-1", value: await shaHex("SHA-1", bytes) });
    if (input.options.sha256 !== false) stats.push({ label: "SHA-256", value: await shaHex("SHA-256", bytes) });
    if (input.options.sha384) stats.push({ label: "SHA-384", value: await shaHex("SHA-384", bytes) });
    if (input.options.sha512) stats.push({ label: "SHA-512", value: await shaHex("SHA-512", bytes) });
    const label = input.files[0] ? input.files[0].name : "text";
    return { stats, message: `Digest of ${label}. MD5 and SHA-1 are not for security.` };
  }

  if (slug === "sitemap-generator") {
    const urls = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const ok: string[] = [];
    const bad: string[] = [];
    for (const u of urls) {
      try {
        const parsed = new URL(u);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("scheme");
        ok.push(parsed.toString());
      } catch {
        bad.push(u);
      }
    }
    if (!ok.length) throw new Error("Enter at least one absolute http(s) URL");
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      ok.map((u) => `  <url><loc>${escapeXml(u)}</loc></url>`).join("\n") +
      `\n</urlset>\n`;
    return {
      text: xml,
      files: [{ name: "sitemap.xml", mime: "application/xml", blob: new Blob([xml], { type: "application/xml" }) }],
      stats: [
        { label: "URLs", value: String(ok.length) },
        { label: "Skipped", value: String(bad.length) },
      ],
      message: bad.length ? `Skipped: ${bad.join(", ")}` : undefined,
    };
  }

  void stemName;
  throw new Error("Unknown text tool");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}
