import { useState } from "react";
import { PRINT_TECHNIQUES, type PrintTechnique, type PrintZone } from "@logo-visualizer/shared";
import { cn } from "../../lib/utils";

const TECHNIQUE_LABELS: Record<PrintTechnique, string> = {
  screen_print: "Silketryk",
  embroidery: "Broderi",
  engraving: "Gravering",
  sublimation: "Sublimering",
  digital_print: "Digitaltryk",
  pad_print: "Tampontryk",
};

const PRINT_TECHNIQUE_SET = new Set<string>(PRINT_TECHNIQUES);

function isPrintTechnique(value: string): value is PrintTechnique {
  return PRINT_TECHNIQUE_SET.has(value);
}

interface Props {
  zone: PrintZone | null;
  disabled?: boolean;
}

export function TechniqueSelector({ zone, disabled = false }: Props) {
  const techniques = zone?.allowedTechniques ?? [];
  const [selected, setSelected] = useState<string>(
    techniques[0] ?? ""
  );

  if (!zone || disabled) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Print-teknik</p>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Vælg en print-zone
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Print-teknik</p>
      <div className="flex flex-wrap gap-2">
        {techniques.map((t) => (
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
            {isPrintTechnique(t) ? TECHNIQUE_LABELS[t] : t}
          </button>
        ))}
      </div>
    </div>
  );
}
