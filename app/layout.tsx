import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MyPortfolio",
  description: "Dein Space für strategisches Portfolio-Management",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
