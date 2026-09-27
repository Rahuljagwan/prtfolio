import { ArrowUpRight, Mail, MessageCircle, Phone } from "lucide-react";
import { Chapter, Headline, SectionShell } from "@/components/ui/editorial";
import { Reveal } from "@/components/ui/Reveal";
import { WhatsAppQR } from "./WhatsAppQR";
import { ContactTerminal } from "./ContactTerminal";
import { LinkedinIcon } from "@/components/ui/BrandIcons";
import { contactHref, findContact, WHATSAPP_GREETING } from "@/lib/contact";
import type { ContactLink, ContactType } from "@/lib/types";

const META: Partial<Record<ContactType, { label: string; icon: React.ComponentType<{ size?: string | number }> }>> = {
  email: { label: "Email", icon: Mail },
  phone: { label: "Call", icon: Phone },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  linkedin: { label: "LinkedIn", icon: LinkedinIcon },
};

const ORDER: ContactType[] = ["email", "phone", "whatsapp", "linkedin"];

/**
 * Contact is the end of the journey, so it is the beacon: a huge closing line, the address set as a headline that underlines
 * itself, the other channels as rows, and the WhatsApp code inside rings that pulse outward like the beacon in the 3D scene.
 */
export function Contact({ contacts }: { contacts: ContactLink[] }) {
  const whatsapp = findContact(contacts, "whatsapp");
  const email = findContact(contacts, "email");
  const others = ORDER.filter((t) => t !== "email")
    .map((t) => findContact(contacts, t))
    .filter((c): c is ContactLink => !!c);

  return (
    <SectionShell id="contact" className="pb-16 md:pb-24">
      <div className="wrap">
        <div className="veil veil-strong">
          <Chapter n="08" label="Contact" />
          <Headline lines={["Let's talk."]} className="mt-7 text-5xl md:text-7xl" />
        </div>

        <div className="mt-16 grid items-center gap-x-20 gap-y-16 lg:mt-24 lg:grid-cols-12">
          <div className="veil veil-r lg:col-span-7">
            {email && (
              <Reveal delay={0.1}>
                <p className="mono-label">Write to me</p>
                <a href={contactHref(email, WHATSAPP_GREETING)} className="mail-link mt-3 block break-all text-2xl font-semibold tracking-tight text-foreground focus-visible:outline-none md:text-4xl">
                  {email.value}
                </a>
              </Reveal>
            )}

            <div className="mt-12">
              {others.map((c, i) => {
                const meta = META[c.type];
                if (!meta) return null;
                const Icon = meta.icon;
                const external = c.type === "linkedin" || c.type === "whatsapp";
                return (
                  <Reveal key={c.type} delay={0.14 + i * 0.07}>
                    <a
                      href={contactHref(c, WHATSAPP_GREETING)}
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="channel group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <span className="text-primary">
                        <Icon size={20} />
                      </span>
                      <span className="min-w-0">
                        <span className="mono-label block">{meta.label}</span>
                        <span className="mt-1 block break-all text-lg font-medium">{c.value}</span>
                      </span>
                      <ArrowUpRight size={20} aria-hidden className="arrow text-primary" />
                    </a>
                  </Reveal>
                );
              })}
            </div>
          </div>

          {whatsapp && (
            <Reveal delay={0.2} variant="fade" className="flex justify-center lg:col-span-5">
              <div className="veil veil-soft text-center">
                <div className="beacon mx-auto">
                  <span aria-hidden className="beacon-ring" style={{ "--bd": "0s" } as React.CSSProperties} />
                  <span aria-hidden className="beacon-ring" style={{ "--bd": "2s" } as React.CSSProperties} />
                  <span aria-hidden className="beacon-ring" style={{ "--bd": "4s" } as React.CSSProperties} />
                  <span aria-hidden className="beacon-dash" />
                  <WhatsAppQR url={contactHref(whatsapp, WHATSAPP_GREETING)} />
                </div>
                <p className="mt-6 font-semibold">Scan to chat on WhatsApp</p>
                <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">Point your phone camera at the code to start a chat with me directly.</p>
              </div>
            </Reveal>
          )}
        </div>

        <Reveal delay={0.1} className="mt-20">
          <ContactTerminal contacts={contacts} />
        </Reveal>
      </div>
    </SectionShell>
  );
}
