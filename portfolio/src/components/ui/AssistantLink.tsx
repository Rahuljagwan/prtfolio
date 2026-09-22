"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Link to the assistant page. It is a real next/link, so opening the page is a client-side navigation (no full reload,
 * the theme and scroll state carry over). Prefetching is off by default so the home page does not download the
 * assistant's code up front; instead it is warmed once, on hover / focus / touch, so the click still feels instant.
 */
export function AssistantLink({ className, children, ...rest }: Omit<React.ComponentProps<typeof Link>, "href" | "prefetch">) {
  const router = useRouter();
  const warmed = useRef(false);
  const warm = () => {
    if (warmed.current) return;
    warmed.current = true;
    router.prefetch("/assistant");
  };
  return (
    <Link href="/assistant" prefetch={false} onPointerEnter={warm} onFocus={warm} onTouchStart={warm} className={className} {...rest}>
      {children}
    </Link>
  );
}
