import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./atlas.css";
import "./polish.css";
import "./preferences.css";
import "./design.css";
import "./desktop-workspace.css";
import "./map-controls.css";
import "./privacy-controls.css";
import AppProviders from "@/components/app-providers";
import PrivateAnalytics from "@/components/private-analytics";
import "mapbox-gl/dist/mapbox-gl.css";
import { THEME_COLORS } from "@/lib/theme-color";

export const metadata: Metadata = {
  title: {
    default: "TicketSafe | NYC Ticket Search",
    template: "TicketSafe | %s",
  },
  description:
    "Search NYC parking and camera tickets, save your cars, and view ticket histories and locations.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TicketSafe",
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
  // Safari tints its top bar and the area around the notch and home bar with
  // these; they match --bg so the page reads edge to edge in both themes.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
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
            __html: `(function(){try{var p=JSON.parse(localStorage.getItem("ticketsafe.display.v1")||localStorage.getItem("curbside.preferences.v1")||"{}");var theme=p.theme==="light"||p.theme==="dark"?p.theme:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;var color=${JSON.stringify(THEME_COLORS)}[theme];var tint=function(){document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",color)})};tint();document.addEventListener("DOMContentLoaded",tint);var shown=JSON.parse(localStorage.getItem("ticketsafe.display.v1")||"{}");if(shown.locale==="zh"){var root=document.documentElement;root.lang="zh-Hans";root.dataset.localePending="";setTimeout(function(){delete root.dataset.localePending},1500);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <AppProviders>
          {children}
          <PrivateAnalytics />
        </AppProviders>
      </body>
    </html>
  );
}
