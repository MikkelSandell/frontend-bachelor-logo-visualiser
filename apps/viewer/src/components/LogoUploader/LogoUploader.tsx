import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { uploadLogo } from "../../api/viewerApi";
import type { LogoEntry } from "../../types";

interface Props {
  logos: LogoEntry[];
  onLogoUploaded: (logo: LogoEntry) => void;
  onLogoRemoved: (id: string) => void;
}

const ACCEPTED = "image/png,image/jpeg,image/svg+xml";

export function LogoUploader({ logos, onLogoUploaded, onLogoRemoved }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      const response = await uploadLogo(file);
      const data = (response as any).data || response;
      if (data?.logoUrl && data?.logoId) {
        onLogoUploaded({ id: data.logoId, url: data.logoUrl, name: file.name });
      } else {
        alert("Logo upload fejlede: Manglende felter");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ukendt fejl";
      alert(`Kunne ikke uploade logo: ${message}`);
    } finally {
      setUploading(false);
    }
  }

  // No logos yet — show the upload card
  if (logos.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <label className="flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {uploading ? "Uploader…" : "Upload dit logo"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG eller SVG</p>
            </div>
            <span className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border border-input bg-background hover:bg-muted transition-colors">
              {uploading ? "Uploader…" : "Vælg fil"}
            </span>
            <input
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={handleChange}
              disabled={uploading}
            />
          </label>
        </CardContent>
      </Card>
    );
  }

  // Logos exist — show logo library
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Logoer</p>
      <div className="flex flex-wrap gap-2 items-start">
        {logos.map((logo) => (
          <div key={logo.id} className="relative group">
            <div className="w-16 h-16 border border-border rounded-md overflow-hidden bg-muted/30 flex items-center justify-center">
              <img
                src={logo.url}
                alt={logo.name}
                className="max-w-full max-h-full object-contain p-1"
              />
            </div>
            <p
              className="text-xs text-muted-foreground text-center w-16 truncate mt-0.5"
              title={logo.name}
            >
              {logo.name}
            </p>
            <button
              onClick={() => onLogoRemoved(logo.id)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Fjern logo"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}

        {/* Add logo button */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-16 h-16 border-2 border-dashed border-border rounded-md flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors disabled:opacity-50"
          title="Tilføj logo"
        >
          <Upload className="w-4 h-4" />
          <span className="text-xs">{uploading ? "…" : "Tilføj"}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
        />
      </div>
    </div>
  );
}
