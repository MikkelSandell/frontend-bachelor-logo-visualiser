import { useEffect, useState } from "react";
import type { Product } from "@logo-visualizer/shared";
import { getMidoceanProducts, getMidoceanProduct } from "./api/viewerApi";
import { LogoUploader } from "./components/LogoUploader/LogoUploader";
import { ProductCanvas } from "./components/ProductCanvas/ProductCanvas";
import { ZoneSelector } from "./components/ZoneSelector/ZoneSelector";
import { TechniqueSelector } from "./components/TechniqueSelector/TechniqueSelector";
import { Card, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Loader2, Search } from "lucide-react";
import { cn } from "./lib/utils";

interface Props {
  preloadedLogo?: string;
  preloadedProductId?: string;
}

export function App({ preloadedLogo, preloadedProductId }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");

  const [product, setProduct] = useState<Product | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(preloadedLogo);
  const [logoId, setLogoId] = useState<string | null>(null);
  /** Zones that have a logo placed on them */
  const [activeZoneIds, setActiveZoneIds] = useState<string[]>([]);
  /** Which active zone is currently selected for editing */
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  /** Which zone's image is displayed in the canvas */
  const [viewedZoneId, setViewedZoneId] = useState<string | null>(null);

  const focusedZone = product?.printZones.find((z) => z.id === focusedZoneId) ?? null;

  useEffect(() => {
    getMidoceanProducts()
      .then(setProducts)
      .finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    if (preloadedProductId) {
      getMidoceanProduct(preloadedProductId).then((p) => {
        setProduct(p);
        const frontZone = p.printZones.find((z) => /^front$/i.test(z.name));
        setViewedZoneId(frontZone?.id ?? p.printZones[0]?.id ?? null);
      });
    }
  }, [preloadedProductId]);

  /** Maps any zone id to the id of its side zone (FRONT or BACK) for canvas display. */
  function toSideZoneId(id: string, p: Product): string {
    const zone = p.printZones.find((z) => z.id === id);
    if (!zone) return id;
    if (/back/i.test(zone.name)) {
      return p.printZones.find((z) => /^back$/i.test(z.name))?.id ?? id;
    }
    return p.printZones.find((z) => /^front$/i.test(z.name))?.id ?? id;
  }

  function handleSelectProduct(p: Product) {
    setProduct(p);
    setActiveZoneIds([]);
    setFocusedZoneId(null);
    const frontZone = p.printZones.find((z) => /^front$/i.test(z.name));
    setViewedZoneId(frontZone?.id ?? p.printZones[0]?.id ?? null);
  }

  /** Activate an inactive zone and focus it */
  function handleZoneToggle(id: string) {
    setActiveZoneIds((prev) => [...prev, id]);
    setFocusedZoneId(id);
    setViewedZoneId(toSideZoneId(id, product!));
  }

  /** Remove a zone's logo entirely */
  function handleZoneDeactivate(id: string) {
    setActiveZoneIds((prev) => prev.filter((z) => z !== id));
    if (focusedZoneId === id) {
      const remaining = activeZoneIds.filter((z) => z !== id);
      const next = remaining[0] ?? null;
      setFocusedZoneId(next);
      if (next) setViewedZoneId(toSideZoneId(next, product!));
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-2">
          <span className="font-semibold text-sm tracking-wide">Logo Visualizer</span>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 space-y-6">

        {!product && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Vælg et produkt</h2>
            {loadingProducts ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Indlæser produkter…
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Søg på produktnavn…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {(() => {
                  const filtered = products.filter((p) =>
                    p.title.toLowerCase().includes(search.toLowerCase())
                  );
                  return filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Ingen produkter matcher "{search}"
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {filtered.map((p) => (
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
                  );
                })()}
              </>
            )}
          </div>
        )}

        {product && (
          <div className="space-y-4">
            <button
              className="text-sm text-primary hover:underline"
              onClick={() => { setProduct(null); setLogoUrl(undefined); setActiveZoneIds([]); setFocusedZoneId(null); }}
            >
              ← Vælg andet produkt
            </button>

            {/* V1 – logo upload */}
            <LogoUploader preloadedUrl={preloadedLogo} onLogoReady={(url, id) => { setLogoUrl(url); setLogoId(id); }} />

            {/* V3 – zone multi-selector */}
            {product.printZones.length > 1 && (
              <ZoneSelector
                zones={product.printZones}
                activeZoneIds={activeZoneIds}
                focusedZoneId={focusedZoneId}
                onActivate={handleZoneToggle}
                onFocus={(id) => { setFocusedZoneId(id); setViewedZoneId(toSideZoneId(id, product!)); }}
                onDeactivate={handleZoneDeactivate}
              />
            )}

            {/* Side viewer — browse product sides without changing active zones */}
            {(() => {
              const sides = product.printZones.filter((z) =>
                /^(front|back)$/i.test(z.name)
              );
              return sides.length > 1 ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground">Se side</p>
                <div className="flex flex-wrap gap-2">
                  {sides.map((z) => (
                    <button
                      key={z.id}
                      onClick={() => setViewedZoneId(z.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm border transition-colors",
                        viewedZoneId === z.id
                          ? "bg-muted border-foreground/30 font-medium"
                          : "bg-background text-muted-foreground border-input hover:bg-muted"
                      )}
                    >
                      {z.name}
                      {activeZoneIds.includes(z.id) && (
                        <span
                          className="ml-1.5 inline-block w-2 h-2 rounded-full bg-primary align-middle"
                          title="Logo placeret på denne side"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              ) : null;
            })()}

            {/* V2-V6 – main canvas */}
            <ProductCanvas
              product={product}
              logoUrl={logoUrl}
              logoId={logoId}
              activeZoneIds={activeZoneIds}
              focusedZoneId={focusedZoneId}
              viewedZoneId={viewedZoneId}
              onFocusZone={(id) => { setFocusedZoneId(id); }}
              onProductLoaded={() => {}}
            />

            {/* V7 – technique selector for the focused zone */}
            {focusedZone && <TechniqueSelector zone={focusedZone} />}
          </div>
        )}
      </main>
    </div>
  );
}
