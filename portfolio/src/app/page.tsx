import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Cursor } from "@/components/layout/Cursor";
import { SpotlightController } from "@/components/ui/SpotlightController";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { Hero } from "@/components/sections/Hero";
import { About } from "@/components/sections/About";
import { Experience } from "@/components/sections/Experience";
import { Journey } from "@/components/sections/Journey";
import { Education } from "@/components/sections/Education";
import { ResumeSection } from "@/components/sections/ResumeSection";
import { Projects, hasCaseStudy } from "@/components/sections/Projects";
import { CaseStudyLayer } from "@/components/projects/CaseStudyLayer";
import { ScrollJourney } from "@/components/journey/ScrollJourney";
import { WorldCanvas } from "@/components/world/WorldCanvas";
import { JourneyRail } from "@/components/journey/JourneyRail";
import { Skills } from "@/components/sections/Skills";
import { Contact } from "@/components/sections/Contact";
import { getPortfolio } from "@/lib/portfolio";

export default async function Home() {
  const { profile, contacts, experience, projects, skillGroups, education, journey, resume } = await getPortfolio();

  return (
    <SmoothScroll>
      <ScrollProgress />
      <Cursor />
      <WorldCanvas />
      <SpotlightController />
      <ScrollJourney />
      <JourneyRail />
      <CaseStudyLayer projects={projects} />
      <CommandPalette
        contacts={contacts}
        resume={resume}
        projects={projects.map((p) => ({ id: p.id, slug: p.slug, title: p.title, hasCaseStudy: hasCaseStudy(p), sample: p.sample }))}
      />
      <Navbar />
      <main>
        <Hero profile={profile} resume={resume} />
        <About profile={profile} />
        <Experience items={experience} />
        <Journey journey={journey} />
        <Projects items={projects} />
        <Skills groups={skillGroups} />
        <Education items={education} />
        <ResumeSection resume={resume} />
        <Contact contacts={contacts} />
      </main>
      <Footer />
    </SmoothScroll>
  );
}
