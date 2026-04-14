import { useState } from "react";
import type { PrintTechnique, PrintZone } from "@logo-visualizer/shared";

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
    <div>
      <label>
        Print-teknik:&nbsp;
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value as PrintTechnique)}
        >
          {zone.allowedTechniques.map((t) => (
            <option key={t} value={t}>
              {TECHNIQUE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
