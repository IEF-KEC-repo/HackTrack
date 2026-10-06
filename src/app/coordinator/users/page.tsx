"use client";

import { useState } from "react";
import { CoordinatorShell } from "@/components/coordinator/CoordinatorShell";
import { ActionButton } from "@/components/coordinator/ActionButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";

interface MemberItem {
  id: string;
  name: string;
  email: string;
  role: "PARTICIPANT" | "MENTOR" | "EVALUATOR" | "COORDINATOR_VIEW" | "COORDINATOR_MANAGE" | "SUPER_ADMIN";
  teamName?: string;
  joinedAt: string;
}

export default function UsersRosterPage() {
  const [members, setMembers] = useState<MemberItem[]>([
    { id: "m1", name: "Dr. Evelyn Reed", email: "superadmin@hacktrack.edu", role: "SUPER_ADMIN", joinedAt: "2026-08-01" },
    { id: "m2", name: "Marcus Vance", email: "coord.manage@hacktrack.edu", role: "COORDINATOR_MANAGE", joinedAt: "2026-08-01" },
    { id: "m3", name: "Dean Sarah Jenkins", email: "coord.view@hacktrack.edu", role: "COORDINATOR_VIEW", joinedAt: "2026-08-01" },
    { id: "m4", name: "Alex Rivera", email: "evaluator@hacktrack.edu", role: "EVALUATOR", joinedAt: "2026-08-05" },
    { id: "m5", name: "Prof. Alan Turing", email: "mentor@hacktrack.edu", role: "MENTOR", joinedAt: "2026-08-05" },
    { id: "m6", name: "Priya Sharma", email: "lead@hacktrack.edu", role: "PARTICIPANT", teamName: "QuantumForge", joinedAt: "2026-08-10" },
    { id: "m7", name: "Liam O'Connor", email: "member@hacktrack.edu", role: "PARTICIPANT", teamName: "QuantumForge", joinedAt: "2026-08-10" },
  ]);

  const [filterRole, setFilterRole] = useState("ALL");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<any>("COORDINATOR_VIEW");
  const [inviteName, setInviteName] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const filtered = members.filter((m) => {
    if (filterRole === "ALL") return true;
    return m.role === filterRole;
  });

  const handleIssueInvite = () => {
    if (!inviteEmail || !inviteEmail.includes("@")) {
      setNotification({ type: "error", msg: "Please enter a valid email address." });
      return;
    }

    const newMember: MemberItem = {
      id: `usr_${Date.now()}`,
      name: inviteName || "Invited User",
      email: inviteEmail.toLowerCase().trim(),
      role: inviteRole,
      joinedAt: "Pending Invite",
    };

    setMembers([newMember, ...members]);
    setInviteModalOpen(false);
    setInviteEmail("");
    setInviteName("");
    setNotification({
      type: "success",
      msg: `Issued invitation for ${inviteEmail} with role "${inviteRole}".`,
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "purple" as const;
      case "COORDINATOR_MANAGE":
        return "purple" as const;
      case "COORDINATOR_VIEW":
        return "default" as const;
      case "EVALUATOR":
        return "info" as const;
      case "MENTOR":
        return "warning" as const;
      default:
        return "success" as const;
    }
  };

  return (
    <CoordinatorShell
      title="User Roster & Role Assignments"
      description="Manage access permissions across the institutional hierarchy, including Coordinator Manage vs View-only designations."
      action={
        <div className="flex gap-2">
          <ActionButton onClick={() => setInviteModalOpen(true)}>+ Issue Direct Invite</ActionButton>
        </div>
      }
    >
      <div className="space-y-6">
        {notification && (
          <Alert variant={notification.type === "success" ? "success" : "error"} title="Role Assignment Notice">
            {notification.msg}
          </Alert>
        )}

        {/* Filter Controls */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">Filter by Role:</span>
            <Select
              className="w-48 text-xs py-1"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              options={[
                { value: "ALL", label: "All Roles (7 Members)" },
                { value: "COORDINATOR_MANAGE", label: "Coordinator (Manage)" },
                { value: "COORDINATOR_VIEW", label: "Coordinator (View-Only)" },
                { value: "EVALUATOR", label: "Evaluators" },
                { value: "MENTOR", label: "Mentors" },
                { value: "PARTICIPANT", label: "Participants" },
              ]}
            />
          </div>
          <span className="text-xs text-slate-500">Showing {filtered.length} member(s)</span>
        </div>

        {/* Users Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left font-semibold">User</th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold">Assigned Edition Role</th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold">Team Assignment</th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold">Onboarded</th>
                  <th scope="col" className="px-6 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{item.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={getRoleBadgeVariant(item.role)} size="sm">
                        {item.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {item.teamName ? (
                        <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {item.teamName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">{item.joinedAt}</td>
                    <td className="px-6 py-4 text-right">
                      <ActionButton size="sm" variant="outline">
                        Edit Role
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Direct Invite Modal */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Issue Role Invitation"
        description="Invite a faculty or student member with explicit edition privileges."
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Dr. Alan Turing"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
          />
          <Input
            label="Institutional Email"
            type="email"
            placeholder="user@college.edu"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Select
            label="Designate Role Tier"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as any)}
            options={[
              { value: "COORDINATOR_VIEW", label: "Coordinator (View-Only: Read-only visibility)" },
              { value: "COORDINATOR_MANAGE", label: "Coordinator (Manage: Full operations CRUD)" },
              { value: "EVALUATOR", label: "Evaluator (Scoring Cockpit)" },
              { value: "MENTOR", label: "Mentor (Assigned CPR Cohort)" },
              { value: "PARTICIPANT", label: "Participant (Team Leader / Member)" },
            ]}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </Button>
            <ActionButton onClick={handleIssueInvite}>Generate Invitation</ActionButton>
          </div>
        </div>
      </Modal>
    </CoordinatorShell>
  );
}
