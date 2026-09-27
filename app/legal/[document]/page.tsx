import { notFound } from "next/navigation";
import LegalPage from "@/components/legal-page";
import { legalDocuments } from "@/lib/legal";

export function generateStaticParams() {
  return Object.keys(legalDocuments).map((document) => ({
    document,
  }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const { document } = await params;
  const doc = legalDocuments[document];
  return {
    title: doc?.title || "Not Found",
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
