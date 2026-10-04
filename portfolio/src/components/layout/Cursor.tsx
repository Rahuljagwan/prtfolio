"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * Trailing ring cursor. Only mounts on fine pointers without reduced motion; the native cursor stays visible.
 * The ring only follows pointer movement, so on its own it would stay where the pointer last moved (while scrolling with the wheel
 * or the scrollbar, or after the pointer left the window) and read as a stray circle. It therefore fades out after a couple of
 * seconds of stillness and as soon as the pointer leaves the page, and comes back where the pointer is when it moves again.
 *
 * It starts invisible and is never shown until the pointer has really been seen: the spring is placed straight onto the first real
 * position instead of travelling there from its parking spot (which read as a circle sliding in from the top-left corner on load),
 * and the (0, 0) event some browsers emit before they know where the pointer is, or a tap from touch or pen, is not a position.
 */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [active, setActive] = useState(false);
  const placed = useRef(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 500, damping: 40, mass: 0.3 });
  const sy = useSpring(y, { stiffness: 500, damping: 40, mass: 0.3 });

  useEffect(() => {
    const ok =
      window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ok) return;
    setEnabled(true);

    let idle: ReturnType<typeof setTimeout>;
    const move = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      if (!placed.current) {
        if (e.clientX === 0 && e.clientY === 0) return;
        placed.current = true;
        // Straight to the pointer, no flight across the screen.
        x.jump(e.clientX);
        y.jump(e.clientY);
        sx.jump(e.clientX);
        sy.jump(e.clientY);
      }
      x.set(e.clientX);
      y.set(e.clientY);
      setHovering(!!(e.target as HTMLElement)?.closest("a, button, [role='button']"));
      setActive(true);
      clearTimeout(idle);
      idle = setTimeout(() => setActive(false), 2200);
    };
    const leave = () => {
      clearTimeout(idle);
      setActive(false);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
    window.addEventListener("blur", leave);
    return () => {
      clearTimeout(idle);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("mouseleave", leave);
      window.removeEventListener("blur", leave);
    };
  }, [x, y, sx, sy]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden
      style={{ x: sx, y: sy }}
      className="pointer-events-none fixed left-0 top-0 z-[70]"
    >
      <motion.div
        initial={{ opacity: 0, scale: 1 }}
        animate={{ scale: hovering ? 1.9 : 1, opacity: active ? (hovering ? 0.5 : 0.9) : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="-ml-3 -mt-3 h-6 w-6 rounded-full border border-primary"
      />
    </motion.div>
  );
}
