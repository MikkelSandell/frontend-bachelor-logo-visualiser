import type { PrintZone } from "@logo-visualizer/shared";
import { cn } from "../../lib/utils";

interface Props {
  zone: PrintZone | null;
  selectedCount?: number;
  onSelect?: (count: number) => void;
}

export function ColorCountSelector({ zone, selectedCount, onSelect }: Props) {
  const max = zone?.maxColors ?? 0;

  if (!zone || max === 0) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Antal farver</p>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {!zone ? "Vælg en print-zone" : "Ingen begrænsning"}
        </div>
      </div>
    );
  }

  const counts = Array.from({ length: max }, (_, i) => i + 1);
  const selected = selectedCount ?? 1;

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">
        Antal farver <span className="text-xs font-normal text-muted-foreground">(maks {max})</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {counts.map((n) => (
          <button
            key={n}
            onClick={() => onSelect?.(n)}
            className={cn(
              "w-8 h-8 rounded-md text-sm border transition-colors font-medium",
              selected === n
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-input hover:bg-muted"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
