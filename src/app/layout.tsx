import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { RegistroVisita } from "@/components/registro-visita";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

// cor da barra de status no celular (combina com o fundo escuro da marca)
export const viewport: Viewport = { themeColor: "#0a0e0c" };

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
        <Toaster position="bottom-right" closeButton />
      </body>
    </html>
  );
}
