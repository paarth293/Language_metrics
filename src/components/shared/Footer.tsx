import Link from "next/link";
import { Globe, Share2, Camera, Briefcase, PlayCircle } from "lucide-react";

const footerLinks = {
  Platform: [
    { label: "For Students", href: "#students" },
    { label: "For Teachers", href: "#teachers" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Cookie Policy", href: "#" },
    { label: "Refund Policy", href: "#" },
  ],
  Support: [
    { label: "Help Center", href: "#" },
    { label: "Contact Us", href: "#" },
    { label: "Teacher Verification", href: "#" },
    { label: "Dispute Resolution", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-navy text-cream">
      {/* Main footer */}
      <div className="max-w-[1240px] mx-auto px-6 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand col */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-navy-2 border border-cream/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-gold" />
              </div>
              <span className="font-display font-semibold text-cream text-[17px]">
                Language Metrics
              </span>
            </Link>
            <p className="text-cream/60 text-[14px] leading-relaxed max-w-xs">
              Connecting students with verified language professionals for
              transformative 1-on-1 learning experiences.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3 mt-6">
              {[Share2, Camera, Briefcase, PlayCircle].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-lg bg-cream/5 hover:bg-cream/10 border border-cream/10 flex items-center justify-center transition-colors duration-200"
                >
                  <Icon className="w-4 h-4 text-cream/60 hover:text-cream" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-[12px] font-semibold uppercase tracking-widest text-gold mb-4">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[14px] text-cream/60 hover:text-cream transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-cream/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[13px] text-cream/40">
            © {new Date().getFullYear()} Language Metrics. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-cream/40">Built with</span>
            <span className="text-gold">♥</span>
            <span className="text-[13px] text-cream/40">for language learners worldwide</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
