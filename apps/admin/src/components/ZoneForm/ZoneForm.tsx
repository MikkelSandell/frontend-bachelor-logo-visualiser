import { useState } from "react";
import type { PrintTechnique, PrintZone } from "@logo-visualizer/shared";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

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
  onDimensionsChange?: (widthMm: number, heightMm: number) => void;
}

export function ZoneForm({ initial, onSubmit, onCancel, onDimensionsChange }: Props) {
  const [name, setName] = useState(initial.name);
  const [maxW, setMaxW] = useState(initial.maxPhysicalWidthMm);
  const [maxH, setMaxH] = useState(initial.maxPhysicalHeightMm);
  const [techniques, setTechniques] = useState<PrintTechnique[]>(initial.allowedTechniques);
  const [maxColors, setMaxColors] = useState(initial.maxColors);

  function toggleTechnique(t: PrintTechnique) {
    setTechniques((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, maxPhysicalWidthMm: maxW, maxPhysicalHeightMm: maxH, allowedTechniques: techniques, maxColors });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 p-5 border rounded-lg bg-card shadow-sm space-y-4 max-w-sm"
    >
      <h3 className="font-semibold text-base">Konfigurer zone</h3>

      <div className="space-y-1.5">
        <Label htmlFor="zone-name">Navn (f.eks. "Forside")</Label>
        <Input
          id="zone-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Zonenavnet"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="zone-maxw">Maks. bredde (mm)</Label>
          <Input
            id="zone-maxw"
            type="number"
            min={1}
            value={maxW}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMaxW(v);
              onDimensionsChange?.(v, maxH);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-maxh">Maks. højde (mm)</Label>
          <Input
            id="zone-maxh"
            type="number"
            min={1}
            value={maxH}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMaxH(v);
              onDimensionsChange?.(maxW, v);
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tilladte print-teknikker</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {ALL_TECHNIQUES.map((t) => (
            <label
              key={t}
              className="flex items-center gap-2 text-sm cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={techniques.includes(t)}
                onChange={() => toggleTechnique(t)}
                className="accent-primary h-4 w-4 rounded"
              />
              {TECHNIQUE_LABELS[t]}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="zone-colors">Maks. antal farver (0 = ubegrænset)</Label>
        <Input
          id="zone-colors"
          type="number"
          min={0}
          value={maxColors}
          onChange={(e) => setMaxColors(Number(e.target.value))}
          className="max-w-[120px]"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm">Gem zone</Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Annuller
        </Button>
      </div>
    </form>
  );
}
