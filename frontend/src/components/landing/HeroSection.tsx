"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Trophy, Users, Calendar, CheckCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const HeroSection = () => {
  const router = useRouter();
  return (
    <section className="relative min-h-[88vh] md:min-h-screen md:h-screen flex items-center overflow-hidden bg-[#0F172A]">
      {/* Sport imagery — court/field, navy overlay keeps pro trust, amber injects energy */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=2000&auto=format&fit=crop"
          className="w-full h-full object-cover"
          alt="Indoor sports court"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A]/70 via-[#143258]/55 to-[#0F172A]/85" />
        {/* Amber diagonal energy accent */}
        <div className="absolute -right-20 -bottom-20 w-[600px] h-[400px] bg-[#F59E0B]/15 blur-[80px] rounded-[40px] rotate-12 pointer-events-none" />
        <div className="absolute top-20 right-10 w-1 h-24 bg-[#F59E0B] hidden md:block" />
      </div>

      <div className="relative z-20 container mx-auto px-4 pt-20 pb-28 md:pb-0 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-4xl mx-auto"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F59E0B] text-[#0F172A] text-xs font-bold tracking-widest uppercase border border-[#FBBF24] mb-6">
            <Trophy className="w-3.5 h-3.5" /> Premium Venue Rental
          </span>
          {/* Barlow Condensed, 32px+ , uppercase, tight */}
          <h1 className="font-[var(--font-barlow-condensed)] text-[34px] md:text-7xl font-bold text-white leading-[0.9] tracking-tight uppercase">
            Book Your Court.<br />
            <span className="text-[#F59E0B]">Own The Game.</span>
          </h1>
          <p className="text-[15px] md:text-xl text-white/80 mt-4 md:mt-6 max-w-2xl mx-auto leading-relaxed font-[var(--font-barlow)]">
            Halls, sports courts, and event venues in minutes. From intense matches to grand celebrations.
          </p>
          <div className="hidden sm:flex flex-row items-center justify-center gap-3 mt-8">
            <Button size="lg" onClick={() => router.push('/login')} className="bg-[#F59E0B] hover:bg-[#FBBF24] text-[#0F172A] px-8 h-12 rounded-full font-bold text-[15px] shadow-xl shadow-[#F59E0B]/20">
              Find a Venue <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
            <Button variant="secondary" size="lg" onClick={() => router.push('/login')} className="bg-white/10 backdrop-blur-md hover:bg-white/15 border border-white/20 text-white px-8 h-12 rounded-full font-semibold">
              <Play className="w-4 h-4" /> Watch Venue Tour
            </Button>
          </div>
        </motion.div>

        {/* Stats — visible on mobile too (2x2 grid), amber left accent */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-10 md:mt-16">
          {[
            { label: 'Available Today', count: '12', icon: <Calendar className="w-4 h-4" /> },
            { label: 'Sports Courts', count: '8', icon: <Trophy className="w-4 h-4" /> },
            { label: 'Event Halls', count: '15', icon: <Users className="w-4 h-4" /> },
            { label: 'Instant Booking', count: 'Now', icon: <CheckCircle className="w-4 h-4" /> },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
              className="bg-white/95 backdrop-blur border-l-4 border-l-[#F59E0B] border border-white/60 rounded-xl p-3 md:p-5 flex items-center gap-3 text-left shadow-lg"
            >
              <div className="h-9 w-9 md:h-10 md:w-10 rounded-lg bg-[#0F172A] flex items-center justify-center text-[#F59E0B] shrink-0">
                {stat.icon}
              </div>
              <div>
                <p className="text-lg md:text-2xl font-bold text-[#0F172A] leading-none font-[var(--font-barlow-condensed)]">{stat.count}</p>
                <p className="text-[11px] md:text-xs text-[#57534E] font-medium mt-0.5">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Mobile sticky CTA — stays visible, 44px touch */}
      <div className="absolute bottom-0 inset-x-0 z-30 sm:hidden bg-gradient-to-t from-[#0F172A] via-[#0F172A]/95 to-transparent pt-8 pb-3 px-4 safe-bottom">
        <div className="flex gap-3 max-w-md mx-auto">
          <Button onClick={() => router.push('/login')} className="flex-1 bg-[#F59E0B] hover:bg-[#FBBF24] text-[#0F172A] rounded-full h-11 font-bold shadow-lg">
            Find a Venue <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="secondary" onClick={() => router.push('/login')} className="bg-white text-[#0F172A] border-white rounded-full h-11 px-4 font-semibold">
            Tour
          </Button>
        </div>
      </div>
    </section>
  );
};
