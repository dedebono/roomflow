"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Room } from '@/types/index';
import { getImageUrl } from '@/lib/api';

export const EventZone = ({ rooms }: { rooms: Room[] }) => {
  return (
    <section id="events" className="py-24 bg-slate-900/50">
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Event <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-sky-400">Halls</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Celebrate, train, and gather in our premium event spaces.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rooms.length === 0 && (
            <p className="text-slate-500 col-span-full text-center">No event halls available right now.</p>
          )}
          {rooms.map((room, i) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.01 }}
              className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 hover:border-blue-600/30 flex flex-col sm:flex-row group"
            >
              <div 
                className="sm:w-48 h-40 sm:h-auto bg-gradient-to-br from-indigo-900/30 to-blue-800/20 relative flex items-center justify-center bg-cover bg-center"
                style={{ backgroundImage: `url(${getImageUrl(room.imageUrl || '')})` }}
              >
                <span className="text-5xl opacity-20 group-hover:opacity-50 transition-opacity">🏛️</span>
              </div>
              <div className="flex-1 p-6">
                <h3 className="text-xl font-bold text-white mb-2">{room.name}</h3>
                <div className="flex items-center gap-4 mb-3">
                  <span className="flex items-center gap-1 text-sm text-slate-400"><Users className="w-4 h-4" /> Up to {room.capacity}</span>
                </div>
                {/* Features from backend room object not directly available */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full">{room.building?.name || 'Hall'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm"><span className="text-2xl font-bold text-white">${room.price || 0}</span> <span className="text-slate-400">/hour</span></p>
                  <Button variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-sm rounded-full h-9">
                    View Details <ArrowRight className="ml-1 w-3 h-3" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
