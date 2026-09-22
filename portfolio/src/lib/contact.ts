import type { ContactLink, ContactType } from "./types";

const digits = (v: string) => v.replace(/\D/g, "");
const withProtocol = (v: string) => (v.startsWith("http") ? v : `https://${v}`);

/** Builds the real link for a contact entry. */
export function contactHref(link: ContactLink, message?: string): string {
  switch (link.type) {
    case "email":
      return `mailto:${link.value}`;
    case "phone":
      return `tel:+${digits(link.value)}`;
    case "whatsapp": {
      const base = `https://wa.me/${digits(link.value)}`;
      return message ? `${base}?text=${encodeURIComponent(message)}` : base;
    }
    case "linkedin":
    case "github":
      return withProtocol(link.value);
  }
}

export function findContact(contacts: ContactLink[], type: ContactType) {
  return contacts.find((c) => c.type === type);
}

export const WHATSAPP_GREETING = "Hi Rahul, I found your portfolio and would like to connect.";
