import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["500", "600", "700"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["400", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Objects Have Feelings",
  description: "Point your camera at anything. Every object gets a personality, talks, and remembers you.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f97316" };

const NAV = [
  { href: "/", label: "Stage" },
  { href: "/diary", label: "Diary" },
  { href: "/settings", label: "Settings" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b-[2.5px] border-ink bg-cream/90 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5" aria-label="Main">
            <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold leading-none sm:text-2xl">
              <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden="true">
                <rect x="6" y="10" width="22" height="24" rx="6" fill="var(--orange)" stroke="var(--ink)" strokeWidth="3" />
                <path d="M28 16h3a5 5 0 0 1 0 10h-3" fill="none" stroke="var(--ink)" strokeWidth="3" />
                <circle cx="13" cy="20" r="2.2" fill="var(--ink)" />
                <circle cx="21" cy="20" r="2.2" fill="var(--ink)" />
                <path d="M13 26q4 3.5 8 0" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span>
                Objects <span className="text-orange [-webkit-text-stroke:1px_var(--ink)]">Have</span> Feelings
              </span>
            </Link>
            <ul className="flex gap-1.5">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="btn min-h-[40px] px-3 py-1 text-sm sm:px-4">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
