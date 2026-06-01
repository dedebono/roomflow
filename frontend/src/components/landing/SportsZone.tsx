"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin } from 'lucide-react';
import { Room } from '@/types/index';

const sportIcons: Record<string, string> = {
  'Badminton': '🏸',
  'Basketball': '🏀',
  'Futsal': '⚽',
  'Football': '⚽',
};

const getSportIcon = (name: string) => {
  for (const [key, icon] of Object.entries(sportIcons)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '🏟️';
};

export const SportsZone = ({ rooms }: { rooms: Room[] }) => {
  return (
    <section id="sports" className="py-24 bg-slate-950">
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Sports <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-sky-400">Zone</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Book premium sports courts for your next game or practice session.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {rooms.length === 0 && (
            <p className="text-slate-500 col-span-full text-center">No sports venues available right now.</p>
          )}
          {rooms.map((room, i) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 hover:border-blue-600/30 group"
            >
              <div className="h-48 bg-gradient-to-br from-blue-900/40 to-indigo-800/20 relative flex items-center justify-center">
                <span className="text-6xl opacity-30 group-hover:opacity-60 transition-opacity">
                  {getSportIcon(room.name)}
                </span>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 to-transparent h-16" />
              </div>
              <div className="p-5 space-y-3">
                <h3 className="text-lg font-bold text-white">{room.name}</h3>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-emerald-400 font-semibold">{room.status === 'ACTIVE' ? 'Available Today' : 'Fully Booked'}</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-white font-bold">${room.price || 0}<span className="text-slate-400 font-normal">/hr</span></span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="w-3 h-3" /> {room.building?.name || 'N/A'}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
