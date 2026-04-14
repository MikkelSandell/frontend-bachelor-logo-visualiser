import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Product, PrintZone } from "@logo-visualizer/shared";
import {
  getProduct,
  createProduct,
  updateProduct,
  uploadProductImage,
  createZone,
  updateZone,
  deleteZone,
} from "../api/productApi";
import { ZoneEditor } from "../components/ZoneEditor/ZoneEditor";

export function ProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === undefined;

  const [product, setProduct] = useState<Product | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew) {
      getProduct(id)
        .then((r) => {
          setProduct(r.data);
          setTitle(r.data.title);
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  // A1 – upload product image
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await uploadProductImage(file);
    if (!result.success) return;

    if (isNew) {
      // Create the product first with the uploaded image
      const created = await createProduct({
        title: title || file.name,
        imageUrl: result.data.url,
        imageWidth: result.data.width,
        imageHeight: result.data.height,
      });
      if (created.success) {
        navigate(`/products/${created.data.id}`, { replace: true });
      }
    } else if (product) {
      const updated = await updateProduct(product.id, {
        imageUrl: result.data.url,
        imageWidth: result.data.width,
        imageHeight: result.data.height,
      });
      if (updated.success) setProduct(updated.data);
    }
  }

  async function handleTitleSave() {
    if (!product) return;
    const updated = await updateProduct(product.id, { title });
    if (updated.success) setProduct(updated.data);
  }

  // A2/A3 – zone created via ZoneEditor canvas
  async function handleZoneCreated(zone: Omit<PrintZone, "id">) {
    if (!product) return;
    const result = await createZone(product.id, zone);
    if (result.success) {
      setProduct((prev) =>
        prev ? { ...prev, printZones: [...prev.printZones, result.data] } : prev
      );
    }
  }

  // A4 – zone updated
  async function handleZoneUpdated(zone: PrintZone) {
    if (!product) return;
    const result = await updateZone(product.id, zone.id, zone);
    if (result.success) {
      setProduct((prev) =>
        prev
          ? {
              ...prev,
              printZones: prev.printZones.map((z) =>
                z.id === zone.id ? result.data : z
              ),
            }
          : prev
      );
    }
  }

  // A4 – zone deleted
  async function handleZoneDeleted(zoneId: string) {
    if (!product) return;
    await deleteZone(product.id, zoneId);
    setProduct((prev) =>
      prev
        ? {
            ...prev,
            printZones: prev.printZones.filter((z) => z.id !== zoneId),
          }
        : prev
    );
  }

  if (loading) return <p>Indlæser…</p>;

  return (
    <main style={{ padding: "2rem" }}>
      <button onClick={() => navigate("/")}>← Tilbage</button>
      <h1>{isNew ? "Nyt produkt" : "Rediger produkt"}</h1>

      {/* A1 – product metadata */}
      <section style={{ marginBottom: "1rem" }}>
        <label>
          Titel
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSave}
            style={{ marginLeft: "0.5rem" }}
          />
        </label>

        <label style={{ display: "block", marginTop: "0.5rem" }}>
          Produktbillede (PNG/JPG)
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleImageUpload}
            style={{ marginLeft: "0.5rem" }}
          />
        </label>
      </section>

      {/* A2-A4 – print zone canvas editor */}
      {product && (
        <ZoneEditor
          product={product}
          onZoneCreated={handleZoneCreated}
          onZoneUpdated={handleZoneUpdated}
          onZoneDeleted={handleZoneDeleted}
        />
      )}
    </main>
  );
}
