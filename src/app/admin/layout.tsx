import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "FlashResume Admin",
  description: "FlashResume administration dashboard",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
