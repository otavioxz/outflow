import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { RegistroVisita } from "@/components/registro-visita";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Outflow",
  description: "Controle de gastos mensais alimentado pelo WhatsApp",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={cn("font-sans", geist.variable)}>
      <body>
        {children}
        <RegistroVisita />
      </body>
    </html>
  );
}
