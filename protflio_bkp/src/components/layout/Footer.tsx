import { AssistantLink } from "@/components/ui/AssistantLink";

export function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="container flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
        <p>&copy; {new Date().getFullYear()} Rahul. All rights reserved.</p>
        <p>
          <AssistantLink className="transition-colors hover:text-foreground">Ask my portfolio</AssistantLink>
          <span aria-hidden> · </span>Built with Next.js, Tailwind and Framer Motion.
        </p>
      </div>
    </footer>
  );
}
