import { ArrowDown, Sparkles } from "lucide-react";
import { AssistantLink } from "@/components/ui/AssistantLink";
import { ButtonLink, buttonStyles } from "@/components/ui/Button";
import { Magnetic } from "@/components/ui/Magnetic";
import { HeroFallback } from "@/components/hero/HeroFallback";
import { ResumeMenu } from "@/components/ui/ResumeMenu";
import type { Profile, ResumeInfo } from "@/lib/types";

// Entrance uses CSS animations (not JS) so the headline paints with the server HTML instead of waiting for hydration.
const delay = (s: number) => ({ animationDelay: `${s}s` });

export function Hero({ profile, resume }: { profile: Profile; resume: ResumeInfo }) {
  return (
    <section id="hero" className="relative flex min-h-screen items-center overflow-hidden">
      <HeroFallback />

      <div className="container relative pt-24">
        <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur motion-reduce:animate-none">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          {profile.availability}
        </span>

        <h1
          style={delay(0.08)}
          className="mt-6 max-w-4xl animate-fade-up text-5xl font-semibold leading-[1.05] tracking-tight motion-reduce:animate-none md:text-7xl"
        >
          Hi, I&apos;m {profile.name}.
          <span className="block text-muted-foreground">{profile.role}.</span>
        </h1>

        <p style={delay(0.16)} className="mt-6 max-w-xl animate-fade-up text-lg text-muted-foreground motion-reduce:animate-none">
          {profile.headline}
        </p>

        <div style={delay(0.24)} className="mt-10 flex animate-fade-up flex-wrap items-center gap-3 motion-reduce:animate-none">
          <Magnetic>
            <ButtonLink href="#projects">View my work</ButtonLink>
          </Magnetic>
          <Magnetic>
            <ButtonLink href="#contact" variant="ghost">
              Get in touch
            </ButtonLink>
          </Magnetic>
          <ResumeMenu resume={resume} />
          <Magnetic>
            <AssistantLink className={buttonStyles({ variant: "ghost" })}>
              <Sparkles size={15} aria-hidden /> Ask my portfolio
            </AssistantLink>
          </Magnetic>
        </div>
      </div>

      <a
        href="#about"
        aria-label="Scroll to about section"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowDown size={20} className="animate-bounce motion-reduce:animate-none" />
      </a>
    </section>
  );
}
