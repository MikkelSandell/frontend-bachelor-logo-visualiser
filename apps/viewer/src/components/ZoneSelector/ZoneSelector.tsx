import type { PrintZone } from "@logo-visualizer/shared";
import { cn } from "../../lib/utils";

interface Props {
  zones: PrintZone[];
  activeZoneIds: string[];
  focusedZoneId: string | null;
  /** Activate an inactive zone */
  onActivate: (id: string) => void;
  /** Focus an active-but-unfocused zone */
  onFocus: (id: string) => void;
  /** Remove logo from a focused zone */
  onDeactivate: (id: string) => void;
}

export function ZoneSelector({ zones, activeZoneIds, focusedZoneId, onActivate, onFocus, onDeactivate }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Printzoner</p>
      <div className="flex flex-wrap gap-2">
        {zones.map((z) => {
          const isActive = activeZoneIds.includes(z.id);
          const isFocused = focusedZoneId === z.id;
          return (
            <button
              key={z.id}
              onClick={() => {
                if (!isActive) onActivate(z.id);
                else if (isFocused) onDeactivate(z.id);
                else onFocus(z.id);
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
                isFocused
                  ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary ring-offset-1"
                  : isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-input hover:bg-muted"
              )}
            >
              {z.name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Klik for at tilføje · klik igen for at fjerne
      </p>
    </div>
  );
}
