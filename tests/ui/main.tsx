import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import ActivityLog from "../../app/dashboard/admin/activity/page";
import AdminLoan from "../../app/dashboard/admin/loans/[id]/page";
import BorrowerLoan from "../../app/dashboard/borrower/loans/[id]/page";
import AdminLoans from "../../app/dashboard/admin/loans/page";
import AdminOverview from "../../app/dashboard/admin/page";
import "../../app/globals.css";

const page = new URLSearchParams(window.location.search).get("page");
createRoot(document.getElementById("root")!).render(
  <main className="mx-auto min-w-0 max-w-7xl p-4 pb-64 sm:p-6 sm:pb-40 lg:p-8">
    {page === "activity" ? <ActivityLog /> : page === "overview" ? <AdminOverview /> : page === "bulk" ? (
      <AdminLoans />
    ) : page === "borrower" ? (
      <BorrowerLoan />
    ) : (
      <AdminLoan />
    )}
    <Toaster style={{ zIndex: 55 }} position="bottom-right" closeButton />
  </main>,
);
