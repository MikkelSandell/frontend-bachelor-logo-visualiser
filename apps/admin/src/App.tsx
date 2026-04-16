import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout/Layout";
import { ProductsPage } from "./pages/ProductsPage";
import { ProductEditorPage } from "./pages/ProductEditorPage";

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* A7 – product list with setup status */}
          <Route path="/" element={<ProductsPage />} />
          {/* A1-A4 – product editor + print zone drawing */}
          <Route path="/products/new" element={<ProductEditorPage />} />
          <Route path="/products/:id" element={<ProductEditorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
