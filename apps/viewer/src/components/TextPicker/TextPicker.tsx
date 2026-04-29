import type { PrintZone } from "@logo-visualizer/shared";
import type { TextEntry } from "../../types";
import { cn } from "../../lib/utils";

interface Props {
  texts: TextEntry[];
  zone: PrintZone;
  assignedTextId: string | null;
  onAssign: (textId: string) => void;
}

export function TextPicker({ texts, zone, assignedTextId, onAssign }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">
        Tekst til <span className="text-muted-foreground">"{zone.name}"</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {texts.map((entry) => {
          const isAssigned = assignedTextId === entry.id;
          return (
            <button
              key={entry.id}
              onClick={() => onAssign(entry.id)}
              title={entry.text}
              className={cn(
                "px-3 py-1.5 border-2 rounded-md text-sm font-medium transition-all max-w-[180px] truncate",
                isAssigned
                  ? "border-primary ring-2 ring-primary ring-offset-1 bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              {entry.text}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Vælg den tekst der skal placeres i denne zone
      </p>
    </div>
  );
}
