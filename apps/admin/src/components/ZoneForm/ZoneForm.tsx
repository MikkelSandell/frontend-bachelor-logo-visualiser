import { useState } from "react";
import type { PrintTechnique, PrintZone } from "@logo-visualizer/shared";

const ALL_TECHNIQUES: PrintTechnique[] = [
  "screen_print",
  "embroidery",
  "engraving",
  "sublimation",
  "digital_print",
  "pad_print",
];

const TECHNIQUE_LABELS: Record<PrintTechnique, string> = {
  screen_print: "Silketryk",
  embroidery: "Broderi",
  engraving: "Gravering",
  sublimation: "Sublimering",
  digital_print: "Digitaltryk",
  pad_print: "Tampontryk",
};

interface Props {
  initial: Omit<PrintZone, "id">;
  onSubmit: (meta: {
    name: string;
    maxPhysicalWidthMm: number;
    maxPhysicalHeightMm: number;
    allowedTechniques: PrintTechnique[];
    maxColors: number;
  }) => void;
  onCancel: () => void;
}

export function ZoneForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial.name);
  const [maxW, setMaxW] = useState(initial.maxPhysicalWidthMm);
  const [maxH, setMaxH] = useState(initial.maxPhysicalHeightMm);
  const [techniques, setTechniques] = useState<PrintTechnique[]>(
    initial.allowedTechniques
  );
  const [maxColors, setMaxColors] = useState(initial.maxColors);

  function toggleTechnique(t: PrintTechnique) {
    setTechniques((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      maxPhysicalWidthMm: maxW,
      maxPhysicalHeightMm: maxH,
      allowedTechniques: techniques,
      maxColors,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: "1rem",
        padding: "1rem",
        border: "1px solid #ccc",
        maxWidth: 400,
      }}
    >
      <h3>Ny printzone</h3>

      <label>
        Navn (f.eks. "Forside")
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
        />
      </label>

      <label style={{ display: "block", marginTop: "0.75rem" }}>
        Maks. bredde (mm)
        <input
          type="number"
          min={1}
          value={maxW}
          onChange={(e) => setMaxW(Number(e.target.value))}
          style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
        />
      </label>

      <label style={{ display: "block", marginTop: "0.75rem" }}>
        Maks. højde (mm)
        <input
          type="number"
          min={1}
          value={maxH}
          onChange={(e) => setMaxH(Number(e.target.value))}
          style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
        />
      </label>

      <fieldset style={{ marginTop: "0.75rem" }}>
        <legend>Tilladte print-teknikker</legend>
        {ALL_TECHNIQUES.map((t) => (
          <label key={t} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={techniques.includes(t)}
              onChange={() => toggleTechnique(t)}
            />{" "}
            {TECHNIQUE_LABELS[t]}
          </label>
        ))}
      </fieldset>

      <label style={{ display: "block", marginTop: "0.75rem" }}>
        Maks. antal farver (0 = ubegrænset)
        <input
          type="number"
          min={0}
          value={maxColors}
          onChange={(e) => setMaxColors(Number(e.target.value))}
          style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
        />
      </label>

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
        <button type="submit">Gem zone</button>
        <button type="button" onClick={onCancel}>
          Annuller
        </button>
      </div>
    </form>
  );
}
