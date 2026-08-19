"use client";

import React from "react";
import Link from "next/link";
import { Star, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const teachers = [
  {
    id: "1",
    name: "Elena Rodriguez",
    languages: ["Spanish (Native)", "English (C1)"],
    flag: "🇪🇸",
    rating: 4.9,
    reviews: 142,
    coinsPerHour: 150,
    avatar: "https://i.pravatar.cc/150?u=elena",
    headline: "Conversational Spanish & DELE Prep",
    tags: ["Patient", "Great materials"],
  },
  {
    id: "2",
    name: "Kenji Sato",
    languages: ["Japanese (Native)", "English (B2)"],
    flag: "🇯🇵",
    rating: 5.0,
    reviews: 89,
    coinsPerHour: 180,
    avatar: "https://i.pravatar.cc/150?u=kenji",
    headline: "Business Japanese & JLPT N1-N5",
    tags: ["Structured", "Business focus"],
    featured: true,
  },
  {
    id: "3",
    name: "Sophie Laurent",
    languages: ["French (Native)", "Spanish (B1)"],
    flag: "🇫🇷",
    rating: 4.8,
    reviews: 215,
    coinsPerHour: 120,
    avatar: "https://i.pravatar.cc/150?u=sophie",
    headline: "Learn French through culture and art",
    tags: ["Fun", "Cultural insights"],
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55 },
  },
};

export default function TeacherSpotlight() {
  return (
    <section className="py-28 bg-surface-2 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs font-semibold uppercase tracking-widest mb-4">
              Top Rated
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-text mb-4 leading-tight">
              Learn from the best
            </h2>
            <p className="text-lg text-text-muted max-w-2xl">
              Our teachers are passionate, verified professionals ready to help you reach fluency.
            </p>
          </div>
          <Button asChild variant="outline" className="group">
            <Link href="/discover" className="flex items-center gap-2">
              View all teachers
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerVariants}
        >
          {teachers.map((teacher) => (
            <motion.div
              key={teacher.id}
              variants={cardVariants}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
            >
              <Card
                className={`overflow-hidden flex flex-col group h-full transition-all duration-300 hover:shadow-lg ${teacher.featured ? 'ring-1 ring-gold shadow-md relative' : ''}`}
              >
                {teacher.featured && (
                  <div className="absolute top-0 right-0 bg-gold text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wider rounded-bl-lg z-10">
                    Featured
                  </div>
                )}

                <CardContent className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <Avatar src={teacher.avatar} size="lg" online={true} />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-surface rounded-full flex items-center justify-center text-xs border border-border">
                        {teacher.flag}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-surface-inset px-2.5 py-1.5 rounded-lg text-sm font-medium">
                      <Star className="w-4 h-4 text-gold fill-gold" />
                      {teacher.rating}
                      <span className="text-text-subtle font-normal">({teacher.reviews})</span>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-text mb-1 group-hover:text-gold transition-colors duration-300">
                    {teacher.name}
                  </h3>

                  <p className="text-sm font-medium text-text-muted mb-3">
                    {teacher.languages.join(" • ")}
                  </p>

                  <p className="text-text text-sm mb-4 line-clamp-2 italic opacity-80">
                    &quot;{teacher.headline}&quot;
                  </p>

                  <div className="flex flex-wrap gap-2 mb-2">
                    {teacher.tags.map(tag => (
                      <Badge key={tag} variant="default">{tag}</Badge>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="p-6 pt-4 mt-auto border-t border-border flex items-center justify-between bg-surface-inset/30">
                  <div className="flex flex-col">
                    <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">Price / hr</span>
                    <span className="font-bold text-text flex items-center gap-1 text-lg">
                      <span className="text-gold">🪙</span> {teacher.coinsPerHour}
                    </span>
                  </div>
                  <Button asChild variant="primary" size="sm" className="group/btn">
                    <Link href={`/teacher/${teacher.id}`} className="flex items-center gap-1.5">
                      Book Demo
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
