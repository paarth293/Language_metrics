"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, Filter, Star, Clock } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

// Seed data
const teachers = [
  {
    id: "1",
    name: "Elena Rodriguez",
    languages: ["Spanish", "English"],
    flag: "🇪🇸",
    rating: 4.9,
    reviews: 142,
    coinsPerHour: 150,
    avatar: "https://i.pravatar.cc/150?u=elena",
    headline: "Conversational Spanish & DELE Prep",
    tags: ["Patient", "Great materials"],
    nextAvailable: "Today, 14:00",
  },
  {
    id: "2",
    name: "Kenji Sato",
    languages: ["Japanese", "English"],
    flag: "🇯🇵",
    rating: 5.0,
    reviews: 89,
    coinsPerHour: 180,
    avatar: "https://i.pravatar.cc/150?u=kenji",
    headline: "Business Japanese & JLPT N1-N5",
    tags: ["Structured", "Business focus"],
    featured: true,
    nextAvailable: "Tomorrow, 09:00",
  },
  {
    id: "3",
    name: "Sophie Laurent",
    languages: ["French", "Spanish"],
    flag: "🇫🇷",
    rating: 4.8,
    reviews: 215,
    coinsPerHour: 120,
    avatar: "https://i.pravatar.cc/150?u=sophie",
    headline: "Learn French through culture and art",
    tags: ["Fun", "Cultural insights"],
    nextAvailable: "Today, 16:30",
  },
];

export default function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex flex-col h-full">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text mb-2">Find a Teacher</h1>
        <p className="text-text-muted">Discover the perfect language tutor for your goals.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filter Rail */}
        <aside className="w-full lg:w-64 shrink-0 space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-text">Search</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input 
                type="text" 
                placeholder="Name or keyword" 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-text">Language</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success" className="cursor-pointer">Spanish 🇪🇸</Badge>
              <Badge variant="default" className="cursor-pointer hover:bg-border">French 🇫🇷</Badge>
              <Badge variant="default" className="cursor-pointer hover:bg-border">Japanese 🇯🇵</Badge>
              <Badge variant="default" className="cursor-pointer hover:bg-border">German 🇩🇪</Badge>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-text flex items-center justify-between">
              <span>Price Range</span>
              <span className="text-sm font-normal text-gold">🪙 50 - 500+</span>
            </h3>
            <input type="range" min="50" max="500" className="w-full accent-gold" />
          </div>

          <Button variant="outline" className="w-full gap-2">
            <Filter className="w-4 h-4" /> More Filters
          </Button>
        </aside>

        {/* Results Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-text-muted">Showing {teachers.length} teachers</div>
            <select className="bg-transparent border-none text-sm font-medium text-text focus:ring-0 cursor-pointer">
              <option>Relevance</option>
              <option>Highest Rated</option>
              <option>Lowest Price</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {teachers.map((teacher) => (
              <Card 
                key={teacher.id} 
                className={`overflow-hidden flex flex-col group ${teacher.featured ? 'ring-1 ring-gold shadow-md' : ''}`}
              >
                <CardContent className="p-5 flex-1">
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar src={teacher.avatar} size="lg" online={true} />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-text flex items-center gap-2">
                        {teacher.name} <span title="Country">{teacher.flag}</span>
                      </h3>
                      <p className="text-sm font-medium text-text-muted mb-1">
                        {teacher.languages.join(" • ")}
                      </p>
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <Star className="w-4 h-4 text-gold fill-gold" />
                        {teacher.rating} <span className="text-text-subtle font-normal">({teacher.reviews})</span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-text text-sm mb-4 line-clamp-2">
                    &quot;{teacher.headline}&quot;
                  </p>

                  <div className="flex items-center gap-2 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-md w-fit">
                    <Clock className="w-3.5 h-3.5" /> Next available: {teacher.nextAvailable}
                  </div>
                </CardContent>

                <CardFooter className="p-5 pt-0 mt-auto border-t border-border flex flex-col gap-3 bg-surface-inset/50">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">Demo Class</span>
                    <span className="font-semibold text-text flex items-center gap-1">
                      <span className="text-gold">🪙</span> 49
                    </span>
                  </div>
                  <div className="flex gap-2 w-full">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/student/teacher/${teacher.id}`}>Profile</Link>
                    </Button>
                    <Button asChild variant="primary" size="sm" className="flex-1">
                      <Link href={`/student/teacher/${teacher.id}/book`}>Book Demo</Link>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
