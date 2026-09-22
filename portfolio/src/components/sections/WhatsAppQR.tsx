"use client";

import { QRCodeSVG } from "qrcode.react";

/** QR stays dark-on-white in both themes so phone cameras can always read it. */
export function WhatsAppQR({ url }: { url: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <QRCodeSVG value={url} size={176} level="M" marginSize={0} fgColor="#111827" bgColor="#ffffff" />
    </div>
  );
}
