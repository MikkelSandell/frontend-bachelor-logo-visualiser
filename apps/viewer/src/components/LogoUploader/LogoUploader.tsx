import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface Props {
  preloadedUrl?: string;
  onLogoReady: (url: string) => void;
}

const ACCEPTED = "image/png,image/jpeg,image/svg+xml";

export function LogoUploader({ preloadedUrl, onLogoReady }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Create a local object URL — no backend round-trip needed for canvas preview
    const objectUrl = URL.createObjectURL(file);
    onLogoReady(objectUrl);
  }

  if (preloadedUrl) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Logo forudindlæst</span>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Skift logo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={handleChange}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <label className="flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Upload dit logo</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG eller SVG</p>
          </div>
          <span className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border border-input bg-background hover:bg-muted transition-colors">
            Vælg fil
          </span>
          <input
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={handleChange}
          />
        </label>
      </CardContent>
    </Card>
  );
}
