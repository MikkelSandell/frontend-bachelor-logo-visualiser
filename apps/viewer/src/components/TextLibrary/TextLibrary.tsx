import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { TextEntry } from "../../types";
import { cn } from "../../lib/utils";

interface Props {
  texts: TextEntry[];
  onTextAdded: (entry: TextEntry) => void;
  onTextRemoved: (id: string) => void;
  onTextEdited: (id: string, newText: string) => void;
  assignedTextId?: string | null;
  onAssign?: (textId: string) => void;
}

export function TextLibrary({ texts, onTextAdded, onTextRemoved, onTextEdited, assignedTextId, onAssign }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function handleAdd() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onTextAdded({ id: `text-${Date.now()}`, text: trimmed });
    setInputValue("");
  }

  function startEdit(entry: TextEntry) {
    setEditingId(entry.id);
    setEditValue(entry.text);
  }

  function commitEdit(id: string) {
    const trimmed = editValue.trim();
    if (trimmed) onTextEdited(id, trimmed);
    setEditingId(null);
  }

  const selectable = !!onAssign && texts.length >= 1;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Skriv din tekst…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1"
        />
        <Button variant="outline" size="sm" onClick={handleAdd} disabled={!inputValue.trim()}>
          <Plus className="w-4 h-4 mr-1" />
          Tilføj
        </Button>
      </div>

      {selectable && (
        <p className="text-xs text-muted-foreground">Klik for at vælge · klik den markerede for at fjerne</p>
      )}

      {texts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {texts.map((entry) => {
            const isAssigned = assignedTextId === entry.id;
            return (
              <div
                key={entry.id}
                onClick={() => selectable && onAssign?.(entry.id)}
                className={cn(
                  "group flex items-center gap-1.5 px-3 py-1.5 border-2 rounded-md bg-background text-sm max-w-[200px] transition-all",
                  selectable
                    ? isAssigned
                      ? "border-primary ring-2 ring-primary ring-offset-1 cursor-pointer"
                      : "border-border hover:border-primary/50 cursor-pointer"
                    : "border-border"
                )}
              >
                {editingId === entry.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(entry.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => commitEdit(entry.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="border-none outline-none bg-transparent w-32 text-sm"
                  />
                ) : (
                  <span
                    className="truncate hover:text-primary"
                    onDoubleClick={(e) => { e.stopPropagation(); startEdit(entry); }}
                    title="Dobbeltklik for at redigere"
                  >
                    {entry.text}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onTextRemoved(entry.id); }}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  title="Fjern tekst"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
