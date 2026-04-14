import type { PrintZone } from "@logo-visualizer/shared";

interface Props {
  zones: PrintZone[];
  activeZoneId: string | null;
  onChange: (id: string) => void;
}

export function ZoneSelector({ zones, activeZoneId, onChange }: Props) {
  return (
    <div>
      <label>
        Vælg printzone:&nbsp;
        <select
          value={activeZoneId ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
