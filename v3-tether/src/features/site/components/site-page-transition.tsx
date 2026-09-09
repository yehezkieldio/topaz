"use client";

import { usePathname } from "next/navigation";

export const SitePageTransition = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const pathname = usePathname();

  return (
    <div className="route-content-enter" key={pathname}>
      {children}
    </div>
  );
};
