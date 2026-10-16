"use client";
import React, { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Room } from '@/types/index';
import { getImageUrl } from '@/lib/api';

const VenueCard = ({ room, router }: { room: Room; router: ReturnType<typeof useRouter> }) => {
  const booked = room.status !== 'ACTIVE';
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl overflow-hidden border-2 border-[#FDE68A] hover:border-[#F59E0B]/50 shadow-sm hover:shadow-lg hover:shadow-[#F59E0B]/10 transition-all duration-300 flex-shrink-0 w-[280px] sm:w-[320px] snap-start group flex flex-col"
    >
      <button
        onClick={() => router.push('/login')}
        className="text-left w-full flex flex-col flex-1 focus-visible:outline-none"
        aria-label={`View ${room.name}`}
      >
        <div
          className="h-44 relative overflow-hidden bg-cover bg-center shrink-0"
          style={{ backgroundImage: `url(${getImageUrl(room.imageUrl || '') || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=800&auto=format&fit=crop'})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/80 via-[#0F172A]/10 to-transparent" />
          <div className="absolute top-3 right-3">
            {booked ? (
              <span className="bg-white text-[#DC2626] text-xs font-bold px-2.5 py-1 rounded-full border border-white">Booked</span>
            ) : (
              <span className="bg-[#22c55e] text-white text-xs font-bold px-2.5 py-1 rounded-full">Available</span>
            )}
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-lg font-bold text-white leading-tight line-clamp-1">{room.name}</h3>
            <p className="text-xs text-white/80 truncate">{room.building?.name || 'Venue'}</p>
          </div>
        </div>
        <div className="p-4 space-y-3 flex-1 flex flex-col">
          <div className="flex items-center gap-4 text-sm text-[#57534E]">
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-[#F59E0B]" /> {room.capacity} capacity</span>
          </div>
          <div className="flex items-center justify-between pt-1 mt-auto">
            <p className="text-sm"><span className="text-xl font-bold text-[#0F172A]">Rp {(room.price || 0).toLocaleString('id-ID')}</span> <span className="text-[#57534E] text-xs">/hour</span></p>
            <span className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${booked ? 'bg-[#F1F2EF] text-[#57534E]' : 'bg-[#F59E0B] text-[#0F172A] group-hover:bg-[#0F172A] group-hover:text-[#F59E0B]'} transition-colors`}><ArrowRight className="w-4 h-4" /></span>
          </div>
        </div>
      </button>
    </motion.div>
  );
};

export const FeaturedSpaces = ({ rooms }: { rooms: Room[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const scroll = (dir: 'left' | 'right') => ref.current?.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
  const list = rooms.length ? rooms : [];

  return (
    <section id="featured" className="py-12 md:py-24 bg-[#FFFBEB] relative">
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-6 md:mb-10">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#F59E0B] mb-2">Most Popular</p>
          <h2 className="text-[32px] md:text-5xl font-bold text-[#0F172A]">Featured <span className="text-[#F59E0B]">Spaces</span></h2>
          <p className="text-[#57534E] mt-3 max-w-xl mx-auto text-sm md:text-base">Horizontal scroll — snap + peeking on mobile. Tap any card to book.</p>
        </motion.div>

        <div className="relative">
          <button onClick={() => scroll('left')} aria-label="Scroll left" className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-white border-2 border-[#FDE68A] items-center justify-center text-[#0F172A] hover:border-[#F59E0B] hover:bg-[#FFFBEB] touch-target">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div
            ref={ref}
            className="flex gap-4 overflow-x-auto pb-6 scroll-smooth no-scrollbar snap-x snap-mandatory pr-4 md:pr-0"
            style={{ scrollbarWidth: 'none' }}
          >
            {list.length === 0 ? (
              <p className="text-[#57534E] py-8 mx-auto">No featured spaces yet.</p>
            ) : (
              list.map((room, i) => (
                <motion.div key={room.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                  <VenueCard room={room} router={router} />
                </motion.div>
              ))
            )}
          </div>
          <button onClick={() => scroll('right')} aria-label="Scroll right" className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-white border-2 border-[#FDE68A] items-center justify-center text-[#0F172A] hover:border-[#F59E0B] hover:bg-[#FFFBEB] touch-target">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};
