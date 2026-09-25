import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import ThemeApplier from "@/components/ThemeApplier";
import Home from "@/pages/Home";
import Gallery from "@/pages/Gallery";
import Admin from "@/pages/Admin";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <div className="min-h-svh bg-[var(--ink)] font-sans text-[var(--cream)] antialiased">
      {/* Applies the admin's palette to the CSS variables every component reads */}
      <ThemeApplier />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gallery/:clientId" element={<Gallery />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
