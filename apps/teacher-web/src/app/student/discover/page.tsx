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
  ChevronDown,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

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

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "Japanese",
  "German",
  "Chinese",
  "Korean",
  "Russian",
  "Arabic",
  "Hindi",
  "Portuguese",
  "Italian",
];

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

export default function DiscoverPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<string | null>(
    null
  );
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    fetchTeachers();
  }, [
    searchQuery,
    selectedLanguage,
    selectedBudget,
    selectedExperience,
    selectedGender,
    availableOnly,
  ]);

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

      const res = await fetch(`/api/students/discover?${params.toString()}`, {
        credentials: "include",
      });
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

  const activeFilterCount = [
    selectedLanguage,
    selectedBudget,
    selectedExperience,
    selectedGender,
    availableOnly ? "available" : null,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-text mb-2">
          Find a Teacher
        </h1>
        <p className="text-text-muted">
          Discover the perfect language tutor for your goals.
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            type="text"
            placeholder="Search by name, language, or keyword..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="success" className="ml-1 text-[10px]">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filter Panel */}
        {showFilters && (
          <aside className="w-full lg:w-72 shrink-0 space-y-5">
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
              {/* Language Filter */}
              <div>
                <h3 className="font-semibold text-text text-sm mb-3">
                  Language
                </h3>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <Badge
                      key={lang}
                      variant={
                        selectedLanguage === lang ? "success" : "default"
                      }
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedLanguage(
                          selectedLanguage === lang ? null : lang
                        )
                      }
                    >
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Budget Filter */}
              <div>
                <h3 className="font-semibold text-text text-sm mb-3">
                  Budget (per hour)
                </h3>
                <div className="space-y-2">
                  {BUDGET_RANGES.map((range) => (
                    <label
                      key={range.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="budget"
                        checked={selectedBudget === range.value}
                        onChange={() =>
                          setSelectedBudget(
                            selectedBudget === range.value ? null : range.value
                          )
                        }
                        className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700">
                        {range.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Experience Level */}
              <div>
                <h3 className="font-semibold text-text text-sm mb-3">
                  Experience Level
                </h3>
                <div className="space-y-2">
                  {EXPERIENCE_LEVELS.map((level) => (
                    <label
                      key={level.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="experience"
                        checked={selectedExperience === level.value}
                        onChange={() =>
                          setSelectedExperience(
                            selectedExperience === level.value
                              ? null
                              : level.value
                          )
                        }
                        className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700">
                        {level.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Gender Filter */}
              <div>
                <h3 className="font-semibold text-text text-sm mb-3">Gender</h3>
                <div className="flex gap-2">
                  {GENDERS.map((g) => (
                    <Badge
                      key={g.value}
                      variant={
                        selectedGender === g.value ? "success" : "default"
                      }
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedGender(
                          selectedGender === g.value ? null : g.value
                        )
                      }
                    >
                      {g.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Availability Toggle */}
              <div>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">
                    Available Now
                  </span>
                  <button
                    onClick={() => setAvailableOnly(!availableOnly)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      availableOnly ? "bg-amber-600" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        availableOnly ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </label>
              </div>

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={clearAllFilters}
                >
                  <X className="w-4 h-4" /> Clear All Filters
                </Button>
              )}
            </div>
          </aside>
        )}

        {/* Results Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-text-muted">
              {loading ? (
                "Loading..."
              ) : (
                <>
                  Showing{" "}
                  <span className="font-semibold text-text">
                    {teachers.length}
                  </span>{" "}
                  teachers
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-brand animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
              <p className="text-text-muted">{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={fetchTeachers}
              >
                Try Again
              </Button>
            </div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-20">
              <Search className="w-12 h-12 text-text-subtle mx-auto mb-4" />
              <p className="text-text-muted font-medium">No teachers found</p>
              <p className="text-sm text-text-subtle mt-1">
                Try adjusting your search or filters
              </p>
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={clearAllFilters}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {teachers.map((teacher) => (
                <Card
                  key={teacher.id}
                  className="overflow-hidden flex flex-col group hover:border-brand/20 transition-all duration-300"
                >
                  <CardContent className="p-5 flex-1">
                    <div className="flex items-start gap-4 mb-4">
                      <Avatar
                        src={teacher.avatar || undefined}
                        size="lg"
                        online={teacher.availability}
                      />
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-text flex items-center gap-2">
                          {teacher.name}
                          {teacher.experienceLevel && (
                            <Badge variant="outline" className="text-[10px]">
                              {teacher.experienceLevel}
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm font-medium text-text-muted mb-1">
                          {teacher.languages.filter(Boolean).join(" • ")}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                            {teacher.rating > 0 ? teacher.rating : "New"}
                            {teacher.reviews > 0 && (
                              <span className="text-text-subtle font-normal">
                                ({teacher.reviews})
                              </span>
                            )}
                          </div>
                          {teacher.totalHours > 0 && (
                            <span className="text-xs text-text-subtle">
                              • {teacher.totalHours}h taught
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-text text-sm mb-4 line-clamp-2">
                      &quot;{teacher.headline}&quot;
                    </p>

                    <div className="flex items-center gap-2 text-xs font-medium text-trust bg-trust/10 px-2 py-1 rounded-md w-fit">
                      <Clock className="w-3.5 h-3.5" /> Next available:{" "}
                      {teacher.nextAvailable}
                    </div>
                  </CardContent>

                  <CardFooter className="p-5 pt-0 mt-auto border-t border-border flex flex-col gap-3 bg-surface-inset/50">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                        Hourly Rate
                      </span>
                      <span className="font-bold text-text text-lg">
                        ₹{teacher.hourlyRate}
                      </span>
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                        Demo Class
                      </span>
                      <span className="font-semibold text-text flex items-center gap-1">
                        <span className="text-amber-500">🪙</span>{" "}
                        {teacher.demoRate}
                      </span>
                    </div>
                    <div className="flex gap-2 w-full">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Link href={`/teacher/${teacher.id}`}>Profile</Link>
                      </Button>
                      <Button
                        asChild
                        variant="primary"
                        size="sm"
                        className="flex-1"
                      >
                        <Link href={`/teacher/${teacher.id}/book`}>
                          Book Demo
                        </Link>
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
