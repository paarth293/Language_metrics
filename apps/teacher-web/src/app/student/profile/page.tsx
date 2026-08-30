"use client";

import React, { useState, useEffect } from "react";
import {
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Mail,
  Globe,
  BookOpen,
  Shield,
  Camera,
  Key,
  Bell,
  BellOff,
  Trash2,
  AlertTriangle,
  Eye,
  EyeOff,
  Link,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
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
      const res = await fetch("/api/students/profile", {
        credentials: "include",
      });
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
          year: "numeric",
          month: "long",
          day: "numeric",
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
        body: JSON.stringify({
          name,
          avatarUrl,
          languageToLearn,
          proficiencyLevel,
        }),
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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setChangingPassword(false);
    }
  };

  const checkPushStatus = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      setPushEnabled(true);
    }
  };

  const handleTogglePush = async () => {
    setPushLoading(true);
    try {
      if (!pushEnabled) {
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          // Register device token
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_KEY,
          });

          await fetch("/api/students/device-tokens", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              token: JSON.stringify(subscription),
              platform: "web",
            }),
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
      setSuccessMsg(
        "Account deletion request submitted. We'll process it within 30 days."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-[3px] border-brand/20 border-t-brand animate-spin" />
          </div>
          <span className="text-sm text-text-muted font-medium">
            Loading profile...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-text">
            My Profile
          </h1>
          <p className="text-text-muted mt-1">
            Manage your profile and learning preferences
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="primary"
          className="flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger flex items-center gap-3 text-sm font-medium">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-trust/10 border border-trust/20 text-trust flex items-center gap-3 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {/* Profile Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f0c29] via-[#1a1547] to-[#231d5e] p-[1px]">
        <div className="rounded-[15px] bg-gradient-to-br from-[#1a1547] to-[#0f0c29] p-6">
          <div className="flex items-start gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-amber-400">
                    {name[0]}
                  </span>
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                    Name
                  </label>
                  <div className="text-white font-semibold mt-1">{name}</div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="text-white/80 font-medium mt-1 flex items-center gap-2">
                    {email}
                    {emailVerified ? (
                      <Badge variant="success" className="text-[9px] py-0">
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] py-0">
                        Unverified
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                    Status
                  </label>
                  <div className="mt-1">
                    <Badge variant="success">{status}</Badge>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                    Member Since
                  </label>
                  <div className="text-white/80 mt-1">{memberSince}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Edit Profile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-brand" />
              </div>
              Edit Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Full Name
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Avatar URL
              </label>
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

        {/* Learning Preferences */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-brand" />
              </div>
              Learning Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Language to Learn
              </label>
              <select
                value={languageToLearn}
                onChange={(e) => {
                  setLanguageToLearn(e.target.value);
                  setProficiencyLevel("");
                }}
                className="mt-1.5 w-full rounded-xl border border-border bg-surface-inset px-4 py-2.5 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
              >
                <option value="">Select language...</option>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.name.toLowerCase()}>
                    {" "}
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Proficiency Level
              </label>
              <select
                value={proficiencyLevel}
                onChange={(e) => setProficiencyLevel(e.target.value)}
                disabled={!languageToLearn}
                className="mt-1.5 w-full rounded-xl border border-border bg-surface-inset px-4 py-2.5 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
              >
                <option value="">
                  {languageToLearn ? "Select level..." : "Pick language first"}
                </option>
                {getLevelsForLanguage(languageToLearn).map((lvl) => (
                  <option key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center">
                <Key className="w-3.5 h-3.5 text-brand" />
              </div>
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {passwordSuccess}
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Current Password
                </label>
                <div className="relative mt-1.5">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative mt-1.5">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1.5"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="w-full"
              >
                {changingPassword ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Key className="w-4 h-4 mr-2" />
                )}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Push Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-amber-600" />
              </div>
              Push Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-text-muted">
              Receive notifications for upcoming classes, new messages, and
              important updates.
            </p>
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-inset">
              <div className="flex items-center gap-3">
                {pushEnabled ? (
                  <Bell className="w-5 h-5 text-amber-600" />
                ) : (
                  <BellOff className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-text">
                    {pushEnabled ? "Notifications Enabled" : "Notifications Off"}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {pushEnabled
                      ? "You'll receive push notifications"
                      : "Enable to get timely updates"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleTogglePush}
                disabled={pushLoading}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  pushEnabled ? "bg-amber-600" : "bg-gray-300"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    pushEnabled ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-amber-600" />
              </div>
              Learning Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-surface-inset">
                <div className="text-2xl font-bold text-text font-display">
                  {totalBookings}
                </div>
                <div className="text-xs text-text-muted mt-1">
                  Total Bookings
                </div>
              </div>
              <div className="text-center p-4 rounded-xl bg-surface-inset">
                <div className="text-2xl font-bold text-text font-display">
                  {completedBookings}
                </div>
                <div className="text-xs text-text-muted mt-1">Completed</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-surface-inset">
                <div className="text-2xl font-bold text-text font-display">
                  {languageToLearn || "—"}
                </div>
                <div className="text-xs text-text-muted mt-1">Learning</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-surface-inset">
                <div className="text-2xl font-bold text-text font-display capitalize">
                  {proficiencyLevel?.toLowerCase() || "—"}
                </div>
                <div className="text-xs text-text-muted mt-1">Level</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Deletion */}
        <Card className="lg:col-span-2 border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </div>
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 border border-red-200">
              <div>
                <p className="text-sm font-medium text-red-800">
                  Request Account Deletion
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  This action will flag your account for deletion. Your data will
                  be removed within 30 days.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(true)}
                className="border-red-300 text-red-600 hover:bg-red-50 flex-shrink-0 ml-4"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-navy-900">Delete Account</h3>
                <p className="text-sm text-gray-500">
                  This action cannot be undone easily
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Your account will be flagged for deletion. All your data, including
              booking history, recordings, chat messages, and wallet balance, will
              be permanently removed within 30 days.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="font-bold">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRequestDeletion}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Request Deletion
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
