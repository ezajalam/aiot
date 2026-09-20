import { formatBytes, stemName } from "@/lib/utils";
import type { ToolInput, ToolResult } from "./types";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), mime, quality);
  });
}

function draw(img: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function flattenWhite(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas;
}

async function resultFile(
  original: File,
  blob: Blob,
  name: string,
  extra: ToolResult = {},
): Promise<ToolResult> {
  return {
    files: [{ name, mime: blob.type || "application/octet-stream", blob }],
    stats: [
      { label: "Original", value: formatBytes(original.size) },
      { label: "Output", value: formatBytes(blob.size) },
    ],
    previewUrl: URL.createObjectURL(blob),
    ...extra,
  };
}

export async function cropImageFile(
  file: File,
  box: { x: number; y: number; w: number; h: number },
  mime = "image/png",
  quality = 0.92,
): Promise<ToolResult> {
  const img = await loadImage(file);
  const sx = Math.max(0, Math.round(box.x));
  const sy = Math.max(0, Math.round(box.y));
  const sw = Math.max(1, Math.round(box.w));
  const sh = Math.max(1, Math.round(box.h));
  if (sx + sw > img.naturalWidth || sy + sh > img.naturalHeight) {
    throw new Error("Crop rectangle is outside the image");
  }
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await canvasToBlob(canvas, mime, quality);
  const ext = mime === "image/jpeg" ? "jpg" : "png";
  return resultFile(file, blob, `${stemName(file.name)}-crop.${ext}`);
}

export async function runImageTool(slug: string, input: ToolInput): Promise<ToolResult> {
  const file = input.files[0];
  if (!file) throw new Error("Add an image");
  const img = await loadImage(file);
  const quality = Number(input.options.quality ?? 0.8);

  if (slug === "compress-jpg") {
    const canvas = draw(img, img.naturalWidth, img.naturalHeight);
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    return resultFile(file, blob, `${stemName(file.name)}-compressed.jpg`, {
      message: blob.size >= file.size ? "The new file is not smaller. Try a lower quality." : undefined,
    });
  }

  if (slug === "compress-png") {
    const mode = String(input.options.mode ?? "png");
    if (mode === "jpeg") {
      const canvas = flattenWhite(img);
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      return resultFile(file, blob, `${stemName(file.name)}.jpg`);
    }
    const canvas = draw(img, img.naturalWidth, img.naturalHeight);
    const blob = await canvasToBlob(canvas, "image/png");
    return resultFile(file, blob, `${stemName(file.name)}-reencoded.png`, {
      message:
        blob.size >= file.size
          ? "PNG re-encoding did not shrink this file. Use JPEG mode for photographs."
          : undefined,
    });
  }

  if (slug === "resize-image") {
    const percent = Number(input.options.percent || 0);
    let w = Number(input.options.width || 0);
    let h = Number(input.options.height || 0);
    if (percent > 0) {
      w = img.naturalWidth * (percent / 100);
      h = img.naturalHeight * (percent / 100);
    } else if (w > 0 && h <= 0) {
      h = img.naturalHeight * (w / img.naturalWidth);
    } else if (h > 0 && w <= 0) {
      w = img.naturalWidth * (h / img.naturalHeight);
    } else if (w <= 0 && h <= 0) {
      throw new Error("Enter a width, height, or percent");
    }
    const canvas = draw(img, w, h);
    const mime = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const blob = await canvasToBlob(canvas, mime, 0.9);
    return resultFile(file, blob, `${stemName(file.name)}-${Math.round(w)}x${Math.round(h)}.${ext}`, {
      stats: [
        { label: "Original", value: `${img.naturalWidth}×${img.naturalHeight}` },
        { label: "Resized", value: `${Math.round(w)}×${Math.round(h)}` },
        { label: "Output size", value: formatBytes(blob.size) },
      ],
    });
  }

  if (slug === "jpg-to-png") {
    const canvas = draw(img, img.naturalWidth, img.naturalHeight);
    const blob = await canvasToBlob(canvas, "image/png");
    return resultFile(file, blob, `${stemName(file.name)}.png`);
  }

  if (slug === "png-to-jpg" || slug === "webp-to-jpg") {
    const canvas = flattenWhite(img);
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    return resultFile(file, blob, `${stemName(file.name)}.jpg`);
  }

  if (slug === "jpg-to-webp") {
    const canvas = draw(img, img.naturalWidth, img.naturalHeight);
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    return resultFile(file, blob, `${stemName(file.name)}.webp`);
  }

  throw new Error("Unknown image tool");
}
