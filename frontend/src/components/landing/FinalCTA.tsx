"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

export const FinalCTA = () => {
  return (
    <section className="py-24 relative overflow-hidden bg-slate-950">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-12 md:p-20 rounded-[40px]"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Find Your <br /> Perfect <span className="text-blue-500">Venue?</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            From sports matches to unforgettable celebrations, discover the perfect space today. Book instantly with RoomFlow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-12 h-14 rounded-full font-bold shadow-xl shadow-blue-600/30">
              Browse Venues
            </Button>
            <Button variant="secondary" size="lg" className="w-full sm:w-auto bg-transparent hover:bg-white/5 border-slate-700 text-white px-12 h-14 rounded-full font-bold">
              Contact Us
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
