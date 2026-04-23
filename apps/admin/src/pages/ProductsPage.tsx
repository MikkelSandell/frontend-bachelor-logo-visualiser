import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import type { Product } from "@logo-visualizer/shared";
import { getMidoceanProducts } from "../api/productApi";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getMidoceanProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

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
        <Badge variant="secondary">
          {search ? `${filtered.length} / ${products.length}` : products.length} Midocean produkter
        </Badge>
      </div>

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
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground text-sm">
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
                          <img
                            src={p.imageUrl}
                            alt={p.title}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <span className="font-medium">{p.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground font-mono text-xs">{p.id}</td>
                    <td className="px-6 py-3 text-muted-foreground">{p.printZones.length}</td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/products/${p.id}`)}
                      >
                        Se zoner
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
