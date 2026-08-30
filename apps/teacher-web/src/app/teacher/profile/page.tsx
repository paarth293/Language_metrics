"use client";

import React, { useState, useEffect } from "react";
import {
  Save,
  Clock,
  DollarSign,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  User,
  FileText,
  Video,
  Globe,
  Shield,
  Camera,
  Edit3,
  Sparkles,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const COMMISSION_RATE = 0.3;

const DOC_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  EDUCATION: { label: "Qualification Certificate", icon: "🎓" },
  ID_PROOF: { label: "ID Proof", icon: "🪪" },
  LANGUAGE_CERTIFICATE: { label: "Language Certificate", icon: "📜" },
  EXPERIENCE_LETTER: { label: "Experience Document", icon: "💼" },
  OTHER: { label: "Other Document", icon: "📄" },
};

const DOC_STATUS_COLORS: Record<string, string> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

type ProfileData = {
  profile: {
    userId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    bio: string | null;
    language: string | null;
    languages: string[];
    experienceLevel: string;
    status: string;
    demoVideoUrl: string | null;
    rates: Array<{ id: string; type: string; amount: number }>;
    availability: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
    documents: Array<{
      id: string;
      type: string;
      url: string;
      status: string;
      notes: string | null;
      createdAt: string;
    }>;
  };
};

type AvailabilitySlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export default function TeacherProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Profile fields
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [demoVideoUrl, setDemoVideoUrl] = useState("");

  // Rates
  const [hourlyRate, setHourlyRate] = useState(0);
  const [courseRate, setCourseRate] = useState(0);

  // Availability
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);

  // Profile metadata (read-only)
  const [profileName, setProfileName] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [profileLanguage, setProfileLanguage] = useState("");
  const [profileLanguages, setProfileLanguages] = useState<string[]>([]);
  const [profileExperience, setProfileExperience] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [documents, setDocuments] = useState<{ id: string; type: string; status: string; url: string; notes?: string | null; createdAt: string }[]>([]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/teachers/profile", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load profile");
      const data: ProfileData = await res.json();
      const p = data.profile;

      setProfileName(p.name);
      setProfileEmail(p.email);
      setProfileStatus(p.status);
      setProfileLanguage(p.language || "");
      setProfileLanguages(p.languages || []);
      setProfileExperience(p.experienceLevel);
      setBio(p.bio || "");
      setAvatarUrl(p.avatarUrl || "");
      setDemoVideoUrl(p.demoVideoUrl || "");
      setDocuments(p.documents || []);

      const rates = p.rates || [];
      setHourlyRate((rates.find((r: { type: string; amount: number }) => r.type === "HOURLY")?.amount || 0) / 100);
      setCourseRate((rates.find((r: { type: string; amount: number }) => r.type === "COURSE")?.amount || 0) / 100);
      setAvailability(p.availability || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
  }, []);


  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/teachers/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bio, avatarUrl, demoVideoUrl }),
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

  const handleSaveSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/teachers/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          hourlyRate: Math.round(hourlyRate * 100),
          courseRate: Math.round(courseRate * 100),
          availability,
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setSuccessMsg("Settings saved successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const addSlot = (day: number) => {
    setAvailability([...availability, { dayOfWeek: day, startTime: "09:00", endTime: "17:00" }]);
  };

  const updateSlot = (index: number, field: keyof AvailabilitySlot, value: string) => {
    const updated = [...availability];
    updated[index] = { ...updated[index], [field]: value };
    setAvailability(updated);
  };

  const removeSlot = (index: number) => {
    const updated = [...availability];
    updated.splice(index, 1);
    setAvailability(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-[3px] border-brand/20 border-t-brand animate-spin" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-[3px] border-transparent border-t-gold animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          </div>
          <span className="text-sm text-text-muted font-medium">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-text">Profile & Settings</h1>
          <p className="text-text-muted mt-1">Manage your public profile, rates, and availability</p>
        </div>
        <Button onClick={handleSaveProfile} disabled={saving} variant="primary" className="flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Profile
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

      {/* Profile Overview */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f0c29] via-[#1a1547] to-[#231d5e] p-[1px]">
        <div className="rounded-[15px] bg-gradient-to-br from-[#1a1547] to-[#0f0c29] p-6">
          <div className="flex items-start gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={profileName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-amber-400">{profileName[0]}</span>
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Full Name</label>
                  <div className="text-white font-semibold mt-1">{profileName}</div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Email</label>
                  <div className="text-white/80 font-medium mt-1">{profileEmail}</div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Status</label>
                  <div className="mt-1">
                    <Badge
                      variant={
                        profileStatus === "APPROVED" ? "success" : profileStatus === "REJECTED" ? "danger" : "warning"
                      }
                    >
                      {profileStatus.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Experience</label>
                  <div className="text-white/80 mt-1">{profileExperience}</div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Primary Language</label>
                  <div className="text-white/80 mt-1">{profileLanguage || "Not set"}</div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Languages</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profileLanguages.length > 0 ? (
                      profileLanguages.map((l) => (
                        <Badge key={l} variant="default" className="text-xs bg-white/10 text-white/70 border-white/10">{l}</Badge>
                      ))
                    ) : (
                      <span className="text-white/40 text-sm">Not set</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Bio */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center">
                  <Edit3 className="w-3.5 h-3.5 text-brand" />
                </div>
                Bio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell students about your teaching style, experience, and what makes you unique..."
                rows={4}
                className="w-full rounded-xl border border-border bg-surface-inset px-4 py-3 text-sm text-text placeholder:text-text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all resize-none"
              />
              <p className="text-[11px] text-text-subtle mt-1.5">{bio.length}/500 characters</p>
            </CardContent>
          </Card>

          {/* Demo Video */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center">
                  <Video className="w-3.5 h-3.5 text-brand" />
                </div>
                Intro Video
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="url"
                placeholder="YouTube or Vimeo URL"
                value={demoVideoUrl}
                onChange={(e) => setDemoVideoUrl(e.target.value)}
              />
              <p className="text-[11px] text-text-subtle mt-1.5">
                A short intro video helps students get to know you.
              </p>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                </div>
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Hourly Rate (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="mt-1.5"
                />
                <div className="mt-2 p-3 bg-surface-inset rounded-xl border border-border text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Platform fee ({COMMISSION_RATE * 100}%):</span>
                    <span className="text-danger">-₹{(hourlyRate * COMMISSION_RATE).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-text border-t border-border pt-1.5">
                    <span>You earn:</span>
                    <span className="text-trust">₹{(hourlyRate * (1 - COMMISSION_RATE)).toFixed(0)}/hr</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Course Rate (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={courseRate}
                  onChange={(e) => setCourseRate(Number(e.target.value))}
                  className="mt-1.5"
                />
                <div className="mt-2 p-3 bg-surface-inset rounded-xl border border-border text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Platform fee ({COMMISSION_RATE * 100}%):</span>
                    <span className="text-danger">-₹{(courseRate * COMMISSION_RATE).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-text border-t border-border pt-1.5">
                    <span>You earn:</span>
                    <span className="text-trust">₹{(courseRate * (1 - COMMISSION_RATE)).toFixed(0)}/course</span>
                  </div>
                </div>
              </div>
              <Button onClick={handleSaveSettings} variant="primary" className="w-full" isLoading={saving}>
                Save Pricing & Availability
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Documents */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-brand" />
                </div>
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-surface-inset flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-7 h-7 text-text-subtle" />
                  </div>
                  <p className="text-sm text-text-muted font-medium">No documents uploaded yet.</p>
                  <p className="text-xs text-text-subtle mt-1">Upload your qualifications to get verified.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const typeInfo = DOC_TYPE_LABELS[doc.type] || DOC_TYPE_LABELS.OTHER;
                    const statusColor = DOC_STATUS_COLORS[doc.status] || "default";
                    return (
                      <div key={doc.id} className="flex items-center gap-4 p-4 rounded-xl bg-surface-inset border border-border hover:border-border-strong transition-colors">
                        <div className="w-11 h-11 rounded-xl bg-surface flex items-center justify-center text-xl">
                          {typeInfo.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-text">{typeInfo.label}</div>
                          <div className="text-xs text-text-muted mt-0.5">
                            Uploaded {new Date(doc.createdAt).toLocaleDateString("en-IN")}
                            {doc.notes && ` · ${doc.notes}`}
                          </div>
                        </div>
                        <Badge variant={statusColor as "default" | "info" | "success" | "outline" | "danger" | "warning"} className="text-xs">
                          {doc.status}
                        </Badge>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand font-medium hover:underline"
                        >
                          View
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Availability */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-brand" />
                </div>
                Weekly Availability
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {DAYS.map((dayName, dayIndex) => {
                  const daySlots = availability.filter((s) => s.dayOfWeek === dayIndex);
                  const isToday = new Date().getDay() === dayIndex;
                  return (
                    <div key={dayIndex} className={`border-b border-border pb-3 last:border-0 last:pb-0 ${isToday ? "bg-brand/[0.02] -mx-2 px-2 py-2 rounded-xl" : ""}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-sm font-medium w-28 flex items-center gap-2 ${isToday ? "text-brand" : "text-text"}`}>
                          {dayName}
                          {isToday && <Badge variant="info" className="text-[9px] py-0">Today</Badge>}
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addSlot(dayIndex)}
                          className="text-brand hover:text-brand hover:bg-brand/10 h-7 text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Slot
                        </Button>
                      </div>
                      {daySlots.length === 0 ? (
                        <p className="text-xs text-text-subtle italic ml-28">Unavailable</p>
                      ) : (
                        <div className="space-y-2 ml-28">
                          {daySlots.map((slot) => {
                            const globalIdx = availability.indexOf(slot);
                            return (
                              <div key={globalIdx} className="flex items-center gap-2">
                                <Input
                                  type="time"
                                  value={slot.startTime}
                                  onChange={(e) => updateSlot(globalIdx, "startTime", e.target.value)}
                                  className="w-28 h-8 text-xs"
                                />
                                <span className="text-xs text-text-muted">to</span>
                                <Input
                                  type="time"
                                  value={slot.endTime}
                                  onChange={(e) => updateSlot(globalIdx, "endTime", e.target.value)}
                                  className="w-28 h-8 text-xs"
                                />
                                <button
                                  onClick={() => removeSlot(globalIdx)}
                                  className="p-1.5 text-text-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
