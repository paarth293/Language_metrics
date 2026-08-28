"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  ChevronDown,
  Search,
  BookOpen,
  CreditCard,
  Video,
  User,
  MessageCircle,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

const faqCategories = [
  {
    id: "general",
    label: "General",
    icon: BookOpen,
    questions: [
      {
        q: "What is Language Metrics?",
        a: "Language Metrics is a language-learning platform that connects students with native-speaking teachers for personalized 1-on-1 lessons via live video calls.",
      },
      {
        q: "How do I get started?",
        a: "Sign up, select your target language and proficiency level, then browse our teacher catalog to book your first class. You can start with a free demo session.",
      },
      {
        q: "What languages are available?",
        a: "We offer 50+ languages including English, Spanish, French, German, Mandarin, Japanese, Korean, Russian, Arabic, Hindi, and many more.",
      },
    ],
  },
  {
    id: "classes",
    label: "Classes & Booking",
    icon: Video,
    questions: [
      {
        q: "How do I book a class?",
        a: "Go to Discover, find a teacher you like, view their profile and availability, select a time slot, and complete the booking. Payment is processed via Razorpay.",
      },
      {
        q: "Can I cancel a booking?",
        a: "You can cancel a booking free of charge up to 12 hours before the scheduled start time. Cancellations within 12 hours are non-refundable.",
      },
      {
        q: "How do I join a live class?",
        a: "Go to My Classes → Upcoming, and click 'Join Class' up to 5 minutes before the session starts. The button activates 5 minutes before and stays active until the session ends.",
      },
      {
        q: "What happens if I miss a class?",
        a: "If you don't join the session, it will be marked as completed with no-show status. No automatic refund is provided for missed classes.",
      },
    ],
  },
  {
    id: "payments",
    label: "Payments & Coins",
    icon: CreditCard,
    questions: [
      {
        q: "How does the coin system work?",
        a: "1 Coin = ₹1. You can purchase coins and use them to book classes, unlock recordings, and apply coupons. Your coin balance is displayed on the dashboard.",
      },
      {
        q: "What payment methods are accepted?",
        a: "We accept UPI, credit/debit cards, net banking, and wallets through Razorpay. All transactions are secure and encrypted.",
      },
      {
        q: "How do coupons work?",
        a: "Each coupon can be used once per student. Apply a coupon code during the booking flow to get a discount on your class.",
      },
      {
        q: "How do I get an invoice?",
        a: "Invoices are automatically generated after a successful payment. You can find them in your Wallet or Profile section.",
      },
    ],
  },
  {
    id: "recordings",
    label: "Recordings",
    icon: Video,
    questions: [
      {
        q: "Are classes recorded?",
        a: "Yes, classes may be recorded by the teacher. Recordings appear in your Recordings section after the class ends.",
      },
      {
        q: "Why are some recordings locked?",
        a: "Some recordings require an additional fee to unlock. You can pay the unlock fee to access these recordings anytime.",
      },
    ],
  },
  {
    id: "account",
    label: "Account & Privacy",
    icon: User,
    questions: [
      {
        q: "How do I change my password?",
        a: "Go to Profile → Settings → Change Password. Enter your current password and the new one to update.",
      },
      {
        q: "How do I enable push notifications?",
        a: "Go to Profile → Settings and toggle on push notifications. Your browser will ask for permission to send notifications.",
      },
      {
        q: "How do I delete my account?",
        a: "Go to Profile → Settings → Account → Request Account Deletion. Your data will be flagged for admin review and soft-deleted.",
      },
    ],
  },
  {
    id: "chat",
    label: "Chat & Communication",
    icon: MessageCircle,
    questions: [
      {
        q: "Can I chat with teachers before booking?",
        a: "Chat becomes available after you book a class with a teacher. All communication stays within the platform.",
      },
      {
        q: "Do chat messages expire?",
        a: "Some messages may have an auto-delete timer. You'll see an expiration label on such messages.",
      },
    ],
  },
];

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const allQuestions = faqCategories.flatMap((cat) =>
    cat.questions.map((q) => ({ ...q, category: cat.id, categoryLabel: cat.label }))
  );

  const filteredQuestions = searchQuery
    ? allQuestions.filter(
        (q) =>
          q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.a.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeCategory
    ? faqCategories
        .find((c) => c.id === activeCategory)
        ?.questions.map((q) => ({
          ...q,
          category: activeCategory,
          categoryLabel: faqCategories.find((c) => c.id === activeCategory)
            ?.label || "",
        })) || []
    : allQuestions;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <HelpCircle className="w-12 h-12 text-amber-700 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-navy-900">Help & FAQ</h1>
        <p className="text-gray-600 mt-2">
          Find answers to common questions about Language Metrics
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search questions..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value) setActiveCategory(null);
          }}
          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
        />
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !activeCategory
                ? "bg-amber-700 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          {faqCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeCategory === cat.id
                    ? "bg-amber-700 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-3">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-12">
            <HelpCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              No questions found. Try a different search term.
            </p>
          </div>
        ) : (
          filteredQuestions.map((q, index) => {
            const key = `${q.category}-${index}`;
            const isExpanded = expandedQ === key;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedQ(isExpanded ? null : key)}
                  className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-navy-900 text-sm pr-4">
                    {q.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">
                        {q.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Contact Support */}
      <div className="bg-amber-50 rounded-xl p-6 text-center">
        <h3 className="font-semibold text-navy-900">Still have questions?</h3>
        <p className="text-sm text-gray-600 mt-1 mb-4">
          Our support team is here to help
        </p>
        <Button
          onClick={() => window.location.assign("/support")}
          className="bg-amber-700 hover:bg-amber-800 text-white"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Contact Support
        </Button>
      </div>
    </div>
  );
}
