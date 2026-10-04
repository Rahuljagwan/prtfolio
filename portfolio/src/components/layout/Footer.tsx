import { AssistantLink } from "@/components/ui/AssistantLink";
import { StatusBadge } from "./StatusBadge";
import Link from "next/link";
import { SHOW_SAMPLES } from "@/lib/samples";
import { FooterTools } from "./FooterTools";

export function Footer() {
  return (
    <footer className="site-footer relative border-t border-border py-8">
      <div className="container flex flex-col gap-5 text-sm text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Rahul. All rights reserved.</p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link href="/engineering" prefetch={false} className="transition-colors hover:text-foreground">
              Engineering
            </Link>
            {SHOW_SAMPLES && (
              <Link href="/notes" prefetch={false} className="transition-colors hover:text-foreground">
                Notes
              </Link>
            )}
            <AssistantLink className="transition-colors hover:text-foreground">Ask my portfolio</AssistantLink>
            <span className="hidden sm:inline">Built with Next.js, Tailwind and Framer Motion.</span>
          </p>
        </div>
        {/* The proof line: a real health check against this very site, the build it is running, and the numbers behind the page. */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-5 sm:flex-row">
          <StatusBadge />
          <FooterTools />
        </div>
      </div>
    </footer>
  );
}
