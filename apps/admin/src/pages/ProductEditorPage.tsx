import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle, Check, Pencil, Trash2 } from "lucide-react";
import type { Product, PrintZone } from "@logo-visualizer/shared";
import { getMidoceanProduct, createZone, updateZone, deleteZone, fromZoneResponse } from "../api/productApi";
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
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);
  const [deletedZoneIds, setDeletedZoneIds] = useState<string[]>([]);

  // Load product on mount
  useEffect(() => {
    if (!id) return;

    // Reset state when ID changes
    setProduct(null);
    setZones([]);
    setDeletedZoneIds([]);
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

  // Zone handlers — local state only, nothing reaches the backend until handleSave
  function handleZoneCreated(zone: Omit<PrintZone, "id">) {
    setZones((prev) => [...prev, { id: `temp-${Date.now()}`, ...zone }]);
  }

  function handleZoneUpdated(zone: PrintZone) {
    setZones((prev) => prev.map((z) => (z.id === zone.id ? zone : z)));
  }

  function handleZoneDeleted(zoneId: string) {
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
    // Only real zones need a DELETE on the backend — temp zones never existed there
    if (!zoneId.startsWith("temp-")) {
      setDeletedZoneIds((prev) => [...prev, zoneId]);
    }
  }

  async function handleSave() {
    if (saving || !product) return;
    setSaving(true);
    setErrors([]);
    setSuccess(false);

    try {
      // 1. Delete zones that were removed during this session
      for (const id of deletedZoneIds) {
        await deleteZone(product.id, id);
      }

      // 2. Create brand-new zones (those with temp IDs) and collect their real IDs
      const newZones = zones.filter((z) => z.id.startsWith("temp-"));
      const savedNew: PrintZone[] = [];
      for (const zone of newZones) {
        const saved = await createZone(product.id, zone);
        savedNew.push(fromZoneResponse(saved, zone.imageUrl ?? product.imageUrl));
      }

      // 3. Update zones that already existed in the DB
      const existingZones = zones.filter((z) => !z.id.startsWith("temp-"));
      for (const zone of existingZones) {
        await updateZone(product.id, zone.id, zone);
      }

      setZones([...existingZones, ...savedNew]);
      setDeletedZoneIds([]);
      setSuccess(true);
    } catch {
      setErrors(["Der opstod en fejl ved gemning. Prøv igen."]);
    } finally {
      setSaving(false);
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
          <CardTitle>Print-zoner</CardTitle>
          <CardDescription>
            Tegn en ny zone ved at klikke og trække på billedet. Klik på en eksisterende zone og tryk 'Rediger zone' for at ændre den.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZoneEditor
            product={product}
            zones={zones}
            onZoneCreated={handleZoneCreated}
            onZoneUpdated={handleZoneUpdated}
            onZoneDeleted={handleZoneDeleted}
            focusZoneId={focusZoneId}
            onFocusConsumed={() => setFocusZoneId(null)}
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
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Handlinger</th>
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
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFocusZoneId(z.id)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />
                          Rediger
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleZoneDeleted(z.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Slet
                        </Button>
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
