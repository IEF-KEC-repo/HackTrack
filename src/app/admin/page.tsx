"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";

interface EditionInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

interface EditionInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  invitations?: EditionInvitation[];
}

type Notice = { type: "success" | "error"; msg: string } | null;

export default function AdminPage() {
  const [edition, setEdition] = useState<EditionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [auditCount, setAuditCount] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  // Clone Edition
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneSlug, setCloneSlug] = useState("");
  const [cloneYear, setCloneYear] = useState("");
  const [isCloning, setIsCloning] = useState(false);

  // Invite / RBAC elevation
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("COORDINATOR_VIEW");
  const [isInviting, setIsInviting] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [editionRes, auditRes] = await Promise.all([
        fetch("/api/coordinator/edition-data?slug=ht26", { cache: "no-store" }),
        fetch("/api/coordinator/audit-logs", { cache: "no-store" }),
      ]);
      const editionJson = await editionRes.json().catch(() => ({}));
      const auditJson = await auditRes.json().catch(() => ({}));
      if (!editionRes.ok) {
        throw new Error(editionJson.error || "Failed to load edition data.");
      }
      setEdition(editionJson.edition ?? null);
      setAuditCount(Array.isArray(auditJson.logs) ? auditJson.logs.length : null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load institutional data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openClone = () => {
    const base = edition?.slug ?? "ht26";
    setCloneName(edition ? `${edition.name} (New Edition)` : "New HackTrack Edition");
    setCloneSlug(`${base}-copy`);
    setCloneYear("2026-2027");
    setNotice(null);
    setCloneOpen(true);
  };

  const handleClone = async () => {
    if (!edition) {
      setNotice({ type: "error", msg: "Active edition context is not loaded yet." });
      return;
    }
    if (!cloneName.trim() || !cloneSlug.trim()) {
      setNotice({ type: "error", msg: "New edition name and slug are required." });
      return;
    }
    setIsCloning(true);
    try {
      const res = await fetch("/api/coordinator/clone-edition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSlug: edition.slug,
          newName: cloneName.trim(),
          newSlug: cloneSlug.trim(),
          academicYear: cloneYear.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to clone the edition.");
      setCloneOpen(false);
      setNotice({
        type: "success",
        msg: `Cloned "${edition.name}" into draft edition "${data.edition?.name}" (${data.edition?.slug}).`,
      });
      loadData();
    } catch (err) {
      setNotice({ type: "error", msg: err instanceof Error ? err.message : "Failed to clone the edition." });
    } finally {
      setIsCloning(false);
    }
  };

  const openInvite = () => {
    setInviteEmail("");
    setInviteRole("COORDINATOR_VIEW");
    setIssuedToken(null);
    setNotice(null);
    setInviteOpen(true);
  };

  const handleInvite = async () => {
    if (!edition) {
      setNotice({ type: "error", msg: "Active edition context is not loaded yet." });
      return;
    }
    if (!inviteEmail.includes("@")) {
      setNotice({ type: "error", msg: "Please enter a valid email address." });
      return;
    }
    setIsInviting(true);
    try {
      const res = await fetch("/api/coordinator/assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId: edition.id,
          email: inviteEmail.toLowerCase().trim(),
          role: inviteRole,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to issue the invitation.");
      setIssuedToken(data.invitation?.token ?? null);
      setNotice({
        type: "success",
        msg: `Invitation issued for ${inviteEmail} as "${inviteRole}".`,
      });
      loadData();
    } catch (err) {
      setNotice({ type: "error", msg: err instanceof Error ? err.message : "Failed to issue the invitation." });
    } finally {
      setIsInviting(false);
    }
  };

  const pendingInvites = edition?.invitations?.length ?? 0;
  const auditValue = auditCount === null ? "—" : auditCount.toLocaleString();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
            Super Admin Only
          </span>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Institutional Administration</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cross-edition lifecycle provisioning, global role elevations, and immutable audit logs.
          </p>
        </div>
      </div>

      {notice && (
        <div className="mt-6">
          <Alert variant={notice.type === "success" ? "success" : "error"} title={notice.type === "success" ? "Done" : "Action failed"}>
            {notice.msg}
          </Alert>
        </div>
      )}

      {loadError && (
        <div className="mt-6">
          <Alert variant="error" title="Institutional data partially unavailable">
            {loadError}
          </Alert>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Edition Lifecycle */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Edition Lifecycle</h2>
          <p className="mt-1 text-xs text-slate-500">
            {loading
              ? "Loading active edition…"
              : edition
              ? `Currently Active: ${edition.name} (${edition.slug})`
              : "No active edition found."}
          </p>
          {edition && (
            <div className="mt-2">
              <Badge variant={edition.status === "ACTIVE" ? "success" : "default"} size="sm">
                {edition.status}
              </Badge>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={openClone} disabled={loading || !edition}>
              + Clone Edition
            </Button>
            <Link href="/coordinator/events">
              <Button size="sm" variant="outline">
                Configure Pipeline
              </Button>
            </Link>
          </div>
        </div>

        {/* Global RBAC Elevation */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Global RBAC Elevation</h2>
          <p className="mt-1 text-xs text-slate-500">
            Assign Coordinator, Evaluator, or Mentor credentials.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {loading ? "Loading invitations…" : `${pendingInvites} pending invitation${pendingInvites === 1 ? "" : "s"} this edition.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={openInvite} disabled={loading || !edition}>
              Generate Staff Invite Token
            </Button>
            <Link href="/coordinator/users">
              <Button size="sm" variant="outline">
                Manage Users
              </Button>
            </Link>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">System Audit Trail</h2>
          <p className="mt-1 text-xs text-slate-500">
            Real-time log of security events and score overrides.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {loading ? "Loading audit records…" : `${auditValue} recorded audit ${auditCount === 1 ? "entry" : "entries"}.`}
          </p>
          <div className="mt-4">
            <Link
              href="/coordinator/audit"
              className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:underline"
            >
              View all {auditValue} audit records →
            </Link>
          </div>
        </div>
      </div>

      {/* Clone Edition Modal */}
      <Modal
        isOpen={cloneOpen}
        onClose={() => setCloneOpen(false)}
        title="Clone Edition"
        description="Duplicates the active edition's events, rubrics, criteria, and scale anchors into a new draft."
      >
        <div className="space-y-4">
          <Input
            label="New Edition Name"
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            placeholder="HackTrack 2027"
          />
          <Input
            label="New Slug"
            value={cloneSlug}
            onChange={(e) => setCloneSlug(e.target.value)}
            placeholder="ht27"
            hint="Lowercase identifier used in URLs (e.g. ht27)."
          />
          <Input
            label="Academic Year"
            value={cloneYear}
            onChange={(e) => setCloneYear(e.target.value)}
            placeholder="2026-2027"
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCloneOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleClone} isLoading={isCloning}>
              Clone Edition
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite Modal */}
      <Modal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Generate Staff Invite Token"
        description="Issues a real invite token for the active edition. Share the token so the recipient can redeem it at /auth/register."
      >
        <div className="space-y-4">
          <Input
            label="Institutional Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="user@college.edu"
          />
          <Select
            label="Designate Role Tier"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            options={[
              { value: "COORDINATOR_VIEW", label: "Coordinator (View-Only: read-only visibility)" },
              { value: "COORDINATOR_MANAGE", label: "Coordinator (Manage: full operations)" },
              { value: "EVALUATOR", label: "Evaluator (scoring cockpit)" },
              { value: "MENTOR", label: "Mentor (assigned CPR cohort)" },
              { value: "PARTICIPANT", label: "Participant (team leader / member)" },
            ]}
          />

          {issuedToken && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-900">Invite token issued — share securely:</p>
              <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-xs text-emerald-900 border border-emerald-200">
                {issuedToken}
              </code>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Close
            </Button>
            <Button onClick={handleInvite} isLoading={isInviting}>
              Generate Invitation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
