"use client";
import React, { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Room } from '@/types/index';
import { getImageUrl } from '@/lib/api';

const VenueCard = ({ room, router }: { room: Room; router: ReturnType<typeof useRouter> }) => (
  <motion.div
    whileHover={{ scale: 1.02, y: -4 }}
    className="bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-amber-600/30 shadow-xl hover:shadow-amber-600/10 transition-all duration-300 flex-shrink-0 w-[320px] group cursor-pointer"
  >
    <div
      className="h-48 bg-gradient-to-br from-blue-900/40 to-slate-800 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${getImageUrl(room.imageUrl || '')})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
      <div className="absolute top-3 right-3">
        {room.status === 'ACTIVE' ? (
          <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-1 rounded-full border border-emerald-500/30">
            Available
          </span>
        ) : (
          <span className="bg-rose-500/20 text-rose-400 text-xs font-bold px-2 py-1 rounded-full border border-rose-500/30">
            Booked
          </span>
        )}
      </div>
      <div className="absolute bottom-3 left-3 right-3">
        <h3 className="text-xl font-bold text-slate-900">{room.name}</h3>
        <p className="text-xs text-slate-600">{room.building?.name || 'N/A'}</p>
      </div>
    </div>
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-amber-400" /> {room.capacity} capacity</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Modern</span>
      </div>
      <div className="flex items-center justify-between pt-2">
        <p className="text-sm"><span className="text-2xl font-bold text-slate-900">${room.price || 0}</span> <span className="text-slate-500">/hour</span></p>
        <motion.button
          whileHover={{ scale: 1.1 }}
          onClick={() => router.push('/login')}
          className="h-10 w-10 rounded-full bg-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/30 group-hover:scale-110 transition-transform cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  </motion.div>
);

export const FeaturedSpaces = ({ rooms }: { rooms: Room[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -350 : 350, behavior: 'smooth' });
    }
  };

  return (
    <section id="featured" className="py-24 bg-slate-50 relative">
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-playfair font-bold text-slate-900 mb-4">
            Featured <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-300">Spaces</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Scroll through our most popular venues. Find the perfect fit for your next event or match.
          </p>
        </motion.div>

        <div className="relative">
          <button onClick={() => scroll('left')} className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-slate-100 border border-slate-300 items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div ref={scrollRef} className="flex gap-6 overflow-x-auto pb-8 scroll-smooth no-scrollbar snap-x snap-mandatory">
            {rooms.map((room, i) => (
              <div key={room.id} className="snap-start">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <VenueCard room={room} router={router} />
                </motion.div>
              </div>
            ))}
          </div>
          <button onClick={() => scroll('right')} className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-slate-100 border border-slate-300 items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};