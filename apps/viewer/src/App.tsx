import { useState } from "react";
import type { Product } from "@logo-visualizer/shared";
import { LogoUploader } from "./components/LogoUploader/LogoUploader";
import { ProductCanvas } from "./components/ProductCanvas/ProductCanvas";
import { ZoneSelector } from "./components/ZoneSelector/ZoneSelector";
import { TechniqueSelector } from "./components/TechniqueSelector/TechniqueSelector";

interface Props {
  preloadedLogo?: string;
  preloadedProductId?: string;
}

export function App({ preloadedLogo, preloadedProductId }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(preloadedLogo);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  const activeZone = product?.printZones.find((z) => z.id === activeZoneId) ?? null;

  // External consumers can pass a product via preloadedProductId.
  // Actual loading is delegated to ProductCanvas / a hook.

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem" }}>
      {/* V1 – logo upload */}
      <LogoUploader
        preloadedUrl={preloadedLogo}
        onLogoReady={setLogoUrl}
      />

      {/* V3 – zone selector */}
      {product && product.printZones.length > 1 && (
        <ZoneSelector
          zones={product.printZones}
          activeZoneId={activeZoneId}
          onChange={setActiveZoneId}
        />
      )}

      {/* V2-V6 – main canvas */}
      <ProductCanvas
        preloadedProductId={preloadedProductId}
        logoUrl={logoUrl}
        activeZoneId={activeZoneId}
        onProductLoaded={(p) => {
          setProduct(p);
          if (!activeZoneId && p.printZones.length > 0) {
            setActiveZoneId(p.printZones[0].id);
          }
        }}
      />

      {/* V7 – technique selector */}
      {activeZone && (
        <TechniqueSelector zone={activeZone} />
      )}
    </div>
  );
}
