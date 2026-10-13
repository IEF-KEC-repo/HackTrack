import { redirect } from "next/navigation";

/**
 * The former `/coordinator/manage` stub duplicated controls that the real
 * operational console at `/coordinator` already implements against live data
 * (reviewer allocation + Z-score normalization live in
 * `/coordinator/evaluations`). Rather than maintain two consoles, Manage-tier
 * coordinators are routed straight to the real console.
 */
export default function CoordinatorManagePage() {
  redirect("/coordinator");
}
