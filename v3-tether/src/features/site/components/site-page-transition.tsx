"use client";

import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

export const SitePageTransition = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <ViewTransition
    default="none"
    enter={{
      default: "fade-in",
      "nav-back": "nav-back",
      "nav-forward": "nav-forward",
    }}
    exit={{
      default: "fade-out",
      "nav-back": "nav-back",
      "nav-forward": "nav-forward",
    }}
    key={usePathname()}
  >
    {children}
  </ViewTransition>
);
