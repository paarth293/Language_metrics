"use client";

import React, { useState, useEffect } from "react";
import {
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Globe,
  BookOpen,
  Camera,
  Key,
  Bell,
  BellOff,
  Trash2,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { LANGUAGES, getLevelsForLanguage } from "@/lib/languages";

type ProfileData = {
  profile: {
    userId: string;
    name: string;
    email: string;
    emailVerified: boolean;
    avatarUrl: string | null;
    languageToLearn: string;
    proficiencyLevel: string;
    status: string;
    onboardingComplete: boolean;
    totalBookings: number;
    completedBookings: number;
    memberSince: string;
  };
};

export default function StudentProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Profile fields
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [languageToLearn, setLanguageToLearn] = useState("");
  const [proficiencyLevel, setProficiencyLevel] = useState("");

  // Read-only metadata
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [status, setStatus] = useState("");
  const [totalBookings, setTotalBookings] = useState(0);
  const [completedBookings, setCompletedBookings] = useState(0);
  const [memberSince, setMemberSince] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Push notifications
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Account deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProfile();
    checkPushStatus();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/students/profile", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load profile");
      const data: ProfileData = await res.json();
      const p = data.profile;

      setName(p.name);
      setEmail(p.email);
      setEmailVerified(p.emailVerified);
      setAvatarUrl(p.avatarUrl || "");
      setLanguageToLearn(p.languageToLearn);
      setProficiencyLevel(p.proficiencyLevel);
      setStatus(p.status);
      setTotalBookings(p.totalBookings);
      setCompletedBookings(p.completedBookings);
      setMemberSince(
        new Date(p.memberSince).toLocaleDateString("en-IN", {
          year: "numeric", month: "long", day: "numeric",
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/students/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, avatarUrl, languageToLearn, proficiencyLevel }),
      });
      if (!res.ok) throw new Error("Failed to save profile");
      setSuccessMsg("Profile updated successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/students/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }
      setPasswordSuccess("Password changed successfully!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setChangingPassword(false);
    }
  };

  const checkPushStatus = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") setPushEnabled(true);
  };

  const handleTogglePush = async () => {
    setPushLoading(true);
    try {
      if (!pushEnabled) {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_KEY,
          });

          await fetch("/api/students/device-tokens", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ token: JSON.stringify(subscription), platform: "web" }),
          });
          setPushEnabled(true);
        }
      } else {
        setPushEnabled(false);
      }
    } catch (err) {
      console.error("Push toggle failed:", err);
    } finally {
      setPushLoading(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/students/profile/request-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to request deletion");
      setShowDeleteModal(false);
      setSuccessMsg("Account deletion request submitted. We'll process it within 30 days.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 max-w-4xl mx-auto w-full">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 h-full flex flex-col max-w-4xl mx-auto w-full">
      {/* ── HEADER ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] sm:text-[36px] font-display font-bold text-text tracking-[-0.02em] leading-tight">
            My Profile
          </h1>
          <p className="text-base text-text-muted mt-1">
            Manage your profile and learning preferences
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} variant="primary" className="flex items-center gap-2 shadow-sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-alert/10 border border-alert/20 text-alert flex items-center gap-3 text-[14px] font-medium shadow-sm">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-trust/10 border border-trust/20 text-trust flex items-center gap-3 text-[14px] font-medium shadow-sm">
          <CheckCircle2 className="w-5 h-5" /> {successMsg}
        </div>
      )}

      {/* ── PROFILE HERO ───────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#231d5e] to-[#5046c8] p-[1px] shadow-level-2">
        <div className="rounded-[15px] bg-gradient-to-br from-[#1a1547] to-[#0f0c29] p-6 relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-white/5 blur-[50px] pointer-events-none" />
          
          <div className="flex items-start gap-6 relative z-10">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center overflow-hidden shadow-sm border border-white/10">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-display font-bold text-white">{name[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            
            <div className="flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Name</label>
                  <div className="text-[16px] text-white font-bold mt-0.5">{name}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Email</label>
                  <div className="text-[14px] text-white/90 font-medium mt-0.5 flex items-center gap-2">
                    {email}
                    {emailVerified ? (
                      <Badge variant="success" className="text-[9px] py-0 px-1.5 uppercase tracking-wider font-bold">Verified</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] py-0 px-1.5 text-white/70 border-white/20 uppercase tracking-wider font-bold">Unverified</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Status</label>
                  <div className="mt-0.5">
                    <Badge variant="success" className="text-[10px] uppercase font-bold tracking-wider">{status}</Badge>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Member Since</label>
                  <div className="text-[14px] text-white/90 font-medium mt-0.5">{memberSince}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── EDIT PROFILE ─────────────────────────── */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/40">
            <CardTitle className="text-[16px] font-bold text-text flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                <User className="w-4 h-4 text-brand" />
              </div>
              Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Full Name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Avatar URL</label>
              <Input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── LEARNING PREFERENCES ─────────────────── */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/40">
            <CardTitle className="text-[16px] font-bold text-text flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-trust/10 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-trust" />
              </div>
              Learning Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Language to Learn</label>
              <select
                value={languageToLearn}
                onChange={(e) => {
                  setLanguageToLearn(e.target.value);
                  setProficiencyLevel("");
                }}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-surface px-4 py-2.5 text-[14px] text-text focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand shadow-sm transition-all"
              >
                <option value="">Select language...</option>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.name.toLowerCase()}>
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Proficiency Level</label>
              <select
                value={proficiencyLevel}
                onChange={(e) => setProficiencyLevel(e.target.value)}
                disabled={!languageToLearn}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-surface px-4 py-2.5 text-[14px] text-text focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand shadow-sm transition-all disabled:opacity-50 disabled:bg-surface-inset"
              >
                <option value="">{languageToLearn ? "Select level..." : "Pick language first"}</option>
                {getLevelsForLanguage(languageToLearn).map((lvl) => (
                  <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* ── CHANGE PASSWORD ──────────────────────── */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/40">
            <CardTitle className="text-[16px] font-bold text-text flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-action/10 flex items-center justify-center">
                <Key className="w-4 h-4 text-action" />
              </div>
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <div className="p-3 rounded-xl bg-alert/10 border border-alert/20 text-alert text-[13px] font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 rounded-xl bg-trust/10 border border-trust/20 text-trust text-[13px] font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {passwordSuccess}
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Current Password</label>
                <div className="relative mt-1.5">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">New Password</label>
                <div className="relative mt-1.5">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Confirm New Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" variant="outline" disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword} className="w-full mt-2">
                {changingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ── NOTIFICATIONS & STATS ────────────────── */}
        <div className="space-y-6">
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-[16px] font-bold text-text flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-gold-950" />
                </div>
                Push Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <p className="text-[13px] text-text-muted leading-relaxed">
                Receive instant alerts for upcoming classes, new messages, and important updates directly to your device.
              </p>
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface-inset border border-border/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${pushEnabled ? "bg-brand/10 text-brand" : "bg-text/5 text-text-muted"}`}>
                    {pushEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-text">
                      {pushEnabled ? "Notifications On" : "Notifications Off"}
                    </p>
                    <p className="text-[12px] text-text-muted">
                      {pushEnabled ? "You're receiving alerts" : "Enable to get timely updates"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleTogglePush}
                  disabled={pushLoading}
                  className={`relative w-12 h-6 rounded-full transition-colors ${pushEnabled ? "bg-brand" : "bg-border-strong"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${pushEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-[16px] font-bold text-text flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-brand" />
                </div>
                Learning Journey
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-surface-inset border border-border/40">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Total Classes</div>
                  <div className="text-[24px] font-display font-bold text-text">{totalBookings}</div>
                </div>
                <div className="p-4 rounded-xl bg-trust/5 border border-trust/20">
                  <div className="text-[11px] font-bold text-trust/80 uppercase tracking-wider mb-1">Completed</div>
                  <div className="text-[24px] font-display font-bold text-trust">{completedBookings}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* ── ACCOUNT DELETION ─────────────────────── */}
        <Card className="lg:col-span-2 border-alert/30 bg-alert/5 shadow-sm">
          <CardHeader className="pb-3 border-b border-alert/10">
            <CardTitle className="text-[16px] font-bold flex items-center gap-2 text-alert">
              <div className="w-8 h-8 rounded-lg bg-alert/10 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-alert" />
              </div>
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[14px] font-bold text-alert">Request Account Deletion</p>
                <p className="text-[13px] text-alert/80 mt-1 max-w-md">
                  This action will flag your account for deletion. All your personal data and booking history will be permanently removed within 30 days.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(true)}
                className="border-alert text-alert hover:bg-alert/10 whitespace-nowrap shadow-sm"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── DELETE MODAL ───────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-border/50 scale-in-95 animate-in">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-alert/10 flex items-center justify-center shrink-0 border border-alert/20">
                <AlertTriangle className="w-6 h-6 text-alert" />
              </div>
              <div className="pt-1">
                <h3 className="text-[20px] font-display font-bold text-text leading-tight">Delete Account</h3>
                <p className="text-[14px] text-text-muted mt-1">This action cannot be undone easily</p>
              </div>
            </div>

            <p className="text-[14px] text-text-muted leading-relaxed">
              Your account will be flagged for deletion. All data, including booking history, chat messages, and wallet balance, will be <strong className="text-text">permanently removed</strong> within 30 days.
            </p>

            <div className="space-y-2">
              <label className="text-[12px] font-medium text-text-muted">
                Type <span className="font-bold text-text">DELETE</span> to confirm
              </label>
              <Input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(""); }}>
                Cancel
              </Button>
              <Button
                onClick={handleRequestDeletion}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="bg-alert hover:bg-[#c93f31] text-white border-none shadow-sm"
              >
                {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Confirm Deletion
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
