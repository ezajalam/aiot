import { evaluateExpression, formatNumber } from "./math";
import type { ToolInput, ToolResult } from "./types";

const LENGTH: Record<string, number> = {
  m: 1,
  km: 1000,
  cm: 0.01,
  mm: 0.001,
  mi: 1609.344,
  yd: 0.9144,
  ft: 0.3048,
  in: 0.0254,
};

const MASS: Record<string, number> = {
  kg: 1,
  g: 0.001,
  mg: 0.000001,
  lb: 0.45359237,
  oz: 0.028349523125,
  t: 1000,
};

const VOLUME: Record<string, number> = {
  l: 1,
  ml: 0.001,
  "us-gal": 3.785411784,
  "imp-gal": 4.54609,
  cup: 0.2365882365,
};

const AREA: Record<string, number> = {
  m2: 1,
  km2: 1_000_000,
  ha: 10_000,
  acre: 4046.8564224,
  ft2: 0.09290304,
};

const SPEED: Record<string, number> = {
  "m/s": 1,
  "km/h": 1 / 3.6,
  mph: 0.44704,
  knot: 0.514444,
};

const DATA: Record<string, number> = {
  B: 1,
  KB: 1000,
  MB: 1e6,
  GB: 1e9,
  TB: 1e12,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
  bit: 1 / 8,
  Kbit: 1000 / 8,
  Mbit: 1e6 / 8,
  Gbit: 1e9 / 8,
};

function convertFactor(map: Record<string, number>, value: number, from: string, to: string): number {
  const a = map[from];
  const b = map[to];
  if (a === undefined || b === undefined) throw new Error("Unknown unit");
  return (value * a) / b;
}

function tempToC(value: number, from: string): number {
  if (from === "C") return value;
  if (from === "F") return ((value - 32) * 5) / 9;
  if (from === "K") return value - 273.15;
  throw new Error("Unknown temperature unit");
}

function tempFromC(c: number, to: string): number {
  if (to === "C") return c;
  if (to === "F") return (c * 9) / 5 + 32;
  if (to === "K") return c + 273.15;
  throw new Error("Unknown temperature unit");
}

function parseDate(s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error("Enter a valid date");
  return d;
}

export function runCalc(variant: string, options: Record<string, string | number | boolean>): ToolResult {
  if (variant === "basic" || variant === "scientific") {
    const expr = String(options.expr ?? "");
    const n = evaluateExpression(expr);
    return { stats: [{ label: "Result", value: formatNumber(n) }], text: formatNumber(n) };
  }

  if (variant === "percentage") {
    const mode = String(options.mode ?? "of");
    const a = Number(options.a);
    const b = Number(options.b);
    if (![a, b].every(Number.isFinite)) throw new Error("Enter numeric values");
    if (mode === "of") return { stats: [{ label: `${a}% of ${b}`, value: formatNumber((a / 100) * b) }] };
    if (mode === "is") {
      if (b === 0) throw new Error("Cannot divide by zero");
      return { stats: [{ label: `${a} is what % of ${b}`, value: `${formatNumber((a / b) * 100)}%` }] };
    }
    if (b === 0) throw new Error("Cannot divide by zero");
    return { stats: [{ label: "Change", value: `${formatNumber(((b - a) / a) * 100)}%` }] };
  }

  if (variant === "age") {
    const birth = parseDate(String(options.birth));
    const asOf = options.asOf ? parseDate(String(options.asOf)) : new Date();
    if (asOf < birth) throw new Error("As-of date is before birth");
    let years = asOf.getFullYear() - birth.getFullYear();
    let months = asOf.getMonth() - birth.getMonth();
    let days = asOf.getDate() - birth.getDate();
    if (days < 0) {
      months -= 1;
      const prev = new Date(asOf.getFullYear(), asOf.getMonth(), 0).getDate();
      days += prev;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    const totalDays = Math.floor((asOf.getTime() - birth.getTime()) / 86400000);
    return {
      stats: [
        { label: "Years", value: String(years) },
        { label: "Months", value: String(months) },
        { label: "Days", value: String(days) },
        { label: "Total days", value: String(totalDays) },
      ],
    };
  }

  if (variant === "date") {
    const mode = String(options.mode ?? "add");
    if (mode === "add") {
      const start = parseDate(String(options.start));
      const days = Number(options.days);
      if (!Number.isFinite(days)) throw new Error("Enter a day count");
      const next = new Date(start.getTime() + days * 86400000);
      return { stats: [{ label: "Result", value: next.toISOString().slice(0, 10) }] };
    }
    const a = parseDate(String(options.start));
    const b = parseDate(String(options.end));
    const days = Math.round((b.getTime() - a.getTime()) / 86400000);
    return { stats: [{ label: "Difference (days)", value: String(days) }] };
  }

  if (variant === "time") {
    const mode = String(options.mode ?? "duration");
    if (mode === "clock") {
      const [sh, sm] = String(options.start || "09:00").split(":").map(Number);
      const [eh, em] = String(options.end || "17:00").split(":").map(Number);
      let mins = eh * 60 + em - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      return {
        stats: [
          { label: "Hours", value: String(Math.floor(mins / 60)) },
          { label: "Minutes", value: String(mins % 60) },
        ],
      };
    }
    const h = Number(options.h || 0) + Number(options.h2 || 0);
    const m = Number(options.m || 0) + Number(options.m2 || 0);
    const s = Number(options.s || 0) + Number(options.s2 || 0);
    let total = h * 3600 + m * 60 + s;
    const sign = total < 0 ? "-" : "";
    total = Math.abs(total);
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return { stats: [{ label: "Total", value: `${sign}${hh}h ${mm}m ${ss}s` }] };
  }

  if (variant === "unit") {
    const cat = String(options.cat ?? "length");
    const value = Number(options.value);
    const from = String(options.from);
    const to = String(options.to);
    if (!Number.isFinite(value)) throw new Error("Enter a number");
    let result = 0;
    if (cat === "length") result = convertFactor(LENGTH, value, from, to);
    else if (cat === "mass") result = convertFactor(MASS, value, from, to);
    else if (cat === "volume") result = convertFactor(VOLUME, value, from, to);
    else if (cat === "area") result = convertFactor(AREA, value, from, to);
    else if (cat === "speed") result = convertFactor(SPEED, value, from, to);
    else if (cat === "temp") result = tempFromC(tempToC(value, from), to);
    else throw new Error("Unknown category");
    return { stats: [{ label: "Result", value: `${formatNumber(result)} ${to}` }] };
  }

  if (variant === "data") {
    const value = Number(options.value);
    if (!Number.isFinite(value)) throw new Error("Enter a number");
    const result = convertFactor(DATA, value, String(options.from), String(options.to));
    return { stats: [{ label: "Result", value: formatNumber(result) }] };
  }

  if (variant === "download") {
    const size = Number(options.size);
    const sizeUnit = String(options.sizeUnit ?? "MB");
    const speed = Number(options.speed);
    const speedUnit = String(options.speedUnit ?? "Mbps");
    if (![size, speed].every(Number.isFinite) || speed <= 0) throw new Error("Enter size and a positive speed");
    const bytes = size * (DATA[sizeUnit] ?? 1);
    const bytesPerSec =
      speedUnit === "MB/s" ? speed * 1e6 : speedUnit === "KB/s" ? speed * 1000 : (speed * 1e6) / 8;
    const secs = bytes / bytesPerSec;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.round(secs % 60);
    return {
      stats: [
        { label: "Estimate", value: `${h}h ${m}m ${s}s` },
        { label: "Seconds", value: formatNumber(secs) },
      ],
      message: "Ignores protocol overhead and congestion.",
    };
  }

  throw new Error("Unknown calculator");
}

export async function runCalcTool(slug: string, input: ToolInput): Promise<ToolResult> {
  const variant =
    slug === "calculator"
      ? "basic"
      : slug === "scientific-calculator"
        ? "scientific"
        : slug === "percentage-calculator"
          ? "percentage"
          : slug === "age-calculator"
            ? "age"
            : slug === "date-calculator"
              ? "date"
              : slug === "time-calculator"
                ? "time"
                : slug === "unit-converter"
                  ? "unit"
                  : slug === "data-converter"
                    ? "data"
                    : slug === "download-time"
                      ? "download"
                      : "";
  return runCalc(variant, input.options);
}

export const UNIT_GROUPS = {
  length: Object.keys(LENGTH),
  mass: Object.keys(MASS),
  volume: Object.keys(VOLUME),
  area: Object.keys(AREA),
  speed: Object.keys(SPEED),
  temp: ["C", "F", "K"],
};
