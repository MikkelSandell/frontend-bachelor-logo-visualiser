import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle, Check } from "lucide-react";
import type { Product, PrintZone } from "@logo-visualizer/shared";
import { getMidoceanProduct, updateProduct, createZone, updateZone, deleteZone, fromZoneResponse } from "../api/productApi";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { ZoneEditor } from "../components/ZoneEditor/ZoneEditor";

export function ProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // State
  const [product, setProduct] = useState<Product | null>(null);
  const [zones, setZones] = useState<PrintZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  // Load product on mount
  useEffect(() => {
    if (!id) return;

    // Reset state when ID changes
    setProduct(null);
    setZones([]);
    setLoading(true);
    setErrors([]);
    setSuccess(false);

    getMidoceanProduct(id)
      .then((p) => {
        // Sync both product and zones from response
        setProduct(p);
        setZones([...p.printZones]); // Immutable copy
        setErrors([]);
        setSuccess(false);
      })
      .catch((err) => {
        console.error("Failed to load product:", err);
        setProduct(null);
        setZones([]);
        setErrors(["Produktet blev ikke fundet."]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Clear success message after delay
  useEffect(() => {
    if (!success) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSuccess(false), 3000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [success]);

  async function handleSave() {
    // Prevent double-click submissions
    if (saving || !product) return;

    setSaving(true);
    setErrors([]); // Clear previous errors
    setSuccess(false);

    try {
      // Send full product with updated zones
      const payload: Product = {
        id: product.id,
        title: product.title,
        imageUrl: product.imageUrl,
        imageWidth: product.imageWidth,
        imageHeight: product.imageHeight,
        printZones: zones,
      };

      const response = await updateProduct(product.id, payload);

      // Treat backend response as source of truth
      if (response.data) {
        setProduct(response.data);
        setZones([...response.data.printZones]); // Immutable copy
        setErrors([]);
        setSuccess(true);
      }
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = err as any;
      const errorMessages = axiosError?.response?.data?.errors;

      if (Array.isArray(errorMessages) && errorMessages.length > 0) {
        setErrors(errorMessages);
      } else {
        setErrors(["Der opstod en fejl ved gemming. Prøv igen."]);
      }
    } finally {
      setSaving(false);
    }
  }

  // Zone handlers — each saves to DB immediately
  async function handleZoneCreated(zone: Omit<PrintZone, "id">) {
    if (!product) return;
    setSaving(true);
    setErrors([]);
    try {
      const saved = await createZone(product.id, zone);
      setZones((prev) => [...prev, fromZoneResponse(saved, zone.imageUrl ?? product.imageUrl)]);
      setSuccess(true);
    } catch {
      setErrors(["Zonen kunne ikke gemmes. Prøv igen."]);
    } finally {
      setSaving(false);
    }
  }

  async function handleZoneUpdated(zone: PrintZone) {
    if (!product) return;
    setZones((prev) => prev.map((z) => (z.id === zone.id ? zone : z)));
    setSaving(true);
    setErrors([]);
    try {
      await updateZone(product.id, zone.id, zone);
      setSuccess(true);
    } catch {
      setErrors(["Zonen kunne ikke opdateres. Prøv igen."]);
    } finally {
      setSaving(false);
    }
  }

  async function handleZoneDeleted(zoneId: string) {
    if (!product) return;
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
    try {
      await deleteZone(product.id, zoneId);
    } catch {
      setErrors(["Zonen kunne ikke slettes. Prøv igen."]);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Indlæser…
      </div>
    );
  }

  // Not found state
  if (!product) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        Produktet blev ikke fundet.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl pb-32">
      {/* Back + heading */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tilbage
        </Button>
        <h1 className="text-2xl font-semibold">{product.title}</h1>
        <Badge variant="secondary">Midocean</Badge>
      </div>

      {/* Success message */}
      {success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-900">Ændringer gemt</h3>
                <p className="text-sm text-green-800">Produktet er blevet opdateret.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error messages */}
      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-2">Fejl ved gemning</h3>
                <ul className="space-y-1 text-sm text-red-800">
                  {errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zone Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Rediger print-zoner</CardTitle>
          <CardDescription>
            Tegn og rediger zoner direkte på produktbilledet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZoneEditor
            product={product}
            zones={zones}
            onZoneCreated={handleZoneCreated}
            onZoneUpdated={handleZoneUpdated}
            onZoneDeleted={handleZoneDeleted}
          />
        </CardContent>
      </Card>

      {/* Zone List */}
      {zones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Print-zoner ({zones.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Navn</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Position (px)</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Maks. størrelse</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Teknikker</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z, i) => (
                  <tr
                    key={z.id}
                    className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    <td className="px-6 py-3 font-medium">{z.name}</td>
                    <td className="px-6 py-3 text-muted-foreground font-mono text-xs">
                      {z.x},{z.y} — {z.width}×{z.height}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {z.maxPhysicalWidthMm}×{z.maxPhysicalHeightMm} mm
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {z.allowedTechniques.map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Save button – sticky at bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background px-6 py-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saving || !product}
            className="gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Gemmer…" : "Gem ændringer"}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            disabled={saving}
          >
            Annuller
          </Button>
        </div>
      </div>
    </div>
  );
}
