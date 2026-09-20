import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, Download, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cropImageFile } from "@/lib/tools/image";
import { runTool } from "@/lib/tools/run";
import { convertColor } from "@/lib/tools/generate";
import { evaluateExpression, formatNumber } from "@/lib/tools/math";
import { UNIT_GROUPS, runCalc } from "@/lib/tools/calc";
import { getTool } from "@/lib/tools/registry";
import type { ToolDef, ToolInput, ToolOption, ToolResult } from "@/lib/tools/types";
import { downloadBlob, formatBytes } from "@/lib/utils";
import { guestSnapshot, reserveGuest, rollbackGuest } from "@/lib/billing/guest";
import { finishUsage, reserveUsage } from "@/lib/server/app";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

function defaults(options: ToolOption[] | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const opt of options ?? []) {
    if (opt.default !== undefined) out[opt.key] = opt.default;
  }
  return out;
}

function optionDefaults(tool: ToolDef): Record<string, string | number | boolean> {
  const ui = tool.ui;
  if (ui.kind === "files" || ui.kind === "text" || ui.kind === "generate") return defaults(ui.options);
  if (ui.kind === "form") return defaults(ui.fields);
  return {};
}

export function ToolWorkspace({
  tool,
  seoEnabled,
  onRan,
}: {
  tool: ToolDef;
  seoEnabled: boolean;
  onRan?: () => void;
}) {
  const { user, isPending } = useCurrentUserState();
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [options, setOptions] = useState(() => optionDefaults(tool));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFiles([]);
    setText("");
    setResult(null);
    setError(null);
    const ui = tool.ui;
    const opts = ui.kind === "form" ? ui.fields : ui.kind === "files" || ui.kind === "text" || ui.kind === "generate" ? ui.options : undefined;
    setOptions(defaults(opts));
  }, [tool.slug]);

  async function consumeThen(run: () => Promise<ToolResult>) {
    setBusy(true);
    setError(null);
    let eventId: number | null = null;
    let guest = false;
    try {
      if (!isPending && user) {
        const res = await reserveUsage({ data: tool.slug });
        eventId = res.eventId;
      } else {
        const g = reserveGuest();
        if (!g.allowed) throw new Error("Guest daily limit reached. Sign in for a monthly allowance.");
        guest = true;
      }
      const out = await run();
      setResult(out);
      if (eventId) await finishUsage({ data: { eventId, ok: true } });
      onRan?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(message);
      if (eventId) await finishUsage({ data: { eventId, ok: false } });
      if (guest) rollbackGuest();
    } finally {
      setBusy(false);
    }
  }

  const related = tool.related.map((s) => getTool(s)).filter(Boolean) as ToolDef[];

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        {tool.ui.kind === "files" ? (
          <FilePanel
            tool={tool}
            files={files}
            setFiles={setFiles}
            options={options}
            setOptions={setOptions}
            extraText={text}
            setExtraText={setText}
          />
        ) : null}
        {tool.ui.kind === "text" ? (
          <div className="space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={tool.ui.placeholder}
              rows={tool.ui.rows ?? 10}
            />
            <OptionFields options={tool.ui.options} values={options} onChange={setOptions} />
          </div>
        ) : null}
        {tool.ui.kind === "generate" || tool.ui.kind === "form" ? (
          <OptionFields
            options={tool.ui.kind === "form" ? tool.ui.fields : tool.ui.options}
            values={options}
            onChange={setOptions}
          />
        ) : null}
        {tool.ui.kind === "calc" ? (
          <CalcPanel variant={tool.ui.variant} options={options} setOptions={setOptions} />
        ) : null}
        {tool.ui.kind === "color" ? <ColorPanel options={options} setOptions={setOptions} /> : null}
        {tool.ui.kind === "crop" ? (
          <CropPanel
            file={files[0] ?? null}
            setFile={(f) => setFiles(f ? [f] : [])}
            busy={busy}
            onCrop={(file, box) => consumeThen(() => cropImageFile(file, box))}
          />
        ) : null}

        {tool.ui.kind !== "crop" ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                consumeThen(() =>
                  runTool(tool.slug, {
                    files,
                    text,
                    options,
                  } satisfies ToolInput),
                )
              }
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Working…" : "Run"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFiles([]);
                setText("");
                setResult(null);
                setError(null);
              }}
            >
              Reset
            </Button>
            <UsageHint signedIn={Boolean(user)} pending={isPending} />
          </div>
        ) : null}
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </div>

      {result ? <ResultCard result={result} /> : null}

      <section className="grid gap-8 lg:grid-cols-3">
        <article className="lg:col-span-2 space-y-6">
          <Block title="How to use">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {tool.instructions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </Block>
          <Block title="Examples">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {tool.examples.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Block>
          <Block title="Limitations">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {tool.limitations.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Block>
          <Block title="Privacy">
            <p className="text-sm text-muted-foreground">
              This tool runs in your browser. Anvil meters usage for fairness but does not receive the file contents.
            </p>
          </Block>
          <Block title="Questions">
            <dl className="space-y-4">
              {tool.faqs.map((f) => (
                <div key={f.q}>
                  <dt className="text-sm font-medium">{f.q}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
          </Block>
        </article>
        <aside className="space-y-3">
          <h2 className="font-serif text-2xl">Related</h2>
          {related.map((r) =>
            r.seo && !seoEnabled ? null : (
              <Link
                key={r.slug}
                to="/tools/$slug"
                params={{ slug: r.slug }}
                className="block rounded-lg border border-border bg-card p-4 hover:border-primary/40"
              >
                <p className="font-medium">{r.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.summary}</p>
              </Link>
            ),
          )}
        </aside>
      </section>
    </div>
  );
}

function UsageHint({ signedIn, pending }: { signedIn: boolean; pending: boolean }) {
  const [guest, setGuest] = useState(() => (typeof window === "undefined" ? null : guestSnapshot()));
  useEffect(() => {
    setGuest(guestSnapshot());
  }, []);
  if (pending) return <span className="text-sm text-muted-foreground">Checking allowance…</span>;
  if (signedIn) return <span className="text-sm text-muted-foreground">Signed-in usage is counted on your plan.</span>;
  if (!guest) return null;
  return (
    <span className="text-sm text-muted-foreground">
      Guest {guest.used}/{guest.limit ?? 10} today
    </span>
  );
}

function FilePanel({
  tool,
  files,
  setFiles,
  options,
  setOptions,
  extraText,
  setExtraText,
}: {
  tool: ToolDef;
  files: File[];
  setFiles: (f: File[]) => void;
  options: Record<string, string | number | boolean>;
  setOptions: (v: Record<string, string | number | boolean>) => void;
  extraText: string;
  setExtraText: (s: string) => void;
}) {
  const ui = tool.ui.kind === "files" ? tool.ui : null;
  if (!ui) return null;
  return (
    <div className="space-y-4">
      <DropZone accept={ui.accept} multiple={ui.multiple} files={files} setFiles={setFiles} maxFiles={ui.maxFiles ?? 8} />
      <OptionFields
        options={ui.options}
        values={{ ...options, text: extraText }}
        onChange={(next) => {
          if (typeof next.text === "string") setExtraText(next.text);
          const { text: _t, ...rest } = next;
          setOptions(rest);
        }}
      />
    </div>
  );
}

function DropZone({
  accept,
  multiple,
  files,
  setFiles,
  maxFiles,
}: {
  accept: string;
  multiple?: boolean;
  files: File[];
  setFiles: (f: File[]) => void;
  maxFiles: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  function add(list: FileList | File[]) {
    const next = [...files, ...Array.from(list)];
    setFiles(multiple ? next.slice(0, maxFiles) : next.slice(0, 1));
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) add(e.dataTransfer.files);
        }}
        className={`flex min-h-40 w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition-colors ${
          over ? "border-primary bg-secondary" : "border-border bg-background"
        }`}
      >
        <Upload className="size-5 text-muted-foreground" />
        <p className="mt-2 text-sm">Drop files here or browse</p>
        <p className="mt-1 text-xs text-muted-foreground">Stays on this device. 25 MB max per file.</p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) add(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length ? (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm">
              <span className="truncate">
                {f.name} <span className="text-muted-foreground">({formatBytes(f.size)})</span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function OptionFields({
  options,
  values,
  onChange,
}: {
  options?: ToolOption[];
  values: Record<string, string | number | boolean>;
  onChange: (v: Record<string, string | number | boolean>) => void;
}) {
  if (!options?.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((opt) => (
        <label key={opt.key} className="block space-y-1.5 sm:col-span-2 sm:[&:not(:has(textarea))]:col-span-1">
          <span className="text-sm font-medium">{opt.label}</span>
          {opt.type === "textarea" ? (
            <Textarea
              value={String(values[opt.key] ?? "")}
              placeholder={opt.placeholder}
              onChange={(e) => onChange({ ...values, [opt.key]: e.target.value })}
            />
          ) : opt.type === "boolean" ? (
            <span className="flex h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(values[opt.key])}
                onChange={(e) => onChange({ ...values, [opt.key]: e.target.checked })}
                className="size-4 accent-primary"
              />
              <span className="text-sm text-muted-foreground">Enabled</span>
            </span>
          ) : opt.type === "select" ? (
            <select
              className="flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={String(values[opt.key] ?? "")}
              onChange={(e) => onChange({ ...values, [opt.key]: e.target.value })}
            >
              {opt.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : opt.type === "range" ? (
            <span className="flex items-center gap-3">
              <input
                type="range"
                min={opt.min}
                max={opt.max}
                step={opt.step}
                value={Number(values[opt.key] ?? opt.default ?? 0)}
                onChange={(e) => onChange({ ...values, [opt.key]: Number(e.target.value) })}
                className="w-full accent-primary"
              />
              <span className="w-12 tabular-nums text-sm">{values[opt.key]}</span>
            </span>
          ) : (
            <Input
              type={opt.type === "number" ? "number" : "text"}
              min={opt.min}
              max={opt.max}
              step={opt.step}
              placeholder={opt.placeholder}
              value={values[opt.key] === undefined ? "" : String(values[opt.key])}
              onChange={(e) =>
                onChange({
                  ...values,
                  [opt.key]: opt.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value,
                })
              }
            />
          )}
          {opt.help ? <span className="block text-xs text-muted-foreground">{opt.help}</span> : null}
        </label>
      ))}
    </div>
  );
}

function ResultCard({ result }: { result: ToolResult }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Result</h2>
        {result.text ? <CopyButton text={result.text} /> : null}
      </div>
      {result.message ? <p className="mt-2 text-sm text-muted-foreground">{result.message}</p> : null}
      {result.stats?.length ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {result.stats.map((s) => (
            <div key={s.label} className="rounded-md bg-secondary px-3 py-2">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="break-all font-mono text-sm">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {result.previewUrl && result.previewUrl.startsWith("#") ? (
        <div className="mt-4 h-20 w-full rounded-md border border-border" style={{ background: result.previewUrl }} />
      ) : result.previewUrl ? (
        <img src={result.previewUrl} alt="Result preview" className="mt-4 max-h-72 rounded-md border border-border" />
      ) : null}
      {result.text ? (
        <pre className="mt-4 max-h-80 overflow-auto rounded-md bg-secondary p-3 font-mono text-xs whitespace-pre-wrap">
          {result.text}
        </pre>
      ) : null}
      {result.files?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {result.files.map((f) => (
            <Button key={f.name} type="button" variant="outline" onClick={() => downloadBlob(f.blob, f.name)}>
              <Download className="size-4" />
              {f.name}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setOk(true);
        window.setTimeout(() => setOk(false), 1200);
      }}
    >
      {ok ? <Check className="size-4" /> : <Copy className="size-4" />}
      {ok ? "Copied" : "Copy"}
    </Button>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ColorPanel({
  options,
  setOptions,
}: {
  options: Record<string, string | number | boolean>;
  setOptions: (v: Record<string, string | number | boolean>) => void;
}) {
  const value = String(options.color ?? "#0f6e6b");
  const preview = useMemo(() => {
    try {
      return convertColor(value);
    } catch {
      return null;
    }
  }, [value]);
  return (
    <div className="space-y-3">
      <Label htmlFor="color">Color</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={preview?.text ?? "#0f6e6b"}
          onChange={(e) => setOptions({ ...options, color: e.target.value })}
          className="h-11 w-14 rounded-md border border-border bg-card"
          aria-label="Pick color"
        />
        <Input
          id="color"
          value={value}
          onChange={(e) => setOptions({ ...options, color: e.target.value })}
          placeholder="#0f6e6b"
        />
      </div>
    </div>
  );
}

function CalcPanel({
  variant,
  options,
  setOptions,
}: {
  variant: string;
  options: Record<string, string | number | boolean>;
  setOptions: (v: Record<string, string | number | boolean>) => void;
}) {
  if (variant === "basic" || variant === "scientific") {
    return <Keypad options={options} setOptions={setOptions} scientific={variant === "scientific"} />;
  }
  if (variant === "percentage") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <select
          className="h-11 rounded-md border border-input bg-card px-3 text-sm"
          value={String(options.mode ?? "of")}
          onChange={(e) => setOptions({ ...options, mode: e.target.value })}
        >
          <option value="of">What is x% of y</option>
          <option value="is">x is what % of y</option>
          <option value="change">% change x → y</option>
        </select>
        <Input
          type="number"
          placeholder="x"
          value={String(options.a ?? "")}
          onChange={(e) => setOptions({ ...options, a: Number(e.target.value) })}
        />
        <Input
          type="number"
          placeholder="y"
          value={String(options.b ?? "")}
          onChange={(e) => setOptions({ ...options, b: Number(e.target.value) })}
        />
      </div>
    );
  }
  if (variant === "age") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">Birth date</span>
          <Input type="date" onChange={(e) => setOptions({ ...options, birth: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">As of (optional)</span>
          <Input type="date" onChange={(e) => setOptions({ ...options, asOf: e.target.value })} />
        </label>
      </div>
    );
  }
  if (variant === "date") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <select
          className="h-11 rounded-md border border-input bg-card px-3 text-sm"
          value={String(options.mode ?? "add")}
          onChange={(e) => setOptions({ ...options, mode: e.target.value })}
        >
          <option value="add">Add days</option>
          <option value="diff">Difference</option>
        </select>
        <Input type="date" onChange={(e) => setOptions({ ...options, start: e.target.value })} />
        {String(options.mode ?? "add") === "add" ? (
          <Input
            type="number"
            placeholder="Days"
            onChange={(e) => setOptions({ ...options, days: Number(e.target.value) })}
          />
        ) : (
          <Input type="date" onChange={(e) => setOptions({ ...options, end: e.target.value })} />
        )}
      </div>
    );
  }
  if (variant === "time") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          className="h-11 rounded-md border border-input bg-card px-3 text-sm"
          value={String(options.mode ?? "duration")}
          onChange={(e) => setOptions({ ...options, mode: e.target.value })}
        >
          <option value="duration">Add durations</option>
          <option value="clock">Clock difference</option>
        </select>
        {String(options.mode ?? "duration") === "clock" ? (
          <>
            <Input type="time" onChange={(e) => setOptions({ ...options, start: e.target.value })} />
            <Input type="time" onChange={(e) => setOptions({ ...options, end: e.target.value })} />
          </>
        ) : (
          <>
            <Input type="number" placeholder="Hours" onChange={(e) => setOptions({ ...options, h: Number(e.target.value) })} />
            <Input type="number" placeholder="Minutes" onChange={(e) => setOptions({ ...options, m: Number(e.target.value) })} />
            <Input type="number" placeholder="Hours to add" onChange={(e) => setOptions({ ...options, h2: Number(e.target.value) })} />
            <Input type="number" placeholder="Minutes to add" onChange={(e) => setOptions({ ...options, m2: Number(e.target.value) })} />
          </>
        )}
      </div>
    );
  }
  if (variant === "unit") {
    const cat = String(options.cat ?? "length") as keyof typeof UNIT_GROUPS;
    const units = UNIT_GROUPS[cat] ?? UNIT_GROUPS.length;
    return (
      <div className="grid gap-3 sm:grid-cols-4">
        <select
          className="h-11 rounded-md border border-input bg-card px-3 text-sm"
          value={cat}
          onChange={(e) => setOptions({ ...options, cat: e.target.value, from: UNIT_GROUPS[e.target.value as keyof typeof UNIT_GROUPS][0]!, to: UNIT_GROUPS[e.target.value as keyof typeof UNIT_GROUPS][1]! })}
        >
          {Object.keys(UNIT_GROUPS).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <Input type="number" placeholder="Value" onChange={(e) => setOptions({ ...options, value: Number(e.target.value) })} />
        <select className="h-11 rounded-md border border-input bg-card px-3 text-sm" value={String(options.from ?? units[0])} onChange={(e) => setOptions({ ...options, from: e.target.value })}>
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <select className="h-11 rounded-md border border-input bg-card px-3 text-sm" value={String(options.to ?? units[1])} onChange={(e) => setOptions({ ...options, to: e.target.value })}>
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>
    );
  }
  if (variant === "data") {
    const units = ["B", "KB", "KiB", "MB", "MiB", "GB", "GiB", "TB", "bit", "Mbit"];
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <Input type="number" placeholder="Size" onChange={(e) => setOptions({ ...options, value: Number(e.target.value) })} />
        <select className="h-11 rounded-md border border-input bg-card px-3 text-sm" defaultValue="MB" onChange={(e) => setOptions({ ...options, from: e.target.value })}>
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <select className="h-11 rounded-md border border-input bg-card px-3 text-sm" defaultValue="GiB" onChange={(e) => setOptions({ ...options, to: e.target.value })}>
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>
    );
  }
  if (variant === "download") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Input type="number" placeholder="File size" onChange={(e) => setOptions({ ...options, size: Number(e.target.value) })} />
        <select className="h-11 rounded-md border border-input bg-card px-3 text-sm" defaultValue="GB" onChange={(e) => setOptions({ ...options, sizeUnit: e.target.value })}>
          <option>MB</option>
          <option>GB</option>
          <option>GiB</option>
        </select>
        <Input type="number" placeholder="Speed" onChange={(e) => setOptions({ ...options, speed: Number(e.target.value) })} />
        <select className="h-11 rounded-md border border-input bg-card px-3 text-sm" defaultValue="Mbps" onChange={(e) => setOptions({ ...options, speedUnit: e.target.value })}>
          <option>Mbps</option>
          <option>MB/s</option>
          <option>KB/s</option>
        </select>
      </div>
    );
  }
  return null;
}

function Keypad({
  options,
  setOptions,
  scientific,
}: {
  options: Record<string, string | number | boolean>;
  setOptions: (v: Record<string, string | number | boolean>) => void;
  scientific: boolean;
}) {
  const expr = String(options.expr ?? "");
  const [live, setLive] = useState("");
  useEffect(() => {
    try {
      setLive(expr ? formatNumber(evaluateExpression(expr)) : "");
    } catch {
      setLive("");
    }
  }, [expr]);
  const keys = scientific
    ? ["sin(", "cos(", "tan(", "sqrt(", "ln(", "log(", "pi", "e", "(", ")", "^", "!", "7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "%", "+"]
    : ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "%", "+"];
  return (
    <div>
      <Input
        value={expr}
        onChange={(e) => setOptions({ ...options, expr: e.target.value })}
        placeholder="Expression"
        className="font-mono"
      />
      {live ? <p className="mt-2 font-mono text-sm text-muted-foreground">{live}</p> : null}
      <div className={`mt-3 grid gap-2 ${scientific ? "grid-cols-4 sm:grid-cols-8" : "grid-cols-4"}`}>
        {keys.map((k) => (
          <Button
            key={k}
            type="button"
            variant="secondary"
            onClick={() => setOptions({ ...options, expr: expr + k })}
          >
            {k}
          </Button>
        ))}
        <Button type="button" variant="outline" onClick={() => setOptions({ ...options, expr: expr.slice(0, -1) })}>
          Del
        </Button>
        <Button type="button" variant="outline" onClick={() => setOptions({ ...options, expr: "" })}>
          AC
        </Button>
      </div>
    </div>
  );
}

function CropPanel({
  file,
  setFile,
  busy,
  onCrop,
}: {
  file: File | null;
  setFile: (f: File | null) => void;
  busy: boolean;
  onCrop: (file: File, box: { x: number; y: number; w: number; h: number }) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState({ x: 10, y: 10, w: 80, h: 80 });
  const drag = useRef<{ px: number; py: number; sx: number; sy: number } | null>(null);
  return (
    <div className="space-y-4">
      <DropZone accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" files={file ? [file] : []} setFiles={(f) => setFile(f[0] ?? null)} maxFiles={1} />
      {file ? (
        <div
          className="relative inline-block max-w-full overflow-hidden rounded-md border border-border"
          onMouseDown={(e) => {
            const rect = imgRef.current?.getBoundingClientRect();
            if (!rect) return;
            drag.current = { px: e.clientX, py: e.clientY, sx: box.x, sy: box.y };
          }}
          onMouseMove={(e) => {
            if (!drag.current || !imgRef.current) return;
            const rect = imgRef.current.getBoundingClientRect();
            const dx = ((e.clientX - drag.current.px) / rect.width) * 100;
            const dy = ((e.clientY - drag.current.py) / rect.height) * 100;
            setBox((b) => ({
              ...b,
              x: Math.min(100 - b.w, Math.max(0, drag.current!.sx + dx)),
              y: Math.min(100 - b.h, Math.max(0, drag.current!.sy + dy)),
            }));
          }}
          onMouseUp={() => {
            drag.current = null;
          }}
          onMouseLeave={() => {
            drag.current = null;
          }}
        >
          <img ref={imgRef} src={URL.createObjectURL(file)} alt="Crop source" className="max-h-96 max-w-full" />
          <div
            className="absolute border-2 border-primary bg-primary/10"
            style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
          />
        </div>
      ) : null}
      <div className="flex gap-3">
        <Button
          type="button"
          disabled={!file || busy}
          onClick={() => {
            if (!file || !imgRef.current) return;
            const img = imgRef.current;
            onCrop(file, {
              x: (box.x / 100) * img.naturalWidth,
              y: (box.y / 100) * img.naturalHeight,
              w: (box.w / 100) * img.naturalWidth,
              h: (box.h / 100) * img.naturalHeight,
            });
          }}
        >
          {busy ? "Working…" : "Crop"}
        </Button>
        <UsageHint signedIn={false} pending={false} />
      </div>
    </div>
  );
}

void runCalc;
void Badge;
