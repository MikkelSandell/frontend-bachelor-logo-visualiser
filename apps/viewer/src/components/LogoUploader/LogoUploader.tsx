import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { uploadLogo } from "../../api/viewerApi";

interface Props {
  preloadedUrl?: string;
  onLogoReady: (url: string, logoId: string) => void;
}

const ACCEPTED = "image/png,image/jpeg,image/svg+xml";

export function LogoUploader({ preloadedUrl, onLogoReady }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const response = await uploadLogo(file);
      // Backend returns data directly, not wrapped in ApiResponse
      const data = (response as any).data || response;
      if (data?.logoUrl && data?.logoId) {
        onLogoReady(data.logoUrl, data.logoId);
      } else {
        console.error("Upload response missing fields:", response);
        alert(`Logo upload fejlede: Manglende felter`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ukendt fejl';
      console.error("Logo upload fejl:", error);
      alert(`Kunne ikke uploade logo: ${message}`);
    } finally {
      setUploading(false);
    }
  }

  if (preloadedUrl) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Logo forudindlæst</span>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          Skift logo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
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
            <p className="text-sm font-medium">{uploading ? "Uploader…" : "Upload dit logo"}</p>
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
