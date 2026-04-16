import type { PrintZone } from "@logo-visualizer/shared";
import { cn } from "../../lib/utils";

interface Props {
  zones: PrintZone[];
  activeZoneId: string | null;
  onChange: (id: string) => void;
}

export function ZoneSelector({ zones, activeZoneId, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Vælg printzone</p>
      <div className="flex flex-wrap gap-2">
        {zones.map((z) => (
          <button
            key={z.id}
            onClick={() => onChange(z.id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
              activeZoneId === z.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-input hover:bg-muted"
            )}
          >
            {z.name}
          </button>
        ))}
      </div>
    </div>
  );
}
