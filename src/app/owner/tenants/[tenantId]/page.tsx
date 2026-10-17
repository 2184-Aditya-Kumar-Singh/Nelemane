import { TenantDetail } from "./tenant-detail";

export default async function TenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return <main className="mx-auto max-w-4xl px-5 py-9 sm:px-8"><TenantDetail tenantId={tenantId} /></main>;
}
