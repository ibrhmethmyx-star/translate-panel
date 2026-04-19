import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const navigation = [
  { href: "/", label: "Dashboard" },
  { href: "/licenses", label: "Licenses" },
  { href: "/sites", label: "Sites" },
  { href: "/releases", label: "Releases" },
  { href: "/policies", label: "Policies" },
];

export const metadata: Metadata = {
  title: "DST Control Panel",
  description:
    "Licensing, release enforcement, and runtime lock orchestration for the Dynamic SEO Translator plugin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth`}
    >
      <body className="min-h-full bg-[var(--page-bg)] text-[var(--ink-1)] antialiased">
        <div className="min-h-screen">
          <header className="border-b border-[var(--line-soft)] bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
                  Dynamic SEO Translator
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-1)]">
                  Control Panel
                </h1>
              </div>

              <nav className="flex flex-wrap gap-2">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-[var(--line-soft)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink-1)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">{children}</div>
        </div>
      </body>
    </html>
  );
}
