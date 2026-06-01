"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Heart, Calendar, GraduationCap, Cake, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [guests, setGuests] = useState(25);

  return (
    <section id="venues" className="py-24 bg-slate-950 relative">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            What are you <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-sky-400">planning?</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Tell us about your event and we'll find the perfect venue for you.
          </p>
        </motion.div>

        {/* Step 1: Venue Type */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          viewport={{ once: true }}
          className="mb-12"
        >
          <p className="text-sm text-slate-500 mb-4 font-semibold tracking-wide uppercase">Step 1 of 3</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {venueTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 ${
                  selectedType === type.id
                    ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-600/20 scale-105'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
                }`}
              >
                <div className={`${selectedType === type.id ? 'text-white' : 'text-blue-500'}`}>
                  {iconMap[type.icon]}
                </div>
                <span className={`text-sm font-semibold ${selectedType === type.id ? 'text-white' : 'text-slate-300'}`}>
                  {type.label}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Step 2: Guest Count */}
        {selectedType && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="mb-12"
          >
            <p className="text-sm text-slate-500 mb-4 font-semibold tracking-wide uppercase">Step 2 of 3 — How many guests?</p>
            <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <p className="text-4xl font-bold text-white">{guests}</p>
                <span className="text-slate-400 text-sm">guests</span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between mt-2 text-xs text-slate-600">
                <span>10</span>
                <span>500+</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Steps 3 & Result */}
        {selectedType && guests > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <p className="text-sm text-slate-500 mb-4 font-semibold tracking-wide uppercase">Step 3 of 3 — Pick your date</p>
            <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 mb-8">
              <input
                type="date"
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-center w-full max-w-xs"
                defaultValue={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              />
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-blue-600/10 border border-blue-600/30 rounded-2xl p-8"
            >
              <Sparkles className="w-8 h-8 text-blue-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">
                We found <span className="text-blue-400">4 perfect</span> venues for your event!
              </h3>
              <p className="text-slate-400 mb-6">Based on {venueTypes.find(t => t.id === selectedType)?.label || 'event'} — {guests} guests</p>
              <Button variant="primary" className="bg-blue-600 hover:bg-blue-500 px-8 rounded-full h-12">
                View All Venues
              </Button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </section>
  );
};
