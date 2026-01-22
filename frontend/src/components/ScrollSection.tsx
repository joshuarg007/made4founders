import { motion } from "framer-motion";
import type { ReactNode } from "react";

const prefersReduced =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

interface ScrollSectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  fullHeight?: boolean;
  center?: boolean;
}

export default function ScrollSection({
  children,
  className = "",
  id,
  fullHeight = true,
  center = true
}: ScrollSectionProps) {
  return (
    <section
      id={id}
      className={`
        ${fullHeight ? "snap-section" : "snap-section-auto"}
        ${center && fullHeight ? "" : ""}
        ${className}
      `}
    >
      <motion.div
        initial={prefersReduced ? {} : { opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.6 }}
        className="w-full"
      >
        {children}
      </motion.div>
    </section>
  );
}
