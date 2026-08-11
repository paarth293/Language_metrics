"use client";

const languages = [
  { name: "English", flag: "🇬🇧", learners: "12,400+" },
  { name: "Hindi", flag: "🇮🇳", learners: "8,200+" },
  { name: "Spanish", flag: "🇪🇸", learners: "6,800+" },
  { name: "French", flag: "🇫🇷", learners: "5,100+" },
  { name: "German", flag: "🇩🇪", learners: "3,900+" },
  { name: "Japanese", flag: "🇯🇵", learners: "3,400+" },
  { name: "Mandarin", flag: "🇨🇳", learners: "2,800+" },
  { name: "Arabic", flag: "🇸🇦", learners: "2,100+" },
  { name: "Korean", flag: "🇰🇷", learners: "1,900+" },
  { name: "Italian", flag: "🇮🇹", learners: "1,700+" },
  { name: "Portuguese", flag: "🇧🇷", learners: "1,500+" },
  { name: "Russian", flag: "🇷🇺", learners: "1,200+" },
  { name: "Turkish", flag: "🇹🇷", learners: "980+" },
  { name: "Dutch", flag: "🇳🇱", learners: "760+" },
];

function LanguageChip({ name, flag, learners }: { name: string; flag: string; learners: string }) {
  return (
    <div className="flex items-center gap-3 bg-cream border border-navy/10 rounded-2xl px-5 py-3 mx-3 shrink-0 hover:border-gold/40 hover:shadow-navy-sm transition-all duration-300 group cursor-default">
      <span className="text-2xl">{flag}</span>
      <div>
        <div className="text-[14px] font-semibold text-navy group-hover:text-navy">
          {name}
        </div>
        <div className="text-[11px] text-navy/40 font-medium">
          {learners} learners
        </div>
      </div>
    </div>
  );
}

export default function LanguageMarquee() {
  const doubled = [...languages, ...languages];

  return (
    <section id="students" className="py-20 bg-cream overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-6 mb-10 text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <span className="eyebrow-line" />
          <span className="font-script text-gold text-xl">42 languages available</span>
          <span className="eyebrow-line" />
        </div>
        <h2
          className="font-display font-bold text-navy"
          style={{ fontSize: "clamp(28px, 4vw, 48px)" }}
        >
          Learn Any Language You Love
        </h2>
      </div>

      {/* Marquee row 1 */}
      <div className="relative mb-4">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-cream to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-cream to-transparent z-10 pointer-events-none" />
        <div className="overflow-hidden py-2">
          <div className="marquee-track">
            {doubled.map((lang, i) => (
              <LanguageChip key={i} {...lang} />
            ))}
          </div>
        </div>
      </div>

      {/* Marquee row 2 (reversed) */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-cream to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-cream to-transparent z-10 pointer-events-none" />
        <div className="overflow-hidden py-2">
          <div
            className="flex w-max"
            style={{ animation: "marqueeMove 50s linear infinite reverse" }}
          >
            {doubled.map((lang, i) => (
              <LanguageChip key={i} {...lang} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
