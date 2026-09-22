import { Mail, MessageCircle, Phone } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { WhatsAppQR } from "./WhatsAppQR";
import { ContactTerminal } from "./ContactTerminal";
import { LinkedinIcon } from "@/components/ui/BrandIcons";
import { contactHref, findContact, WHATSAPP_GREETING } from "@/lib/contact";
import type { ContactLink, ContactType } from "@/lib/types";

const META: Partial<Record<ContactType, { label: string; icon: React.ComponentType<{ size?: string | number }>; cta: string }>> = {
  email: { label: "Email", icon: Mail, cta: "Compose an email" },
  phone: { label: "Call", icon: Phone, cta: "Call me" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, cta: "Open WhatsApp" },
  linkedin: { label: "LinkedIn", icon: LinkedinIcon, cta: "Open LinkedIn" },
};

const ORDER: ContactType[] = ["email", "phone", "whatsapp", "linkedin"];

export function Contact({ contacts }: { contacts: ContactLink[] }) {
  const whatsapp = findContact(contacts, "whatsapp");
  const items = ORDER.map((t) => findContact(contacts, t)).filter((c): c is ContactLink => !!c);

  return (
    <Section id="contact" eyebrow="Contact" title="Let's talk.">
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
          {items.map((c, i) => {
            const meta = META[c.type];
            if (!meta) return null;
            const { label, icon: Icon, cta } = meta;
            const external = c.type === "linkedin" || c.type === "whatsapp";
            return (
              <Reveal key={c.type} delay={i * 0.06}>
                <a
                  href={contactHref(c, WHATSAPP_GREETING)}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <SpotlightCard className="p-6">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon size={18} />
                    </span>
                    <p className="mt-5 text-sm text-muted-foreground">{label}</p>
                    <p className="mt-1 break-all font-medium">{c.value}</p>
                    <p className="mt-4 text-sm text-primary">{cta} &rarr;</p>
                  </SpotlightCard>
                </a>
              </Reveal>
            );
          })}
        </div>

        {whatsapp && (
          <Reveal delay={0.12} className="lg:col-span-2">
            <SpotlightCard className="flex h-full flex-col items-center p-8 text-center">
              <WhatsAppQR url={contactHref(whatsapp, WHATSAPP_GREETING)} />
              <h3 className="mt-6 font-semibold">Scan to chat on WhatsApp</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Point your phone camera at the code to start a chat with me directly.
              </p>
            </SpotlightCard>
          </Reveal>
        )}

        <Reveal delay={0.16} className="lg:col-span-5">
          <ContactTerminal contacts={contacts} />
        </Reveal>
      </div>
    </Section>
  );
}
