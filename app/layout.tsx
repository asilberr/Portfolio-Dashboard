import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DepotCockpit",
  description: "Aggregiertes Portfolio-Dashboard für mehrere Depots",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
