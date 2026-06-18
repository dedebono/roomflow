"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Room, RentalSlot } from '@/types/index'; // Import Room and RentalSlot

interface ScheduleSlot {
  time: string;
  status: 'booked' | 'available';
  label?: string;
}

interface VenueSchedule {
  name: string;
  slots: ScheduleSlot[];
}

// Helper to format time as HH.mm
const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  }).replace(':', '.');
};

export const LiveAvailability = ({ rooms }: { rooms: Room[] }) => {
  // Transform rooms into VenueSchedule format
  const todaySchedules: VenueSchedule[] = rooms.map(room => {
    const activeSlots = room.rentalSlots?.filter(slot => slot.isActive) || [];
    
    const slots: ScheduleSlot[] = activeSlots.map(slot => ({
      time: formatTime(new Date().toISOString().split('T')[0] + 'T' + slot.startTime), // combine today's date with slot time
      status: 'available', // Assume available for now, actual availability check needed here
      label: room.name, // Display room name as label
    }));

    return {
      name: room.name,
      slots: slots,
    };
  }).filter(venue => venue.slots.length > 0);
  return (
    <section className="py-24 bg-slate-100">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-playfair font-bold text-slate-900 mb-4">
            Live <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-300">Availability</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Real-time schedule for today. Plan your event or match around our existing bookings.
          </p>
        </motion.div>

        <div className="space-y-8">
          {todaySchedules.map((venue, i) => (
            <motion.div
              key={venue.name}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="bg-white rounded-3xl p-6 border border-slate-200"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50" />
                {venue.name}
              </h3>
              <div className="relative grid grid-cols-1 sm:grid-cols-6 gap-2">
                {venue.slots.map((slot) => (
                  <div 
                    key={slot.time}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
                      slot.status === 'booked' 
                        ? 'bg-rose-500/10 border-rose-500/30' 
                        : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    <span className="text-xs text-slate-500 font-medium">{slot.time}</span>
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      slot.status === 'booked' ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {slot.status === 'booked' ? 'Booked' : 'Free'}
                    </span>
                    {slot.label && <span className="text-[10px] text-slate-500 truncate w-full text-center">{slot.label}</span>}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> All times in UTC timezone
          </p>
        </div>
      </div>
    </section>
  );
};
