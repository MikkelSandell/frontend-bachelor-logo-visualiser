import { useRef, useState } from "react";
import { Loader2, Upload, Wand2, X } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { uploadLogo } from "../../api/viewerApi";
import type { LogoEntry } from "../../types";
import { cn } from "../../lib/utils";

interface Props {
  logos: LogoEntry[];
  onLogoUploaded: (logo: LogoEntry) => void;
  onLogoRemoved: (id: string) => void;
  onLogoUpdated?: (id: string, newUrl: string) => void;
  assignedLogoId?: string | null;
  onAssign?: (logoId: string) => void;
}

const ACCEPTED = "image/png,image/jpeg,image/svg+xml";
const MIN_UPLOAD_BYTES = 1024;

/**
 * Flood-fill background removal.
 * Seeds from all edge pixels, matches the top-left corner colour within a
 * tolerance, and makes every connected matching pixel transparent.
 * Fetches via the Vite proxy so the canvas is never cross-origin tainted.
 */
async function removeBackground(srcUrl: string): Promise<string> {
  const fetchUrl = srcUrl.replace(/^https?:\/\/localhost:\d+/, "");
  const blob = await fetch(fetchUrl).then((r) => r.blob());
  const objectUrl = URL.createObjectURL(blob);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = objectUrl;
  });
  URL.revokeObjectURL(objectUrl);

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return srcUrl;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  // Background colour = top-left corner pixel
  const bgR = d[0], bgG = d[1], bgB = d[2];
  const TOL_SQ = 50 * 50; // Euclidean tolerance per-channel

  const visited = new Uint8Array(w * h);
  const queue: number[] = [];

  function tryEnqueue(idx: number) {
    if (idx < 0 || idx >= w * h || visited[idx]) return;
    const i = idx * 4;
    if (d[i + 3] < 10) { visited[idx] = 1; return; } // already transparent
    const dr = d[i] - bgR, dg = d[i + 1] - bgG, db = d[i + 2] - bgB;
    if (dr * dr + dg * dg + db * db <= TOL_SQ) {
      visited[idx] = 1;
      queue.push(idx);
    }
  }

  // Seed from all four edges
  for (let x = 0; x < w; x++) {
    tryEnqueue(x);
    tryEnqueue((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    tryEnqueue(y * w);
    tryEnqueue(y * w + w - 1);
  }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    d[idx * 4 + 3] = 0; // transparent
    const x = idx % w;
    const y = (idx / w) | 0;
    if (x > 0)     tryEnqueue(idx - 1);
    if (x < w - 1) tryEnqueue(idx + 1);
    if (y > 0)     tryEnqueue(idx - w);
    if (y < h - 1) tryEnqueue(idx + w);
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise<string>((resolve) => {
    canvas.toBlob((b) => {
      resolve(b ? URL.createObjectURL(b) : srcUrl);
    }, "image/png");
  });
}

export function LogoUploader({ logos, onLogoUploaded, onLogoRemoved, onLogoUpdated, assignedLogoId, onAssign }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [removingBgIds, setRemovingBgIds] = useState<Set<string>>(new Set());

  async function handleRemoveBg(logo: LogoEntry) {
    setRemovingBgIds((prev) => new Set(prev).add(logo.id));
    try {
      const newUrl = await removeBackground(logo.url);
      onLogoUpdated?.(logo.id, newUrl);
    } catch {
      // silently fall back to original if removal fails
    } finally {
      setRemovingBgIds((prev) => { const n = new Set(prev); n.delete(logo.id); return n; });
    }
  }

  function parseMessages(error: unknown): string[] {
    if (typeof error === "object" && error !== null) {
      const maybe = error as {
        response?: { data?: { messages?: string[]; message?: string } };
        message?: string;
      };
      const backendMessages = maybe.response?.data?.messages;
      if (Array.isArray(backendMessages) && backendMessages.length > 0) return backendMessages;
      if (maybe.response?.data?.message) return [maybe.response.data.message];
      if (maybe.message) return [maybe.message];
    }
    return ["Ukendt fejl under upload."];
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size < MIN_UPLOAD_BYTES) {
      setUploadSuccess(null);
      setErrorMessages(["Filen er for lille eller ugyldig. Upload venligst et rigtigt PNG, JPG eller SVG-logo."]);
      return;
    }

    setUploading(true);
    setUploadSuccess(null);
    setErrorMessages([]);
    try {
      const response = await uploadLogo(file);
      const data = (response as any).data || response;
      if (data?.logoUrl && data?.logoId) {
        onLogoUploaded({ id: data.logoId, url: data.logoUrl, name: file.name });
        setUploadSuccess("Logo uploadet");
      } else {
        setErrorMessages(["Logo upload fejlede: Manglende felter"]);
      }
    } catch (error) {
      setErrorMessages(parseMessages(error));
    } finally {
      setUploading(false);
    }
  }

  const selectable = !!onAssign && logos.length >= 1;

  if (logos.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          {errorMessages.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 space-y-1">
              {errorMessages.map((message) => <p key={message}>• {message}</p>)}
            </div>
          )}
          {uploadSuccess && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {uploadSuccess}
            </div>
          )}
          <label className="flex flex-col items-center justify-center gap-3 py-8 min-h-[140px] border-2 border-dashed border-primary/30 rounded-lg cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">{uploading ? "Uploader…" : "Upload dit logo"}</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG eller SVG</p>
            </div>
            <span className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border border-input bg-background hover:bg-muted transition-colors">
              {uploading ? "Uploader…" : "Vælg fil"}
            </span>
            <input type="file" accept={ACCEPTED} className="hidden" onChange={handleChange} disabled={uploading} />
          </label>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {errorMessages.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 space-y-1">
          {errorMessages.map((message) => <p key={message}>• {message}</p>)}
        </div>
      )}
      {uploadSuccess && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {uploadSuccess}
        </div>
      )}
      {selectable && (
        <p className="text-xs text-muted-foreground">Klik for at vælge · klik det markerede for at fjerne</p>
      )}
      <div className="flex flex-wrap gap-3 items-start">
        {logos.map((logo) => {
          const isAssigned = assignedLogoId === logo.id;
          const isRemoving = removingBgIds.has(logo.id);
          return (
            <div key={logo.id} className="relative group flex flex-col items-center gap-1" style={{ width: 72 }}>
              {/* Thumbnail */}
              <button
                onClick={() => onAssign?.(logo.id)}
                disabled={!selectable}
                title={selectable ? logo.name : undefined}
                className={cn(
                  "w-[72px] h-[72px] border-2 rounded-md overflow-hidden bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#fff_0%_50%)] bg-[length:12px_12px] flex items-center justify-center transition-all",
                  selectable
                    ? isAssigned
                      ? "border-primary ring-2 ring-primary ring-offset-1 cursor-pointer"
                      : "border-border hover:border-primary/50 cursor-pointer"
                    : "border-border cursor-default"
                )}
              >
                {isRemoving ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <img src={logo.url} alt={logo.name} className="max-w-full max-h-full object-contain p-1" />
                )}
              </button>

              {/* Logo name */}
              <p className="text-xs text-muted-foreground text-center w-full truncate" title={logo.name}>
                {logo.name}
              </p>

              {/* Always-visible background removal button */}
              {onLogoUpdated && (
                <button
                  onClick={() => handleRemoveBg(logo)}
                  disabled={isRemoving}
                  className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-40 disabled:cursor-default"
                >
                  {isRemoving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Wand2 className="w-3 h-3" />
                  )}
                  {isRemoving ? "Fjerner…" : "Fjern baggrund"}
                </button>
              )}

              {/* Remove logo — still hover-only since it's destructive */}
              <button
                onClick={() => onLogoRemoved(logo.id)}
                disabled={uploading}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Fjern logo"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}

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
