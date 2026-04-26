import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout/Layout";
import { ProductsPage } from "./pages/ProductsPage";
import { ProductEditorPage } from "./pages/ProductEditorPage";
import { CreateProductPage } from "./pages/CreateProductPage";

export function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Layout>
        <Routes>
          {/* A7 – product list with setup status */}
          <Route path="/" element={<ProductsPage />} />
          {/* A1 – create product */}
          <Route path="/products/new" element={<CreateProductPage />} />
          {/* A2-A4 – product editor + print zone setup */}
          <Route path="/products/:id" element={<ProductEditorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
