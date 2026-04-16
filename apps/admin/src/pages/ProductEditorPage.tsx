import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Product } from "@logo-visualizer/shared";
import { getMidoceanProduct } from "../api/productApi";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";

export function ProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getMidoceanProduct(id)
      .then(setProduct)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Indlæser…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        Produktet blev ikke fundet.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + heading */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tilbage
        </Button>
        <h1 className="text-2xl font-semibold">{product.title}</h1>
        <Badge variant="secondary">Midocean</Badge>
      </div>

      {/* Product image */}
      <Card>
        <CardHeader>
          <CardTitle>Produktbillede</CardTitle>
          <CardDescription>
            Billede fra første print-position. Dimensioner antages til 1000×1000 px.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-48 h-48 border rounded-lg overflow-hidden bg-muted">
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-full h-full object-contain"
            />
          </div>
        </CardContent>
      </Card>

      {/* Print zones */}
      <Card>
        <CardHeader>
          <CardTitle>Print-zoner ({product.printZones.length})</CardTitle>
          <CardDescription>
            Zoner importeret fra Midocean leverandørdata.
          </CardDescription>
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
              {product.printZones.map((z, i) => (
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
    </div>
  );
}
