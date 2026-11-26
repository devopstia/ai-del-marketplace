import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SaleBanner } from "@/components/SaleBanner";
import { getDeals } from "@/lib/catalog";
import { getPaths } from "@/lib/paths-server";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [deals, paths] = await Promise.all([getDeals(), getPaths()]);
  return (
    <>
      <SaleBanner deals={deals} />
      <SiteHeader dealsCount={deals?.onSaleCount ?? 0} />
      <main id="main">{children}</main>
      <SiteFooter careerPaths={paths.length > 0} />
    </>
  );
}
