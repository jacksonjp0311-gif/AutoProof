import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoProof — Human-guided theorem proving",
  description: "An interactive workspace for Lean proofs, AI suggestions, and proof feedback.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

