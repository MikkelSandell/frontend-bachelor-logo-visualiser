import type { PrintZone } from "@logo-visualizer/shared";
import type { LogoEntry } from "../../types";
import { cn } from "../../lib/utils";

interface Props {
  logos: LogoEntry[];
  zone: PrintZone;
  assignedLogoId: string | null;
  onAssign: (logoId: string) => void;
}

export function LogoPicker({ logos, zone, assignedLogoId, onAssign }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">
        Logo til <span className="text-muted-foreground">"{zone.name}"</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {logos.map((logo) => {
          const isAssigned = assignedLogoId === logo.id;
          return (
            <button
              key={logo.id}
              onClick={() => onAssign(logo.id)}
              title={logo.name}
              className={cn(
                "w-14 h-14 border-2 rounded-md overflow-hidden bg-muted/30 flex items-center justify-center transition-all",
                isAssigned
                  ? "border-primary ring-2 ring-primary ring-offset-1"
                  : "border-border hover:border-primary/50"
              )}
            >
              <img
                src={logo.url}
                alt={logo.name}
                className="max-w-full max-h-full object-contain p-1"
              />
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Vælg det logo der skal placeres i denne zone
      </p>
    </div>
  );
}
