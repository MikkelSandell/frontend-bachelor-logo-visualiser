import { useEffect, useState } from "react";
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

type ZoneMeta = {
  name: string;
  maxPhysicalWidthMm: number;
  maxPhysicalHeightMm: number;
  allowedTechniques: PrintTechnique[];
  maxColors: number;
};

interface Props {
  initial: Omit<PrintZone, "id">;
  onSubmit?: (meta: ZoneMeta) => void;
  onCancel: () => void;
  onDimensionsChange?: (widthMm: number, heightMm: number) => void;
  onChange?: (meta: ZoneMeta) => void;
  onDone?: () => void;
  showSubmit?: boolean;
  forcedWidthMm?: number;
  forcedHeightMm?: number;
}

export function ZoneForm({ initial, onSubmit, onCancel, onDimensionsChange, onChange, onDone, showSubmit = true, forcedWidthMm, forcedHeightMm }: Props) {
  const [name, setName] = useState(initial.name);
  const [maxW, setMaxW] = useState(initial.maxPhysicalWidthMm);
  const [maxH, setMaxH] = useState(initial.maxPhysicalHeightMm);
  const [techniques, setTechniques] = useState<PrintTechnique[]>(initial.allowedTechniques);
  const [maxColors, setMaxColors] = useState(initial.maxColors);

  // Keep mm inputs in sync when the canvas zone is resized externally
  useEffect(() => { if (forcedWidthMm  !== undefined) setMaxW(forcedWidthMm);  }, [forcedWidthMm]);
  useEffect(() => { if (forcedHeightMm !== undefined) setMaxH(forcedHeightMm); }, [forcedHeightMm]);

  function emit(overrides: Partial<ZoneMeta> = {}) {
    onChange?.({ name, maxPhysicalWidthMm: maxW, maxPhysicalHeightMm: maxH, allowedTechniques: techniques, maxColors, ...overrides });
  }

  function toggleTechnique(t: PrintTechnique) {
    setTechniques((prev) => {
      const next = prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t];
      onChange?.({ name, maxPhysicalWidthMm: maxW, maxPhysicalHeightMm: maxH, allowedTechniques: next, maxColors });
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit?.({ name, maxPhysicalWidthMm: maxW, maxPhysicalHeightMm: maxH, allowedTechniques: techniques, maxColors });
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
          onChange={(e) => { setName(e.target.value); emit({ name: e.target.value }); }}
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
              emit({ maxPhysicalWidthMm: v });
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
              emit({ maxPhysicalHeightMm: v });
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
          onChange={(e) => { const v = Number(e.target.value); setMaxColors(v); emit({ maxColors: v }); }}
          className="max-w-[120px]"
        />
      </div>

      <div className="space-y-2 pt-1">
        <div className="flex gap-2">
          {showSubmit && <Button type="submit" size="sm">Gem zone</Button>}
          {onDone && (
            <Button type="button" size="sm" onClick={onDone}>
              Færdig
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Annuller
          </Button>
        </div>
        {onDone && (
          <p className="text-xs text-muted-foreground">
            Ændringer gemmes først når du trykker på "Gem ændringer" nederst på siden.
          </p>
        )}
      </div>
    </form>
  );
}
