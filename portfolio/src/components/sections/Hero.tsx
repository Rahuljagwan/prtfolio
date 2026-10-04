import { ArrowDown, Sparkles } from "lucide-react";
import { AssistantLink } from "@/components/ui/AssistantLink";
import { ButtonLink, buttonStyles } from "@/components/ui/Button";
import { Magnetic } from "@/components/ui/Magnetic";
import { HeroFallback } from "@/components/hero/HeroFallback";
import { OriginOrb } from "@/components/hero/OriginOrb";
import { RequestCounter } from "@/components/hero/RequestCounter";
import { HeroGuide } from "@/components/hero/HeroGuide";
import { ResumeMenu } from "@/components/ui/ResumeMenu";
import { cn } from "@/lib/utils";
import type { Profile, ResumeInfo } from "@/lib/types";

// Entrance uses CSS animations (not JS) so the headline paints with the server HTML instead of waiting for hydration.
const delay = (s: number) => ({ animationDelay: `${s}s` });

export function Hero({ profile, resume }: { profile: Profile; resume: ResumeInfo }) {
  return (
    <section id="hero" className="relative flex min-h-screen items-center overflow-hidden">
      <HeroFallback />

      <div className="container relative pb-14 pt-24 xl:pb-0">
        <div className="inline-block max-w-2xl">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur motion-reduce:animate-none">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            {profile.availability}
          </span>

          <h1
            style={delay(0.08)}
            className="mt-5 animate-fade-up text-5xl font-semibold leading-[1.05] tracking-tight motion-reduce:animate-none md:text-7xl"
          >
            Hi, I&apos;m {profile.name}.
            <span className="block text-muted-foreground">{profile.role}.</span>
          </h1>

          <p style={delay(0.16)} className="mt-4 animate-fade-up text-lg text-muted-foreground motion-reduce:animate-none">
            {profile.headline}
          </p>

          {/* The thesis: converts the 3D world from decoration to demonstration in one line. Tightly coupled to the
              subtitle above it (small gap) since the two read as one continuous introduction, not two separate ideas. */}
          <p style={delay(0.19)} className="mt-2 max-w-lg animate-fade-up text-sm text-muted-foreground/80 motion-reduce:animate-none">
            This site is built like one of my systems: every section is a stage a request passes through. Scroll to follow it, or send one and watch.
          </p>

          {/* A hairline breaks the card into two deliberate zones: introduction above, action below -- rather than
              one undifferentiated stack of elements at slightly different sizes. */}
          <div style={delay(0.2)} className="mt-6 animate-fade-up border-t border-border/60 pt-6 motion-reduce:animate-none">
            <RequestCounter />
            {/* Below lg, this replaces the caption line: the orb (OriginOrb) shows the same idea directly instead of describing
                it in a sentence, in the space the caption would have taken. Its wide-screen counterpart sits beside the text
                (below, a section-level sibling, not nested here -- see OriginOrb's own comment for why). */}
            <OriginOrb anchor className="relative my-3 flex justify-center lg:hidden" />
            <p className="mt-2.5 hidden max-w-md font-mono text-[11px] leading-relaxed text-muted-foreground lg:block">
              The counter is a simulation. The button is real: it sends one test request through every section of this site.
              {" "}To the right, the lightweight build: the same idea, without the full 3D scene.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Magnetic>
                <ButtonLink href="#projects">View my work</ButtonLink>
              </Magnetic>
              <Magnetic>
                {/* The differentiator, not a third quiet link: an accent-toned outline promotes it above the other two
                    secondary actions, so hierarchy reads View my work (primary) / Ask my portfolio (special) / the rest (quiet). */}
                <AssistantLink className={cn(buttonStyles({ variant: "ghost" }), "border-accent/50 text-accent hover:border-accent hover:bg-accent/10")}>
                  <Sparkles size={15} aria-hidden /> Ask my portfolio
                </AssistantLink>
              </Magnetic>
              <Magnetic>
                <ButtonLink href="#contact" variant="ghost">
                  Get in touch
                </ButtonLink>
              </Magnetic>
              <ResumeMenu resume={resume} />
            </div>
          </div>
        </div>

        {/* Below xl there is no room beside the text, so the same legend sits under the buttons (its stages scroll sideways if they must). */}
        <HeroGuide className="mt-10 max-w-2xl animate-fade-up motion-reduce:animate-none xl:hidden" />
      </div>

      {/* The wide-screen counterpart to the inline orb above: same component, positioned against the section itself (like
          HeroGuide below) rather than nested in the text column, so its containing block is the full hero, not that column.
          .origin-orb-wide puts it exactly where the 3D origin node is drawn, so the hand-over to the 3D world has no jump. */}
      <OriginOrb className="origin-orb-wide absolute hidden lg:block" />

      <HeroGuide className="absolute bottom-8 right-[max(1.5rem,4vw)] hidden w-[34rem] animate-fade-up motion-reduce:animate-none xl:block 2xl:w-[36rem]" />

      <a
        href="#about"
        aria-label="Scroll to about section"
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 text-muted-foreground transition-colors hover:text-foreground xl:block"
      >
        <ArrowDown size={20} className="animate-bounce motion-reduce:animate-none" />
      </a>
    </section>
  );
}
