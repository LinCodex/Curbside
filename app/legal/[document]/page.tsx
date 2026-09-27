import { notFound } from "next/navigation";
import LegalPage from "@/components/legal-page";
import { legalDocuments } from "@/lib/legal";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const { document } = await params;
  return {
    title: (legalDocuments[document]?.title || "Not found") + " — Curbside",
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const { document } = await params;
  if (!Object.hasOwn(legalDocuments, document)) notFound();
  return <LegalPage document={document} />;
}
