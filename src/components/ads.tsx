import { Badge } from "@/components/ui/badge";

export function AdSlot({
  placement,
  enabled,
  adFree,
}: {
  placement: string;
  enabled: boolean;
  adFree: boolean;
}) {
  if (!enabled || adFree) return null;
  return (
    <aside
      className="my-6 rounded-lg border border-dashed border-border bg-secondary/50 px-4 py-6 text-center"
      aria-label="Advertisement"
    >
      <Badge>Advertisement</Badge>
      <p className="mt-2 text-sm text-muted-foreground">
        {placement} — display inventory only. Ordinary ads are never used as rewards.
      </p>
    </aside>
  );
}
