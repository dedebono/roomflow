"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Dumbbell, CircleDot, Footprints, Building, Ban } from 'lucide-react';
import { Room } from '@/types/index';

const sportIcons: Record<string, React.ReactNode> = {
  'Badminton': <Dumbbell className="w-10 h-10" />,
  'Basketball': <CircleDot className="w-10 h-10" />,
  'Futsal': <Footprints className="w-10 h-10" />,
  'Football': <Footprints className="w-10 h-10" />,
};
const getIcon = (name: string) => {
  for (const [k, icon] of Object.entries(sportIcons)) if (name.toLowerCase().includes(k.toLowerCase())) return icon;
  return <Building className="w-10 h-10" />;
};

export const SportsZone = ({ rooms }: { rooms: Room[] }) => {
  const router = useRouter();
  return (
    <section id="sports" className="py-12 md:py-24 bg-white">
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8 md:mb-12">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#F59E0B] mb-2">Book & Play</p>
          <h2 className="text-[32px] md:text-5xl font-bold text-[#0F172A]">
            Sports <span className="text-[#F59E0B]">Zone</span>
          </h2>
          <p className="text-[#57534E] mt-3 max-w-xl mx-auto text-sm md:text-base">Premium courts — tap any card to check availability and book.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {rooms.length === 0 && <p className="text-[#57534E] col-span-full text-center py-8">No sports venues available right now.</p>}
          {rooms.map((room, i) => {
            const booked = room.status !== 'ACTIVE';
            return (
              <motion.button
                key={room.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                onClick={() => router.push('/login')}
                className={`text-left bg-white rounded-2xl overflow-hidden border-2 flex flex-col w-full touch-target focus-visible:outline-none ${booked ? 'border-[#FDE68A] opacity-90' : 'border-[#FDE68A] hover:border-[#F59E0B] hover:shadow-lg hover:shadow-[#F59E0B]/10'} active:scale-[0.99] transition-all`}
                aria-label={`Book ${room.name}`}
              >
                <div className="h-36 md:h-40 relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#0F172A] to-[#1E3A5F]">
                  <span className="relative z-10 text-white/90 group-hover:scale-110 transition-transform">{getIcon(room.name)}</span>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  {/* Price badge */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${booked ? 'bg-white/90 text-[#57534E] border-white' : 'bg-[#F59E0B] text-[#0F172A] border-[#FBBF24]'}`}>
                      Rp {(room.price || 0).toLocaleString('id-ID')}/hr
                    </span>
                  </div>
                  {/* Status */}
                  <div className="absolute top-3 right-3 z-10">
                    {booked ? (
                      <span className="inline-flex items-center gap-1 bg-white text-[#DC2626] text-[11px] font-bold px-2 py-1 rounded-full"><Ban className="w-3 h-3" /> Fully Booked</span>
                    ) : (
                      <span className="bg-[#22c55e] text-white text-[11px] font-bold px-2 py-1 rounded-full">Available</span>
                    )}
                  </div>
                  {booked && <div className="absolute inset-0 bg-white/55 backdrop-blur-[1px] z-[5]" />}
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <h3 className="font-bold text-[#0F172A] leading-tight line-clamp-1">{room.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-[#57534E]"><MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{room.building?.name || 'N/A'}</span></div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className={`text-xs font-bold ${booked ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>{booked ? 'Check other slots' : 'Tap to book'}</span>
                    <span className={`h-8 w-8 rounded-full inline-flex items-center justify-center ${booked ? 'bg-[#F1F2EF] text-[#57534E]' : 'bg-[#0F172A] text-[#F59E0B]'}`}><ArrowRight className="w-4 h-4" /></span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
