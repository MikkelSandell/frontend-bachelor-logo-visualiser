import { Link, useLocation } from "react-router-dom";
import { type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top orange bar — matches b2b primary bar */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <span className="font-semibold text-sm tracking-wide">
            Logo Visualizer
          </span>
          <span className="text-sm opacity-80">Admin</span>
        </div>
      </div>

      {/* Nav bar */}
      <nav className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4">
          <ul className="flex items-center gap-1 h-12">
            <li>
              <Link
                to="/"
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === "/"
                    ? "text-primary bg-primary/10"
                    : "text-foreground hover:bg-muted"
                )}
              >
                Produkter
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
