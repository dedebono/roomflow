"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Room } from '@/types/index';
import { getImageUrl } from '@/lib/api';

export const EventZone = ({ rooms }: { rooms: Room[] }) => {
  return (
    <section id="events" className="py-24 bg-slate-100">
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-playfair font-bold text-slate-900 mb-4">
            Event <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-300">Halls</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
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
              className="bg-white rounded-3xl overflow-hidden border border-slate-200 hover:border-amber-600/30 flex flex-col sm:flex-row group cursor-pointer"
            >
              <div 
                className="sm:w-48 h-40 sm:h-auto bg-gradient-to-br from-amber-900/30 to-amber-800/20 relative flex items-center justify-center bg-cover bg-center"
                style={{ backgroundImage: `url(${getImageUrl(room.imageUrl || '')})` }}
              >
                <Building2 className="w-12 h-12 text-amber-400 opacity-20 group-hover:opacity-50 transition-opacity" />
              </div>
              <div className="flex-1 p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{room.name}</h3>
                <div className="flex items-center gap-4 mb-3">
                  <span className="flex items-center gap-1 text-sm text-slate-500"><Users className="w-4 h-4" /> Up to {room.capacity}</span>
                </div>
                {/* Features from backend room object not directly available */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{room.building?.name || 'Hall'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm"><span className="text-2xl font-bold text-slate-900">Rp {(room.price || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span> <span className="text-slate-500">/hour</span></p>
                  <Button variant="secondary" className="bg-slate-100 hover:bg-slate-200 text-sm rounded-full h-9 cursor-pointer transition-all duration-300">
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
