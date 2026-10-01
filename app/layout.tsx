import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./atlas.css";
import "./polish.css";
import "./preferences.css";
import "./design.css";
import AppProviders from "@/components/app-providers";
import "mapbox-gl/dist/mapbox-gl.css";

export const metadata: Metadata = {
  title: {
    default: "Curbside | NYC Ticket Monitoring",
    template: "Curbside | %s",
  },
  description: "Your NYC tickets, reminders, and next steps. All in one place.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Curbside",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050607",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=JSON.parse(localStorage.getItem("curbside.preferences.v1")||"{}");var theme=p.theme==="light"||p.theme==="dark"?p.theme:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
