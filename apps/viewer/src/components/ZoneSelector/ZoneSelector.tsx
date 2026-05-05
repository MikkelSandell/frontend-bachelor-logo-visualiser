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
      <div className="space-y-1.5">
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
                "w-full px-3 py-2 rounded-lg text-sm border transition-colors text-left flex items-center justify-between",
                isFocused
                  ? "bg-primary text-primary-foreground border-primary ring-1 ring-primary"
                  : isActive
                  ? "bg-primary/10 text-foreground border-primary"
                  : "bg-background text-foreground border-input hover:bg-muted"
              )}
            >
              <span className="truncate">{z.name}</span>
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  isFocused ? "bg-primary-foreground" : isActive ? "bg-primary" : "bg-border"
                )}
              />
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
