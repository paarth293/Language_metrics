import React from "react";
import Image from "next/image";

export default function Mission() {
  return (
    <section className="py-24 relative overflow-hidden bg-bg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col lg:flex-row items-stretch">
          
          {/* Content side */}
          <div className="w-full lg:w-1/2 p-12 lg:p-16 flex flex-col justify-center order-2 lg:order-1">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text mb-6">
              Connecting the World Through Words
            </h2>
            <p className="text-lg text-text-muted mb-8 text-balance">
              Language Metrics is more than just a classroom. We are a global community bridging cultures, building confidence, and breaking down borders through the power of 1-on-1 human connection.
            </p>
            <div className="flex flex-wrap gap-8 md:gap-12 mt-4">
              <div>
                <p className="font-display font-bold text-3xl text-gold mb-1">50+</p>
                <p className="text-sm text-text-subtle uppercase tracking-wider font-semibold">Languages</p>
              </div>
              <div>
                <p className="font-display font-bold text-3xl text-gold mb-1">10k+</p>
                <p className="text-sm text-text-subtle uppercase tracking-wider font-semibold">Students</p>
              </div>
            </div>
          </div>

          {/* Image side - Full premium showcase of the banner */}
          <div className="w-full lg:w-1/2 relative min-h-[300px] lg:min-h-[auto] bg-[#f8f4ea] order-1 lg:order-2">
            <Image 
              src="/brand/mission-banner.png" 
              alt="Connecting the World" 
              fill 
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          </div>

        </div>
      </div>
    </section>
  );
}
