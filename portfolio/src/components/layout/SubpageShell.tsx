import Link from "next/link";
import { FooterTools } from "./FooterTools";
import { SubpageNav } from "./SubpageNav";

/**
 * Shell for every lightweight route outside the home page (/projects/[slug], /engineering/*, /notes/*). The 3D world lives
 * only on the home page, so these pages are plain, fast and shareable, in the same design language. `current` is the label
 * shown as the active item in the floating nav.
 */
export function SubpageShell({ current, children }: { current: string; children: React.ReactNode }) {
  return (
    <>
      <SubpageNav current={current} />
      <main className="container max-w-4xl pb-24 pt-28 md:pt-32">{children}</main>
      <footer className="border-t border-border py-8">
        <div className="container flex max-w-4xl flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
          <p>
            <Link href="/" prefetch={false} className="transition-colors hover:text-foreground">
              &larr; Back to the portfolio
            </Link>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link href="/engineering" prefetch={false} className="transition-colors hover:text-foreground">
              Engineering
            </Link>
            <Link href="/assistant" prefetch={false} className="transition-colors hover:text-foreground">
              Ask my portfolio
            </Link>
            <FooterTools />
          </div>
        </div>
      </footer>
    </>
  );
}
