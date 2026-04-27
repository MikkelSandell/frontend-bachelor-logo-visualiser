import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, Plus, Search } from "lucide-react";
import type { Product } from "@logo-visualizer/shared";
import { getProducts, importProducts, parseApiError } from "../api/productApi";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

type ProductWithStatus = Product & {
  status?: "FullyConfigured" | "MissingZones" | "MissingMetadata" | number | string;
};

function getProductStatus(product: Product): "FullyConfigured" | "MissingZones" | "MissingMetadata" {
  // Backend may send the enum as a string name or as an integer index.
  const raw = (product as ProductWithStatus).status;
  if (raw === "FullyConfigured" || raw === 0 || raw === "0") return "FullyConfigured";
  if (raw === "MissingZones"    || raw === 1 || raw === "1") return "MissingZones";
  if (raw === "MissingMetadata" || raw === 2 || raw === "2") return "MissingMetadata";

  if (!product.title.trim() || !product.imageUrl || product.imageWidth <= 0 || product.imageHeight <= 0) {
    return "MissingMetadata";
  }

  if (!product.printZones || product.printZones.length === 0) {
    return "MissingZones";
  }

  return "FullyConfigured";
}

function statusVariant(status: ReturnType<typeof getProductStatus>): "default" | "secondary" | "destructive" {
  if (status === "FullyConfigured") return "default";
  if (status === "MissingZones") return "secondary";
  return "destructive";
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [imageErrorIds, setImageErrorIds] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  async function loadProducts() {
    setLoading(true);
    try {
      setProducts(await getProducts());
      setErrors([]);
    } catch (error) {
      setErrors(parseApiError(error).messages);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  async function handleImport(file: File) {
    if (importing) return;
    setImporting(true);
    try {
      const imported = await importProducts(file);
      await loadProducts();
      setErrors([]);
      if (imported.length > 0) {
        setSuccessMessage(`Import gennemført: ${imported.length} produkter.`);
      } else {
        setSuccessMessage("Import gennemført.");
      }
    } catch (error) {
      setErrors(parseApiError(error).messages);
      setSuccessMessage(null);
    } finally {
      setImporting(false);
    }
  }

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Indlæser produkter…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Produkter</h1>
        <div className="flex items-center gap-2">
          <input
            id="products-import-input"
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleImport(file);
              }
              event.currentTarget.value = "";
            }}
          />

          <Button
            variant="outline"
            onClick={() => document.getElementById("products-import-input")?.click()}
            disabled={importing}
            className="gap-2"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Import JSON
          </Button>

          <Button onClick={() => navigate("/products/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            Opret produkt
          </Button>

          <Badge variant="secondary">
            {search ? `${filtered.length} / ${products.length}` : products.length} produkter
          </Badge>
        </div>
      </div>

      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-sm text-red-800 space-y-1">
            {errors.map((error) => (
              <p key={error}>• {error}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 text-sm text-green-800">
            {successMessage}
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Søg på produktnavn…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-muted-foreground">
            Produktoversigt
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Produkt</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Zoner</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground text-sm">
                    Ingen produkter matcher "{search}"
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md border bg-muted overflow-hidden flex-shrink-0">
                          {imageErrorIds[p.id] ? (
                            <div className="h-full w-full grid place-items-center text-[10px] text-muted-foreground">
                              Intet billede
                            </div>
                          ) : (
                            <img
                              src={p.imageUrl}
                              alt={p.title}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-contain"
                              onError={() =>
                                setImageErrorIds((current) =>
                                  current[p.id] ? current : { ...current, [p.id]: true }
                                )
                              }
                            />
                          )}
                        </div>
                        <span className="font-medium">{p.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground font-mono text-xs">{p.id}</td>
                    <td className="px-6 py-3 text-muted-foreground">{p.printZones.length}</td>
                    <td className="px-6 py-3">
                      <Badge variant={statusVariant(getProductStatus(p))}>{getProductStatus(p)}</Badge>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/products/${p.id}`)}>
                        Rediger
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
