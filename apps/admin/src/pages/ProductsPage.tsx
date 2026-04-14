import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Product } from "@logo-visualizer/shared";
import { getProducts, importProducts, exportProducts } from "../api/productApi";

function setupStatus(product: Product): string {
  if (product.printZones.length === 0) return "Mangler zoner";
  if (!product.title || !product.imageUrl) return "Mangler metadata";
  return "Fuldt opsat";
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getProducts()
      .then((r) => setProducts(r.items))
      .finally(() => setLoading(false));
  }, []);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importProducts(file);
    if (result.success) {
      const refreshed = await getProducts();
      setProducts(refreshed.items);
    }
  }

  if (loading) return <p>Indlæser produkter…</p>;

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Produkter</h1>

      <div style={{ display: "flex", gap: "1rem", margin: "1rem 0" }}>
        <button onClick={() => navigate("/products/new")}>
          + Nyt produkt
        </button>

        {/* A5 – import */}
        <label style={{ cursor: "pointer", textDecoration: "underline" }}>
          Importer JSON
          <input
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleImport}
          />
        </label>

        {/* A6 – export */}
        <button onClick={exportProducts}>Eksporter JSON</button>
      </div>

      {/* A7 – product list with status */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Titel</th>
            <th>Zoner</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.title}</td>
              <td>{p.printZones.length}</td>
              <td>{setupStatus(p)}</td>
              <td>
                <Link to={`/products/${p.id}`}>Rediger</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
