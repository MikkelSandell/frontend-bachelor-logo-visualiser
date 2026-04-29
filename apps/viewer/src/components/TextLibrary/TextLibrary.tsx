import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { TextEntry } from "../../types";

interface Props {
  texts: TextEntry[];
  onTextAdded: (entry: TextEntry) => void;
  onTextRemoved: (id: string) => void;
  onTextEdited: (id: string, newText: string) => void;
}

export function TextLibrary({ texts, onTextAdded, onTextRemoved, onTextEdited }: Props) {
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

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Tekster</p>
      <div className="flex gap-2">
        <Input
          placeholder="Skriv din tekst…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
        >
          <Plus className="w-4 h-4 mr-1" />
          Tilføj
        </Button>
      </div>

      {texts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {texts.map((entry) => (
            <div
              key={entry.id}
              className="group flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md bg-background text-sm max-w-[200px]"
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
                  className="border-none outline-none bg-transparent w-32 text-sm"
                />
              ) : (
                <span
                  className="truncate cursor-text hover:text-primary"
                  onDoubleClick={() => startEdit(entry)}
                  title="Dobbeltklik for at redigere"
                >
                  {entry.text}
                </span>
              )}
              <button
                onClick={() => onTextRemoved(entry.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                title="Fjern tekst"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
