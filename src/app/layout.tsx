import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { RegistroVisita } from "@/components/registro-visita";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

// Texto: Plus Jakarta Sans (legível, números alinhados). Títulos e valores: Bricolage Grotesque.
const texto = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });
const titulos = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-titulo" });

// Cor da barra de status no celular (combina com o fundo escuro da marca). Sem zoom de pinça nem de
// toque duplo: no APK (TWA do PWABuilder) o Outflow deve se comportar como app, não como site.
export const viewport: Viewport = {
  themeColor: "#0a0e0c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Outflow",
  description: "Controle de gastos mensais alimentado pelo WhatsApp",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={cn("font-sans", texto.variable, titulos.variable)}>
      <body className="flex min-h-svh flex-col">
        {children}
        <footer className="pt-3 pb-2 text-center text-[11px] tracking-wide text-muted-foreground/50">Dev. by Otavio</footer>
        <RegistroVisita />
        <Toaster position="bottom-right" closeButton />
      </body>
    </html>
  );
}
