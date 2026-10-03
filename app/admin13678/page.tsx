import type { Metadata } from "next";
import CrmDashboard from "@/components/crm-dashboard";
import "../crm.css";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminPage() {
  return <CrmDashboard />;
}
