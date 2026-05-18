import { useEffect, useRef, useState } from "react";
import type { Product, PrintZone } from "@logo-visualizer/shared";
import type { LogoEntry, TextEntry } from "./types";
import { getMidoceanProducts, getMidoceanProduct } from "./api/viewerApi";
import { LogoUploader } from "./components/LogoUploader/LogoUploader";
import { TextLibrary } from "./components/TextLibrary/TextLibrary";
import { ProductCanvas, type ProductCanvasHandle } from "./components/ProductCanvas/ProductCanvas";
import { ZoneSelector } from "./components/ZoneSelector/ZoneSelector";
import { TechniqueSelector } from "./components/TechniqueSelector/TechniqueSelector";
import { ColorCountSelector } from "./components/ColorCountSelector/ColorCountSelector";
import { Card, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { ChevronDown, Download, Loader2, MousePointer, Search } from "lucide-react";
import { cn } from "./lib/utils";

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200", !open && "-rotate-90")} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

interface Props {
  preloadedLogo?: string;
  preloadedProductId?: string;
}

export function App({ preloadedLogo, preloadedProductId }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");

  const [product, setProduct] = useState<Product | null>(null);

  const [logos, setLogos] = useState<LogoEntry[]>(() =>
    preloadedLogo
      ? [{ id: "preloaded", url: preloadedLogo, name: "Forudindlæst logo" }]
      : []
  );
  const [zoneLogoAssignments, setZoneLogoAssignments] = useState<Record<string, string>>({});

  const [texts, setTexts] = useState<TextEntry[]>([]);
  const [zoneTextAssignments, setZoneTextAssignments] = useState<Record<string, string>>({});
  const [zoneTechniqueAssignments, setZoneTechniqueAssignments] = useState<Record<string, string>>({});

  const [activeZoneIds, setActiveZoneIds] = useState<string[]>([]);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  const [viewedZoneId, setViewedZoneId] = useState<string | null>(null);
  const [zoneColorAssignments, setZoneColorAssignments] = useState<Record<string, number>>({});

  const focusedZone = product?.printZones.find((z) => z.id === focusedZoneId) ?? null;
  const canvasRef = useRef<ProductCanvasHandle>(null);

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
        if (p.printZones.length === 1) {
          setActiveZoneIds([p.printZones[0].id]);
          setFocusedZoneId(p.printZones[0].id);
        }
      });
    }
  }, [preloadedProductId]);

  function toSideZoneId(id: string, p: Product): string {
    const zone = p.printZones.find((z) => z.id === id);
    if (!zone) return id;
    if (/back/i.test(zone.name))
      return p.printZones.find((z) => /^back$/i.test(z.name))?.id ?? id;
    return p.printZones.find((z) => /^front$/i.test(z.name))?.id ?? id;
  }

  function handleSelectProduct(p: Product) {
    setProduct(p);
    setZoneLogoAssignments({});
    setZoneTextAssignments({});
    setZoneTechniqueAssignments({});
    setZoneColorAssignments({});
    const singleZoneId = p.printZones.length === 1 ? p.printZones[0].id : null;
    setActiveZoneIds(singleZoneId ? [singleZoneId] : []);
    setFocusedZoneId(singleZoneId);
    const frontZone = p.printZones.find((z) => /^front$/i.test(z.name));
    setViewedZoneId(frontZone?.id ?? p.printZones[0]?.id ?? null);
  }

  function handleZoneToggle(id: string) {
    setActiveZoneIds((prev) => [...prev, id]);
    setFocusedZoneId(id);
    setViewedZoneId(toSideZoneId(id, product!));
  }

  function handleSelectTechnique(zoneId: string, techniqueSlug: string) {
    setZoneTechniqueAssignments((prev) => ({ ...prev, [zoneId]: techniqueSlug }));
  }

  function handleZoneDeactivate(id: string) {
    setActiveZoneIds((prev) => prev.filter((z) => z !== id));
    setZoneLogoAssignments((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setZoneTextAssignments((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setZoneTechniqueAssignments((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setZoneColorAssignments((prev) => { const n = { ...prev }; delete n[id]; return n; });
    if (focusedZoneId === id) {
      setFocusedZoneId(null);
    }
  }

  // ─── Logo handlers ────────────────────────────────────────────────────────

  function handleLogoUploaded(logo: LogoEntry) {
    setLogos((prev) => [...prev, logo]);
  }

  function handleLogoUpdated(id: string, newUrl: string, newId?: string) {
    setLogos((prev) => prev.map((l) => l.id === id ? { ...l, url: newUrl, id: newId ?? l.id } : l));
    if (newId && newId !== id) {
      setZoneLogoAssignments((prev) => {
        const next = { ...prev };
        for (const zoneId of Object.keys(next)) {
          if (next[zoneId] === id) next[zoneId] = newId;
        }
        return next;
      });
    }
  }

  function handleLogoRemoved(id: string) {
    const remaining = logos.filter((l) => l.id !== id);
    setLogos(remaining);
    setZoneLogoAssignments((prev) => {
      const next: Record<string, string> = {};
      for (const [zoneId, logoId] of Object.entries(prev)) {
        if (logoId !== id) next[zoneId] = logoId;
        else if (remaining.length === 1) next[zoneId] = remaining[0].id;
      }
      return next;
    });
  }

  function handleAssignLogo(zoneId: string, logoId: string) {
    setZoneLogoAssignments((prev) => {
      if (prev[zoneId] === logoId) {
        const next = { ...prev };
        delete next[zoneId];
        return next;
      }
      return { ...prev, [zoneId]: logoId };
    });
  }

  // ─── Text handlers ────────────────────────────────────────────────────────

  function handleTextAdded(entry: TextEntry) {
    setTexts((prev) => [...prev, entry]);
  }

  function handleTextRemoved(id: string) {
    const remaining = texts.filter((t) => t.id !== id);
    setTexts(remaining);
    setZoneTextAssignments((prev) => {
      const next: Record<string, string> = {};
      for (const [zoneId, textId] of Object.entries(prev)) {
        if (textId !== id) next[zoneId] = textId;
        else if (remaining.length === 1) next[zoneId] = remaining[0].id;
      }
      return next;
    });
  }

  function handleTextEdited(id: string, newText: string) {
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, text: newText } : t)));
  }

  function handleAssignText(zoneId: string, textId: string) {
    setZoneTextAssignments((prev) => {
      if (prev[zoneId] === textId) {
        const next = { ...prev };
        delete next[zoneId];
        return next;
      }
      return { ...prev, [zoneId]: textId };
    });
  }

  // Mirror the isBackZone logic from ProductCanvas so side-detection is consistent.
  // When zone names lack "front"/"back", fall back to imageUrl comparison.
  const backSideImageUrl: string | null = product
    ? (() => {
        const namedBack = product.printZones.find((z) => /^back$/i.test(z.name));
        if (namedBack?.imageUrl) return namedBack.imageUrl;
        for (const z of product.printZones) {
          if (z.imageUrl && z.imageUrl !== product.imageUrl) return z.imageUrl;
        }
        return null;
      })()
    : null;

  function isBackZoneForSide(z: PrintZone): boolean {
    if (/back/i.test(z.name)) return true;
    if (/front/i.test(z.name)) return false;
    return backSideImageUrl !== null && !!z.imageUrl && z.imageUrl === backSideImageUrl;
  }

  const hasSides = product !== null && backSideImageUrl !== null;
  const viewedZone = product?.printZones.find((z) => z.id === viewedZoneId) ?? null;
  const viewedIsBack = viewedZone ? isBackZoneForSide(viewedZone) : false;
  const frontRepZoneId = product?.printZones.find((z) => !isBackZoneForSide(z))?.id ?? null;
  const backRepZoneId  = product?.printZones.find(isBackZoneForSide)?.id ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f4f6]">
      {/* Header */}
      <div className="bg-primary text-primary-foreground shadow-sm shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 py-3 md:px-6 flex items-center justify-between">
          <span className="font-semibold text-sm tracking-wide">Logo Visualizer</span>
          {product && (
            <span className="text-sm text-primary-foreground/75 font-medium">{product.title}</span>
          )}
        </div>
      </div>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6 md:px-6">

        {/* ── Product picker ── */}
        {!product && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Vælg et produkt</h2>
              <p className="text-sm text-muted-foreground mt-1">Placér dit logo direkte på produktet og se resultatet med det samme</p>
            </div>
            {loadingProducts ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm bg-white border border-border rounded-xl px-4 py-10 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Indlæser produkter…
              </div>
            ) : (
              <div className="bg-white border border-border rounded-xl p-4 md:p-5 shadow-sm space-y-4">
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
                    <p className="text-sm text-muted-foreground py-8 text-center">
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
                          <Card className="overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                            <div className="aspect-square bg-[#f8f9fb] overflow-hidden">
                              <img
                                src={p.imageUrl}
                                alt={p.title}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200 p-2"
                              />
                            </div>
                            <CardContent className="p-3 border-t border-border">
                              <p className="text-sm font-semibold truncate text-foreground">{p.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {p.printZones.length} {p.printZones.length === 1 ? "printzone" : "printzoner"}
                              </p>
                            </CardContent>
                          </Card>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── Workspace ── */}
        {product && (
          <div className="grid gap-4 lg:gap-5 lg:grid-cols-[230px_minmax(0,1fr)_280px] items-start">

            {/* Left sidebar */}
            <aside className="flex flex-col gap-3">
              {/* Product info */}
              <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
                <p className="font-bold text-base leading-tight truncate">{product.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {product.printZones.length} {product.printZones.length === 1 ? "printzone" : "printzoner"}
                </p>
                <button
                  className="text-xs text-primary hover:underline mt-2 block"
                  onClick={() => {
                    setProduct(null);
                    setActiveZoneIds([]);
                    setFocusedZoneId(null);
                    setZoneLogoAssignments({});
                    setZoneTextAssignments({});
                    setZoneTechniqueAssignments({});
                    setZoneColorAssignments({});
                  }}
                >
                  ← Vælg andet produkt
                </button>
              </div>

              {/* Zone selector */}
              <div className="bg-white border border-border rounded-xl p-4 shadow-sm flex-1">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">Printzoner</p>
                {product.printZones.length > 1 ? (
                  <ZoneSelector
                    zones={product.printZones}
                    activeZoneIds={activeZoneIds}
                    focusedZoneId={focusedZoneId}
                    onActivate={handleZoneToggle}
                    onFocus={(id) => {
                      setFocusedZoneId(id);
                      setViewedZoneId(toSideZoneId(id, product!));
                    }}
                    onDeactivate={handleZoneDeactivate}
                  />
                ) : (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
                    {product.printZones[0]?.name ?? "Standardzone"}
                  </div>
                )}

                <div className="pt-1">
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={logos.length === 0}
                    onClick={() => canvasRef.current?.exportPng()}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download som PNG
                  </Button>
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    disabled={logos.length === 0}
                    onClick={() => canvasRef.current?.exportPdf()}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download som PDF
                  </Button>
                  {logos.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5 text-center">Upload et logo for at aktivere</p>
                  )}
                </div>
              </div>
            </aside>

            {/* Center canvas */}
            <section className="bg-white border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
              {/* Front / Back tab strip */}
              {hasSides && (
                <div className="flex border-b border-border shrink-0">
                  <button
                    onClick={() => frontRepZoneId && setViewedZoneId(frontRepZoneId)}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                      !viewedIsBack
                        ? "border-b-2 border-primary text-primary bg-primary/5"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    Forside
                    {product!.printZones.filter((z) => !isBackZoneForSide(z)).some((z) => activeZoneIds.includes(z.id)) && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                  <button
                    onClick={() => backRepZoneId && setViewedZoneId(backRepZoneId)}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                      viewedIsBack
                        ? "border-b-2 border-primary text-primary bg-primary/5"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    Bagside
                    {product!.printZones.filter(isBackZoneForSide).some((z) => activeZoneIds.includes(z.id)) && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                </div>
              )}
              <div className="flex-1 bg-[#f8f9fb] p-4 md:p-6 flex items-start justify-center overflow-auto">
                <ProductCanvas
                  ref={canvasRef}
                  product={product}
                  logos={logos}
                  zoneLogoAssignments={zoneLogoAssignments}
                  texts={texts}
                  zoneTextAssignments={zoneTextAssignments}
                  activeZoneIds={activeZoneIds}
                  focusedZoneId={focusedZoneId}
                  viewedZoneId={viewedZoneId}
                  zoneTechniqueAssignments={zoneTechniqueAssignments}
                  zoneColorAssignments={zoneColorAssignments}
                  onFocusZone={(id) => { setFocusedZoneId(id); }}
                  onActivateZone={handleZoneToggle}
                  onDeactivateZone={handleZoneDeactivate}
                  onProductLoaded={() => {}}
                />
              </div>
            </section>

            {/* Right sidebar */}
            <aside className="flex flex-col gap-3">
              {/* Zone indicator */}
              <CollapsibleSection title="Aktiv zone">
                {focusedZone ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary shrink-0" />
                    <p className="text-sm font-semibold">{focusedZone.name}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center gap-2 py-1">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <MousePointer className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Vælg en printzone</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Klik på en zone i listen til venstre</p>
                    </div>
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection title="Print-teknik">
                <TechniqueSelector
                  zone={focusedZone}
                  selectedTechnique={focusedZoneId ? zoneTechniqueAssignments[focusedZoneId] : undefined}
                  onSelect={(slug) => focusedZoneId && handleSelectTechnique(focusedZoneId, slug)}
                  disabled={!focusedZone}
                />
              </CollapsibleSection>

              {(focusedZone?.maxColors ?? 0) > 0 && (
                <CollapsibleSection title="Antal farver">
                  <ColorCountSelector
                    zone={focusedZone}
                    selectedCount={focusedZoneId ? zoneColorAssignments[focusedZoneId] : undefined}
                    onSelect={(count) => focusedZoneId && setZoneColorAssignments((prev) => ({ ...prev, [focusedZoneId]: count }))}
                  />
                </CollapsibleSection>
              )}

              <CollapsibleSection title="Logoer">
                <LogoUploader
                  logos={logos}
                  onLogoUploaded={handleLogoUploaded}
                  onLogoRemoved={handleLogoRemoved}
                  onLogoUpdated={handleLogoUpdated}
                  assignedLogoId={focusedZoneId ? (zoneLogoAssignments[focusedZoneId] ?? null) : null}
                  onAssign={focusedZoneId ? (logoId) => handleAssignLogo(focusedZoneId, logoId) : undefined}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Tekster">
                <TextLibrary
                  texts={texts}
                  onTextAdded={handleTextAdded}
                  onTextRemoved={handleTextRemoved}
                  onTextEdited={handleTextEdited}
                  assignedTextId={focusedZoneId ? (zoneTextAssignments[focusedZoneId] ?? null) : null}
                  onAssign={focusedZoneId ? (textId) => handleAssignText(focusedZoneId, textId) : undefined}
                />
              </CollapsibleSection>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
