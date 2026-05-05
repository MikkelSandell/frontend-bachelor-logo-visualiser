import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createProduct, parseApiError } from "../api/productApi";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);
const FILE_TYPE_ERROR = "Produktbillede skal være PNG eller JPG.";
const FILE_SIZE_ERROR = "Produktbillede må højst være 10 MB.";

export function CreateProductPage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageWidth, setImageWidth] = useState(1200);
  const [imageHeight, setImageHeight] = useState(1200);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Revoke object URL when component unmounts or when file changes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        const width = Number(image.naturalWidth);
        const height = Number(image.naturalHeight);
        URL.revokeObjectURL(imageUrl);
        if (width > 0 && height > 0) {
          resolve({ width, height });
          return;
        }
        resolve(null);
      };

      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        resolve(null);
      };

      image.src = imageUrl;
    });
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (!file) {
      return;
    }

    const nextErrors: string[] = [];
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      nextErrors.push(FILE_TYPE_ERROR);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      nextErrors.push(FILE_SIZE_ERROR);
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors((prev) =>
      prev.filter((message) => message !== FILE_TYPE_ERROR && message !== FILE_SIZE_ERROR)
    );

    setPreviewUrl(URL.createObjectURL(file));

    const dimensions = await readImageDimensions(file);
    if (dimensions) {
      setImageWidth(dimensions.width);
      setImageHeight(dimensions.height);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: string[] = [];
    if (!title.trim()) {
      nextErrors.push("Titel er påkrævet.");
    }
    if (!imageFile) {
      nextErrors.push("Du skal vælge et produktbillede.");
    }
    if (imageFile && !ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
      nextErrors.push(FILE_TYPE_ERROR);
    }
    if (imageFile && imageFile.size > MAX_IMAGE_BYTES) {
      nextErrors.push(FILE_SIZE_ERROR);
    }
    if (imageWidth <= 0 || imageHeight <= 0) {
      nextErrors.push("Billedbredde og billedhøjde skal være større end 0.");
    }

    if (nextErrors.length > 0 || !imageFile) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors([]);

    try {
      const created = await createProduct({
        title: title.trim(),
        imageFile,
        imageWidth,
        imageHeight,
      });
      navigate(`/products/${created.id}`);
    } catch (error) {
      setErrors(parseApiError(error).messages);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tilbage
        </Button>
        <h1 className="text-2xl font-semibold">Opret produkt</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nyt produkt</CardTitle>
          <CardDescription>
            Udfyld produktmetadata og upload billede for at oprette produktet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="F.eks. Classic T-shirt"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="image">Produktbillede</Label>
              <Input
                id="image"
                type="file"
                accept="image/png,image/jpeg"
                onChange={(event) => {
                  void handleImageChange(event);
                }}
                required
              />
              <p className="text-xs text-muted-foreground">
                PNG eller JPG, maks 10 MB. Billedbredde og -højde udfyldes automatisk når muligt.
              </p>
            </div>

            {/* Image preview + auto-detected dimensions */}
            {previewUrl ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-4">
                <div className="w-20 h-20 rounded-md border border-border bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
                  <img
                    src={previewUrl}
                    alt="Forhåndsvisning"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-sm font-medium truncate">{imageFile?.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {imageWidth} × {imageHeight} px
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {imageFile ? (imageFile.size / 1024).toFixed(0) + " KB" : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-0.5">
                      <Label htmlFor="image-width" className="text-xs">Bredde (px)</Label>
                      <Input
                        id="image-width"
                        type="number"
                        min={1}
                        value={imageWidth}
                        onChange={(event) => setImageWidth(Number(event.target.value))}
                        required
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <Label htmlFor="image-height" className="text-xs">Højde (px)</Label>
                      <Input
                        id="image-height"
                        type="number"
                        min={1}
                        value={imageHeight}
                        onChange={(event) => setImageHeight(Number(event.target.value))}
                        required
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="image-width">Billedbredde (px)</Label>
                  <Input
                    id="image-width"
                    type="number"
                    min={1}
                    value={imageWidth}
                    onChange={(event) => setImageWidth(Number(event.target.value))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="image-height">Billedhøjde (px)</Label>
                  <Input
                    id="image-height"
                    type="number"
                    min={1}
                    value={imageHeight}
                    onChange={(event) => setImageHeight(Number(event.target.value))}
                    required
                  />
                </div>
              </div>
            )}

            {errors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {errors.map((error) => (
                  <p key={error}>• {error}</p>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Opretter..." : "Opret produkt"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/")} disabled={submitting}>
                Annuller
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
