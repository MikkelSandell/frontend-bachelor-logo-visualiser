import { useState } from "react";
import type { PrintTechnique, PrintZone } from "@logo-visualizer/shared";
import { cn } from "../../lib/utils";

const TECHNIQUE_LABELS: Record<PrintTechnique, string> = {
  screen_print: "Silketryk",
  embroidery: "Broderi",
  engraving: "Gravering",
  sublimation: "Sublimering",
  digital_print: "Digitaltryk",
  pad_print: "Tampontryk",
};

interface Props {
  zone: PrintZone;
}

export function TechniqueSelector({ zone }: Props) {
  const [selected, setSelected] = useState<PrintTechnique | "">(
    zone.allowedTechniques[0] ?? ""
  );

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Print-teknik</p>
      <div className="flex flex-wrap gap-2">
        {zone.allowedTechniques.map((t) => (
          <button
            key={t}
            onClick={() => setSelected(t)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm border transition-colors",
              selected === t
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-background text-foreground border-input hover:bg-muted"
            )}
          >
            {TECHNIQUE_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
