import { PDFDocument, degrees } from "@cantoo/pdf-lib";
import JSZip from "jszip";
import { formatBytes, stemName } from "@/lib/utils";
import type { ToolInput, ToolResult } from "./types";

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

function parseRange(spec: string, pageCount: number): number[] {
  const out = new Set<number>();
  const raw = spec.trim();
  if (!raw) throw new Error("Enter a page range such as 1-3,5");
  for (const part of raw.split(",")) {
    const bit = part.trim();
    if (!bit) continue;
    const m = bit.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = Number(m[1]);
      let b = Number(m[2]);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i += 1) {
        if (i < 1 || i > pageCount) throw new Error(`Page ${i} is out of range (1–${pageCount})`);
        out.add(i - 1);
      }
      continue;
    }
    if (!/^\d+$/.test(bit)) throw new Error(`Invalid page token: ${bit}`);
    const n = Number(bit);
    if (n < 1 || n > pageCount) throw new Error(`Page ${n} is out of range (1–${pageCount})`);
    out.add(n - 1);
  }
  if (!out.size) throw new Error("No pages selected");
  return [...out].sort((a, b) => a - b);
}

async function fileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function pdfBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy as unknown as BlobPart], { type: "application/pdf" });
}

async function renderPageJpeg(
  pdfjs: Awaited<ReturnType<typeof loadPdfJs>>,
  data: Uint8Array,
  pageNumber: number,
  scale: number,
  quality: number,
  password?: string,
): Promise<{ blob: Blob; width: number; height: number }> {
  const task = pdfjs.getDocument({ data: data.slice(), password, useSystemFonts: true });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode JPEG"))),
        "image/jpeg",
        quality,
      );
    });
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    await doc.cleanup();
  }
}

async function rasterPages(
  file: File,
  scale: number,
  mime: "image/jpeg" | "image/png",
  quality = 0.85,
  password?: string,
): Promise<{ name: string; blob: Blob }[]> {
  const pdfjs = await loadPdfJs();
  const data = await fileBytes(file);
  const task = pdfjs.getDocument({ data: data.slice(), password, useSystemFonts: true });
  const doc = await task.promise;
  const out: { name: string; blob: Blob }[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not available");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
          mime,
          quality,
        );
      });
      const ext = mime === "image/png" ? "png" : "jpg";
      out.push({ name: `${stemName(file.name)}-page-${String(i).padStart(3, "0")}.${ext}`, blob });
    }
  } finally {
    await doc.cleanup();
  }
  return out;
}

async function asZipOrSingle(
  files: { name: string; blob: Blob }[],
  zipName: string,
): Promise<ToolResult> {
  if (files.length === 1) {
    const f = files[0]!;
    return { files: [{ name: f.name, mime: f.blob.type, blob: f.blob }] };
  }
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.blob);
  const blob = await zip.generateAsync({ type: "blob" });
  return { files: [{ name: zipName, mime: "application/zip", blob }] };
}

export async function runPdfTool(slug: string, input: ToolInput): Promise<ToolResult> {
  const files = input.files;
  if (!files.length) throw new Error("Add a PDF file");

  if (slug === "merge-pdf") {
    if (files.length < 2) throw new Error("Add at least two PDF files");
    const out = await PDFDocument.create();
    for (const file of files) {
      if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error(`${file.name} is not a PDF`);
      }
      const src = await PDFDocument.load(await fileBytes(file));
      const copied = await out.copyPages(src, src.getPageIndices());
      copied.forEach((p) => out.addPage(p));
    }
    const bytes = await out.save();
    return {
      files: [{ name: "merged.pdf", mime: "application/pdf", blob: pdfBlob(bytes) }],
      stats: [{ label: "Pages", value: String(out.getPageCount()) }],
    };
  }

  const file = files[0]!;
  const password = String(input.options.password ?? "");

  if (slug === "split-pdf") {
    const src = await PDFDocument.load(await fileBytes(file), password ? { password } : undefined);
    const mode = String(input.options.mode ?? "all");
    if (mode === "range") {
      const keep = parseRange(String(input.options.range ?? ""), src.getPageCount());
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, keep);
      copied.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      return {
        files: [{ name: `${stemName(file.name)}-extract.pdf`, mime: "application/pdf", blob: pdfBlob(bytes) }],
        stats: [{ label: "Pages kept", value: String(keep.length) }],
      };
    }
    const parts: { name: string; blob: Blob }[] = [];
    for (const idx of src.getPageIndices()) {
      const out = await PDFDocument.create();
      const [page] = await out.copyPages(src, [idx]);
      out.addPage(page);
      const bytes = await out.save();
      parts.push({
        name: `${stemName(file.name)}-p${String(idx + 1).padStart(3, "0")}.pdf`,
        blob: pdfBlob(bytes),
      });
    }
    return asZipOrSingle(parts, `${stemName(file.name)}-pages.zip`);
  }

  if (slug === "extract-pdf-pages") {
    const src = await PDFDocument.load(await fileBytes(file), password ? { password } : undefined);
    const keep = parseRange(String(input.options.range ?? "1"), src.getPageCount());
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, keep);
    copied.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    return {
      files: [{ name: `${stemName(file.name)}-pages.pdf`, mime: "application/pdf", blob: pdfBlob(bytes) }],
      stats: [{ label: "Pages", value: String(keep.length) }],
    };
  }

  if (slug === "rotate-pdf") {
    const src = await PDFDocument.load(await fileBytes(file), password ? { password } : undefined);
    const extra = Number(input.options.angle ?? 90);
    for (const page of src.getPages()) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + extra + 360) % 360));
    }
    const bytes = await src.save();
    return { files: [{ name: `${stemName(file.name)}-rotated.pdf`, mime: "application/pdf", blob: pdfBlob(bytes) }] };
  }

  if (slug === "pdf-metadata") {
    const bytes = await fileBytes(file);
    let encrypted = false;
    let doc;
    try {
      doc = await PDFDocument.load(bytes, password ? { password } : { ignoreEncryption: false });
    } catch (err) {
      encrypted = true;
      try {
        doc = await PDFDocument.load(bytes, { ignoreEncryption: true, password: password || undefined });
      } catch {
        throw new Error(err instanceof Error ? err.message : "Could not open PDF");
      }
    }
    const title = doc.getTitle() ?? "";
    const author = doc.getAuthor() ?? "";
    const subject = doc.getSubject() ?? "";
    const creator = doc.getCreator() ?? "";
    const producer = doc.getProducer() ?? "";
    const pages = doc.getPageCount();
    const created = doc.getCreationDate();
    const modified = doc.getModificationDate();
    return {
      stats: [
        { label: "Pages", value: String(pages) },
        { label: "Encrypted", value: encrypted ? "Yes" : "No" },
        { label: "Title", value: title || "—" },
        { label: "Author", value: author || "—" },
        { label: "Subject", value: subject || "—" },
        { label: "Creator", value: creator || "—" },
        { label: "Producer", value: producer || "—" },
        { label: "Created", value: created ? created.toISOString() : "—" },
        { label: "Modified", value: modified ? modified.toISOString() : "—" },
        { label: "Size", value: formatBytes(file.size) },
      ],
      message: "The original file was not modified.",
    };
  }

  if (slug === "protect-pdf") {
    if (!password) throw new Error("Enter a password");
    const src = await PDFDocument.load(await fileBytes(file));
    src.encrypt({ userPassword: password, ownerPassword: password });
    const bytes = await src.save();
    return {
      files: [{ name: `${stemName(file.name)}-protected.pdf`, mime: "application/pdf", blob: pdfBlob(bytes) }],
      message: "Keep this password. Anvil does not store it.",
    };
  }

  if (slug === "unlock-pdf") {
    if (!password) throw new Error("Enter the current password");
    const src = await PDFDocument.load(await fileBytes(file), { password });
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    return {
      files: [{ name: `${stemName(file.name)}-unlocked.pdf`, mime: "application/pdf", blob: pdfBlob(bytes) }],
    };
  }

  if (slug === "compress-pdf") {
    const quality = Number(input.options.quality ?? 0.6);
    const scale = Number(input.options.scale ?? 1.1);
    const pdfjs = await loadPdfJs();
    const data = await fileBytes(file);
    const inspect = pdfjs.getDocument({ data: data.slice(), useSystemFonts: true });
    const srcDoc = await inspect.promise;
    const out = await PDFDocument.create();
    try {
      for (let i = 1; i <= srcDoc.numPages; i += 1) {
        const { blob, width, height } = await renderPageJpeg(pdfjs, data, i, scale, quality);
        const jpg = new Uint8Array(await blob.arrayBuffer());
        const img = await out.embedJpg(jpg);
        const page = out.addPage([width, height]);
        page.drawImage(img, { x: 0, y: 0, width, height });
      }
    } finally {
      await srcDoc.destroy();
    }
    const bytes = await out.save();
    const blob = pdfBlob(bytes);
    const ratio = blob.size / Math.max(1, file.size);
    return {
      files: [{ name: `${stemName(file.name)}-compressed.pdf`, mime: "application/pdf", blob }],
      stats: [
        { label: "Original", value: formatBytes(file.size) },
        { label: "Compressed", value: formatBytes(blob.size) },
        { label: "Ratio", value: `${Math.round(ratio * 100)}%` },
      ],
      message:
        ratio >= 1
          ? "The new file is not smaller. This method helps image-heavy PDFs more than text PDFs."
          : "Text is flattened into images. Keep the original if you need searchable text.",
    };
  }

  if (slug === "pdf-to-jpg") {
    const scale = Number(input.options.scale ?? 1.5);
    const pages = await rasterPages(file, scale, "image/jpeg", 0.86);
    return asZipOrSingle(pages, `${stemName(file.name)}-jpg.zip`);
  }

  if (slug === "pdf-to-png") {
    const scale = Number(input.options.scale ?? 1.5);
    const pages = await rasterPages(file, scale, "image/png");
    return asZipOrSingle(pages, `${stemName(file.name)}-png.zip`);
  }

  if (slug === "jpg-to-pdf" || slug === "png-to-pdf") {
    if (!files.length) throw new Error("Add at least one image");
    const out = await PDFDocument.create();
    for (const imgFile of files) {
      const bytes = await fileBytes(imgFile);
      const img =
        slug === "png-to-pdf" || imgFile.type === "image/png"
          ? await out.embedPng(bytes)
          : await out.embedJpg(bytes);
      const page = out.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
    const bytes = await out.save();
    return {
      files: [{ name: "images.pdf", mime: "application/pdf", blob: pdfBlob(bytes) }],
      stats: [{ label: "Pages", value: String(out.getPageCount()) }],
    };
  }

  throw new Error("Unknown PDF tool");
}
