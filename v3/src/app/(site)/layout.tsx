import { SiteShell } from "@/features/site/components/site-shell";

const SiteLayout = ({ children }: LayoutProps<"/">) => (
  <SiteShell>{children}</SiteShell>
);

export default SiteLayout;
