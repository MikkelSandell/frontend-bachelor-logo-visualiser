import { useEffect, useState } from "react";
import type { Product } from "@logo-visualizer/shared";
import { getMidoceanProducts, getMidoceanProduct } from "./api/viewerApi";
import { LogoUploader } from "./components/LogoUploader/LogoUploader";
import { ProductCanvas } from "./components/ProductCanvas/ProductCanvas";
import { ZoneSelector } from "./components/ZoneSelector/ZoneSelector";
import { TechniqueSelector } from "./components/TechniqueSelector/TechniqueSelector";
import { Card, CardContent } from "./components/ui/card";
import { Loader2 } from "lucide-react";

interface Props {
  preloadedLogo?: string;
  preloadedProductId?: string;
}

export function App({ preloadedLogo, preloadedProductId }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [product, setProduct] = useState<Product | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(preloadedLogo);
  const [logoId, setLogoId] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  const activeZone = product?.printZones.find((z) => z.id === activeZoneId) ?? null;

  // Load product list on mount
  useEffect(() => {
    getMidoceanProducts()
      .then(setProducts)
      .finally(() => setLoadingProducts(false));
  }, []);

  // If a product was pre-loaded via URL param, fetch it directly
  useEffect(() => {
    if (preloadedProductId) {
      getMidoceanProduct(preloadedProductId).then((p) => {
        setProduct(p);
        if (p.printZones.length > 0) setActiveZoneId(p.printZones[0].id);
      });
    }
  }, [preloadedProductId]);

  function handleSelectProduct(p: Product) {
    setProduct(p);
    setActiveZoneId(p.printZones.length > 0 ? p.printZones[0].id : null);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-2">
          <span className="font-semibold text-sm tracking-wide">Logo Visualizer</span>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 space-y-6">

        {/* Step 1 — pick a product */}
        {!product && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Vælg et produkt</h2>

            {loadingProducts ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Indlæser produkter…
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="group text-left"
                  >
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="aspect-square bg-muted overflow-hidden">
                        <img
                          src={p.imageUrl}
                          alt={p.title}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <CardContent className="p-2">
                        <p className="text-xs font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.printZones.length} {p.printZones.length === 1 ? "zone" : "zoner"}
                        </p>
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2 — visualise once product is chosen */}
        {product && (
          <div className="space-y-4">
            {/* Back link */}
            <button
              className="text-sm text-primary hover:underline"
              onClick={() => { setProduct(null); setLogoUrl(undefined); }}
            >
              ← Vælg andet produkt
            </button>

            {/* V1 – logo upload */}
            <LogoUploader preloadedUrl={preloadedLogo} onLogoReady={(url, id) => { setLogoUrl(url); setLogoId(id); }} />

            {/* V3 – zone selector */}
            {product.printZones.length > 1 && (
              <ZoneSelector
                zones={product.printZones}
                activeZoneId={activeZoneId}
                onChange={setActiveZoneId}
              />
            )}

            {/* V2-V6 – main canvas */}
            <ProductCanvas
              product={product}
              logoUrl={logoUrl}
              logoId={logoId}
              activeZoneId={activeZoneId}
              onProductLoaded={(p) => {
                if (!activeZoneId && p.printZones.length > 0) {
                  setActiveZoneId(p.printZones[0].id);
                }
              }}
            />

            {/* V7 – technique selector */}
            {activeZone && <TechniqueSelector zone={activeZone} />}
          </div>
        )}
      </main>
    </div>
  );
}
