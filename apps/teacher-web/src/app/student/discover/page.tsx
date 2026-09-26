"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Star,
  Clock,
  AlertCircle,
  Loader2,
  X,
  GraduationCap,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

type Teacher = {
  id: string;
  name: string;
  avatar: string | null;
  languages: string[];
  rating: number;
  reviews: number;
  hourlyRate: number;
  demoRate: number;
  headline: string;
  nextAvailable: string;
  experienceLevel: string;
  availability: boolean;
  gender: string | null;
  totalHours: number;
};

const LANGUAGES = ["English", "Spanish", "French", "Japanese", "German", "Chinese", "Korean", "Russian", "Arabic", "Hindi", "Portuguese", "Italian"];

const EXPERIENCE_LEVELS = [
  { value: "BEGINNER", label: "Beginner (0-1 yrs)" },
  { value: "INTERMEDIATE", label: "Intermediate (1-3 yrs)" },
  { value: "EXPERIENCED", label: "Experienced (3-5 yrs)" },
  { value: "EXPERT", label: "Expert (5+ yrs)" },
];

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

const BUDGET_RANGES = [
  { value: "0-200", label: "Under ₹200", min: 0, max: 200 },
  { value: "200-500", label: "₹200 - ₹500", min: 200, max: 500 },
  { value: "500-1000", label: "₹500 - ₹1000", min: 500, max: 1000 },
  { value: "1000+", label: "₹1000+", min: 1000, max: Infinity },
];

const PILL_COLORS = ["#231d5e","#0f6b58","#c7982f","#dc4c3e","#3d32a0","#0f9d6b"];
function getInitials(n: string) { return n.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase(); }

export default function DiscoverPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    fetchTeachers();
  }, [searchQuery, selectedLanguage, selectedBudget, selectedExperience, selectedGender, availableOnly]);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedLanguage) params.set("language", selectedLanguage);
      if (selectedBudget) {
        const range = BUDGET_RANGES.find((r) => r.value === selectedBudget);
        if (range) {
          params.set("minRate", String(range.min));
          if (range.max !== Infinity) params.set("maxRate", String(range.max));
        }
      }
      if (selectedExperience) params.set("experience", selectedExperience);
      if (selectedGender) params.set("gender", selectedGender);
      if (availableOnly) params.set("available", "true");

      const res = await fetch(`/api/students/discover?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load teachers");
      const data = await res.json();
      setTeachers(data.teachers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedLanguage(null);
    setSelectedBudget(null);
    setSelectedExperience(null);
    setSelectedGender(null);
    setAvailableOnly(false);
  };

  const activeFilterCount = [selectedLanguage, selectedBudget, selectedExperience, selectedGender, availableOnly ? "available" : null].filter(Boolean).length;

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 h-full flex flex-col">
      {/* ── HEADER ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] sm:text-[36px] font-display font-bold text-text tracking-[-0.02em] leading-tight">
            Find a Teacher
          </h1>
          <p className="text-base text-text-muted mt-1">
            Discover the perfect language tutor for your goals
          </p>
        </div>
      </div>

      {/* ── SEARCH BAR ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full shadow-sm rounded-xl overflow-hidden border border-border/60 bg-surface">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand opacity-60" />
          <Input
            type="text"
            placeholder="Search by name, language, or keyword..."
            className="pl-11 h-12 border-none bg-transparent focus-visible:ring-0 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          variant={showFilters ? "primary" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2 h-12 shadow-sm w-full sm:w-auto"
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── FILTER PANEL ───────────────────────────── */}
        {showFilters && (
          <aside className="w-full lg:w-[280px] shrink-0 space-y-4 animate-in slide-in-from-left-4 duration-300">
            <Card className="border border-border/50 shadow-sm sticky top-6">
              <CardContent className="p-5 space-y-6">
                
                {/* Language */}
                <div>
                  <h3 className="font-semibold text-text text-[13px] uppercase tracking-wider mb-3">Language</h3>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setSelectedLanguage(selectedLanguage === lang ? null : lang)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${
                          selectedLanguage === lang
                            ? "bg-brand/10 border-brand text-brand"
                            : "bg-surface border-border/50 text-text-muted hover:border-brand/30 hover:bg-surface-inset"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <h3 className="font-semibold text-text text-[13px] uppercase tracking-wider mb-3">Budget (hourly)</h3>
                  <div className="space-y-2">
                    {BUDGET_RANGES.map((range) => (
                      <label key={range.value} className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${selectedBudget === range.value ? "border-brand bg-brand" : "border-border/80 group-hover:border-brand/50"}`}>
                          {selectedBudget === range.value && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <input
                          type="radio"
                          className="hidden"
                          checked={selectedBudget === range.value}
                          onChange={() => setSelectedBudget(selectedBudget === range.value ? null : range.value)}
                        />
                        <span className="text-[13px] font-medium text-text-muted group-hover:text-text transition-colors">
                          {range.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <h3 className="font-semibold text-text text-[13px] uppercase tracking-wider mb-3">Experience</h3>
                  <div className="space-y-2">
                    {EXPERIENCE_LEVELS.map((level) => (
                      <label key={level.value} className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${selectedExperience === level.value ? "border-brand bg-brand" : "border-border/80 group-hover:border-brand/50"}`}>
                          {selectedExperience === level.value && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <input
                          type="radio"
                          className="hidden"
                          checked={selectedExperience === level.value}
                          onChange={() => setSelectedExperience(selectedExperience === level.value ? null : level.value)}
                        />
                        <span className="text-[13px] font-medium text-text-muted group-hover:text-text transition-colors">
                          {level.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <h3 className="font-semibold text-text text-[13px] uppercase tracking-wider mb-3">Gender</h3>
                  <div className="flex gap-2">
                    {GENDERS.map((g) => (
                      <button
                        key={g.value}
                        onClick={() => setSelectedGender(selectedGender === g.value ? null : g.value)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border flex-1 ${
                          selectedGender === g.value
                            ? "bg-brand/10 border-brand text-brand"
                            : "bg-surface border-border/50 text-text-muted hover:border-brand/30 hover:bg-surface-inset"
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Availability Toggle */}
                <div className="pt-4 border-t border-border/50">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-[13px] font-semibold text-text uppercase tracking-wider">Available Now</span>
                    <button
                      onClick={() => setAvailableOnly(!availableOnly)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${availableOnly ? "bg-trust" : "bg-border/80"}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${availableOnly ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </label>
                </div>

                {/* Clear Filters */}
                {activeFilterCount > 0 && (
                  <Button variant="outline" size="sm" className="w-full gap-2 mt-4" onClick={clearAllFilters}>
                    <X className="w-4 h-4" /> Clear All Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          </aside>
        )}

        {/* ── RESULTS GRID ───────────────────────────── */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] text-text-muted">
              {loading ? (
                "Searching..."
              ) : (
                <>Found <span className="font-bold text-text">{teachers.length}</span> teachers</>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-12">
              <DashboardSkeleton />
            </div>
          ) : error ? (
            <div className="text-center py-20 bg-surface rounded-2xl border" style={{ borderColor: "rgba(35,29,94,0.08)" }}>
              <AlertCircle className="w-12 h-12 text-alert mx-auto mb-4" />
              <p className="text-text font-semibold mb-1">Failed to load teachers</p>
              <p className="text-text-muted text-[13px]">{error}</p>
              <Button variant="outline" className="mt-6" onClick={fetchTeachers}>Try Again</Button>
            </div>
          ) : teachers.length === 0 ? (
            <Card className="border border-border/50 shadow-sm">
              <CardContent className="py-20 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-inset flex items-center justify-center mb-4 border border-border/40">
                  <Search className="w-8 h-8 text-brand opacity-60" />
                </div>
                <h3 className="text-[18px] font-bold text-text mb-2">No teachers found</h3>
                <p className="text-[14px] text-text-muted max-w-[280px] mb-6">
                  Try adjusting your search terms or clearing some filters to see more results.
                </p>
                {activeFilterCount > 0 && (
                  <Button variant="outline" className="shadow-sm" onClick={clearAllFilters}>
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {teachers.map((teacher, index) => {
                const initials = getInitials(teacher.name);
                
                return (
                  <Card key={teacher.id} className="overflow-hidden flex flex-col border border-border/50 hover:shadow-level-2 hover:border-brand/30 transition-all duration-300">
                    <CardContent className="p-5 flex-1 flex flex-col">
                      <div className="flex gap-4 mb-4">
                        {teacher.avatar ? (
                          <Avatar src={teacher.avatar} size="lg" online={teacher.availability} className="shadow-sm" />
                        ) : (
                          <div className="relative">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-[14px] font-bold shadow-sm" style={{ background: PILL_COLORS[index % PILL_COLORS.length] }}>
                              {initials}
                            </div>
                            {teacher.availability && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface flex items-center justify-center">
                                <div className="w-2.5 h-2.5 rounded-full bg-trust" />
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h3 className="text-[16px] font-bold text-text truncate font-display">
                              {teacher.name}
                            </h3>
                            <div className="flex items-center gap-1 bg-action/10 px-2 py-0.5 rounded-md">
                              <Star className="w-3.5 h-3.5 text-action fill-action" />
                              <span className="text-[12px] font-bold text-action-on">{teacher.rating > 0 ? teacher.rating.toFixed(1) : "New"}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center flex-wrap gap-2 text-[12px] font-semibold mb-2">
                            <span className="text-brand">{teacher.languages.filter(Boolean).join(" • ")}</span>
                            {teacher.experienceLevel && (
                              <>
                                <span className="text-text-subtle">•</span>
                                <span className="text-text-muted capitalize">{teacher.experienceLevel.toLowerCase()}</span>
                              </>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 text-[12px] text-text-subtle">
                            {teacher.reviews > 0 && <span>{teacher.reviews} reviews</span>}
                            {teacher.totalHours > 0 && <span>{teacher.totalHours}h taught</span>}
                          </div>
                        </div>
                      </div>

                      <div className="bg-surface-inset/50 rounded-xl p-3 mb-4 border border-border/40">
                        <p className="text-[13px] text-text leading-relaxed line-clamp-2 italic opacity-90">
                          "{teacher.headline}"
                        </p>
                      </div>

                      <div className="mt-auto">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-trust uppercase tracking-wider mb-3">
                          <Clock className="w-3.5 h-3.5" /> Next avail: {teacher.nextAvailable}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div className="bg-surface border border-border/60 rounded-xl p-3 text-center">
                            <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider mb-1">Hourly</div>
                            <div className="text-[16px] font-bold text-text font-display">₹{teacher.hourlyRate}</div>
                          </div>
                          <div className="bg-action/5 border border-action/20 rounded-xl p-3 text-center">
                            <div className="text-[11px] font-semibold text-action uppercase tracking-wider mb-1">Demo</div>
                            <div className="text-[16px] font-bold text-text font-display flex items-center justify-center gap-1">
                              <span className="text-action">🪙</span> {teacher.demoRate}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="p-4 pt-0 mt-auto border-t border-border/40 bg-surface flex gap-2">
                      <Button asChild variant="outline" className="flex-1 shadow-sm h-10 text-[13px]">
                        <Link href={`/student/discover/${teacher.id}`}>View Profile</Link>
                      </Button>
                      <Button asChild variant="primary" className="flex-1 shadow-sm h-10 text-[13px]">
                        <Link href={`/student/discover/${teacher.id}/book`}>Book Demo</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
