"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trophy, Heart, Calendar, GraduationCap, Cake, Users } from 'lucide-react';
import { venueTypes } from './data';

const iconMap: Record<string, React.ReactNode> = {
  Trophy: <Trophy className="w-8 h-8" />,
  Heart: <Heart className="w-8 h-8" />,
  Calendar: <Calendar className="w-8 h-8" />,
  GraduationCap: <GraduationCap className="w-8 h-8" />,
  Cake: <Cake className="w-8 h-8" />,
  Users: <Users className="w-8 h-8" />,
};

export const VenueMatch = () => {
  const router = useRouter();

  return (
    <section id="venues" className="py-24 bg-white relative">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-playfair font-bold text-slate-900 mb-4">
            What are you <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-300">planning?</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Tell us about your event and we'll find the perfect venue for you.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {venueTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => router.push('/login')}
              className="p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 bg-slate-50 border-slate-200 hover:border-amber-500/50 hover:bg-white hover:scale-105 cursor-pointer"
            >
              <div className="text-amber-400">
                {iconMap[type.icon]}
              </div>
              <span className="text-sm font-semibold text-slate-600">
                {type.label}
              </span>
            </button>
          ))}
        </motion.div>
      </div>
    </section>
  );
};