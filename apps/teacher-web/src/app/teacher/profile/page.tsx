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
  FileText,
  Video,
  Shield,
  Camera,
  Edit3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const COMMISSION_RATE = 0.3;

const DOC_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  EDUCATION: { label: "Qualification Certificate", icon: "🎓" },
  ID_PROOF: { label: "ID Proof", icon: "🪪" },
  LANGUAGE_CERTIFICATE: { label: "Language Certificate", icon: "📜" },
  EXPERIENCE_LETTER: { label: "Experience Document", icon: "💼" },
  OTHER: { label: "Other Document", icon: "📄" },
};

const DOC_STATUS_COLORS: Record<string, "warning" | "success" | "danger"> = {
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
      
      // also save settings so there's one save action for user simplicity here
      await fetch("/api/teachers/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          hourlyRate: Math.round(hourlyRate * 100),
          courseRate: Math.round(courseRate * 100),
          availability,
        }),
      });

      setSuccessMsg("Profile & Settings saved successfully!");
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
      <div className="py-8 max-w-5xl mx-auto w-full">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 h-full flex flex-col max-w-5xl mx-auto w-full">
      {/* ── HEADER ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] sm:text-[36px] font-display font-bold text-text tracking-[-0.02em] leading-tight">
            Profile & Settings
          </h1>
          <p className="text-base text-text-muted mt-1">
            Manage your public profile, rates, and availability
          </p>
        </div>
        <Button onClick={handleSaveProfile} disabled={saving} variant="primary" className="flex items-center gap-2 shadow-sm">
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
            <div className="relative group shrink-0">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center overflow-hidden shadow-sm border border-white/10">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={profileName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-display font-bold text-white">{profileName[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            
            <div className="flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Name</label>
                  <div className="text-[18px] font-display text-white font-bold mt-0.5">{profileName}</div>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Email</label>
                  <div className="text-[14px] text-white/90 font-medium mt-1">{profileEmail}</div>
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Status</label>
                  <div className="mt-1">
                    <Badge variant={profileStatus === "APPROVED" ? "success" : profileStatus === "REJECTED" ? "danger" : "warning"} className="text-[10px] uppercase font-bold tracking-wider">
                      {profileStatus.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Experience</label>
                  <div className="text-[14px] text-white/90 font-medium mt-1">{profileExperience}</div>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Languages</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profileLanguages.length > 0 ? (
                      profileLanguages.map((l) => (
                        <Badge key={l} variant="default" className="text-[10px] uppercase font-bold tracking-wider bg-white/10 text-white/90 border-white/10 py-0.5">{l}</Badge>
                      ))
                    ) : (
                      <span className="text-[13px] text-white/50 font-medium italic">Not set</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT COLUMN ────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          {/* Bio */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-[16px] font-bold text-text flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                  <Edit3 className="w-4 h-4 text-brand" />
                </div>
                Bio & Avatar
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Avatar URL</label>
                <Input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">About Me</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell students about your teaching style, experience, and what makes you unique..."
                  rows={5}
                  className="w-full rounded-xl border border-border/60 bg-surface px-4 py-3 text-[14px] text-text placeholder:text-text-subtle focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand shadow-sm transition-all resize-none"
                />
                <p className="text-[11px] font-medium text-text-subtle mt-1.5 text-right">{bio.length}/500</p>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-[16px] font-bold text-text flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-gold-950" />
                </div>
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Hourly Rate (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                />
                <div className="mt-2.5 p-3.5 bg-surface-inset rounded-xl border border-border/50 text-[12px] space-y-2">
                  <div className="flex justify-between font-medium">
                    <span className="text-text-muted">Platform fee ({COMMISSION_RATE * 100}%):</span>
                    <span className="text-alert">-₹{(hourlyRate * COMMISSION_RATE).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-text border-t border-border/60 pt-2">
                    <span>You earn:</span>
                    <span className="text-trust">₹{(hourlyRate * (1 - COMMISSION_RATE)).toFixed(0)}/hr</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Course Rate (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={courseRate}
                  onChange={(e) => setCourseRate(Number(e.target.value))}
                />
                <div className="mt-2.5 p-3.5 bg-surface-inset rounded-xl border border-border/50 text-[12px] space-y-2">
                  <div className="flex justify-between font-medium">
                    <span className="text-text-muted">Platform fee ({COMMISSION_RATE * 100}%):</span>
                    <span className="text-alert">-₹{(courseRate * COMMISSION_RATE).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-text border-t border-border/60 pt-2">
                    <span>You earn:</span>
                    <span className="text-trust">₹{(courseRate * (1 - COMMISSION_RATE)).toFixed(0)}/course</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demo Video */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-[16px] font-bold text-text flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-action/10 flex items-center justify-center">
                  <Video className="w-4 h-4 text-action" />
                </div>
                Intro Video
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Video URL</label>
                <Input
                  type="url"
                  placeholder="YouTube or Vimeo URL"
                  value={demoVideoUrl}
                  onChange={(e) => setDemoVideoUrl(e.target.value)}
                />
              </div>
              <p className="text-[12px] text-text-muted leading-relaxed">
                A short intro video helps students get to know you and increases booking chances.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT COLUMN ───────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Availability */}
          <Card className="border border-border/50 shadow-sm h-fit">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-[16px] font-bold text-text flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-brand" />
                </div>
                Weekly Availability
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                {DAYS.map((dayName, dayIndex) => {
                  const daySlots = availability.filter((s) => s.dayOfWeek === dayIndex);
                  const isToday = new Date().getDay() === dayIndex;
                  return (
                    <div key={dayIndex} className={`p-4 sm:p-5 transition-colors ${isToday ? "bg-brand/[0.02]" : "hover:bg-surface-inset/50"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className={`text-[14px] font-bold flex items-center gap-2 ${isToday ? "text-brand" : "text-text"}`}>
                          {dayName}
                          {isToday && <Badge variant="info" className="text-[9px] uppercase tracking-wider font-bold py-0.5 px-2">Today</Badge>}
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addSlot(dayIndex)}
                          className="text-brand hover:text-brand hover:bg-brand/10 h-8 text-[12px] font-bold shadow-none"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Slot
                        </Button>
                      </div>
                      
                      {daySlots.length === 0 ? (
                        <p className="text-[13px] text-text-subtle font-medium italic">Unavailable on {dayName}s</p>
                      ) : (
                        <div className="space-y-2.5">
                          {daySlots.map((slot) => {
                            const globalIdx = availability.indexOf(slot);
                            return (
                              <div key={globalIdx} className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="time"
                                    value={slot.startTime}
                                    onChange={(e) => updateSlot(globalIdx, "startTime", e.target.value)}
                                    className="w-28 h-9 text-[13px] font-medium"
                                  />
                                  <span className="text-[12px] font-bold text-text-muted">TO</span>
                                  <Input
                                    type="time"
                                    value={slot.endTime}
                                    onChange={(e) => updateSlot(globalIdx, "endTime", e.target.value)}
                                    className="w-28 h-9 text-[13px] font-medium"
                                  />
                                </div>
                                <button
                                  onClick={() => removeSlot(globalIdx)}
                                  className="w-9 h-9 flex items-center justify-center text-text-subtle hover:text-alert hover:bg-alert/10 rounded-lg transition-colors border border-transparent hover:border-alert/20"
                                >
                                  <Trash2 className="w-4 h-4" />
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

          {/* Documents */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-[16px] font-bold text-text flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-trust/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-trust" />
                </div>
                Documents & Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {documents.length === 0 ? (
                <div className="text-center py-12 bg-surface-inset/50 rounded-xl border border-border/40">
                  <div className="w-16 h-16 rounded-2xl bg-surface-inset flex items-center justify-center mx-auto mb-4 shadow-sm border border-border/60">
                    <Shield className="w-7 h-7 text-text-subtle" />
                  </div>
                  <p className="text-[15px] text-text font-bold mb-1">No documents uploaded yet</p>
                  <p className="text-[13px] text-text-muted">Upload your qualifications and ID to get verified.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const typeInfo = DOC_TYPE_LABELS[doc.type] || DOC_TYPE_LABELS.OTHER;
                    const statusColor = DOC_STATUS_COLORS[doc.status] || "warning";
                    return (
                      <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-surface-inset border border-border/60 hover:border-brand/30 transition-colors group">
                        <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center text-[24px] shadow-sm shrink-0 border border-border/50 group-hover:scale-105 transition-transform">
                          {typeInfo.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-bold text-text mb-0.5">{typeInfo.label}</div>
                          <div className="text-[12px] text-text-muted font-medium">
                            Uploaded {new Date(doc.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                            {doc.notes && <span className="block text-alert mt-0.5">Note: {doc.notes}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant={statusColor} className="text-[10px] uppercase font-bold tracking-wider py-0.5 px-2">
                            {doc.status}
                          </Badge>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] text-brand font-bold hover:underline bg-brand/10 px-3 py-1.5 rounded-lg transition-colors hover:bg-brand/20"
                          >
                            View
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
