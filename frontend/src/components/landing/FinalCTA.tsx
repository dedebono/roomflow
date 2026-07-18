"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

export const FinalCTA = () => {
  return (
    <section className="py-24 relative overflow-hidden bg-[#f1dece]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-[#fefefe] backdrop-blur-md border border-[#cbe2f0] p-12 md:p-20 rounded-[40px]"
        >
          <h2 className="text-4xl md:text-5xl font-playfair font-bold text-[#143258] mb-6">
            Ready to Find Your <br /> Perfect <span className="text-amber-500">Venue?</span>
          </h2>
          <p className="text-[#747474] text-lg mb-10 max-w-xl mx-auto">
            From sports matches to unforgettable celebrations, discover the perfect space today. Book instantly with RoomFlow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-white px-12 h-14 rounded-full font-bold shadow-xl shadow-amber-500/30 cursor-pointer transition-all duration-300">
              Browse Venues
            </Button>
            <Button variant="secondary" size="lg" className="w-full sm:w-auto bg-transparent hover:bg-[#f1dece] border-[#cbe2f0] text-[#474547] px-12 h-14 rounded-full font-bold cursor-pointer transition-all duration-300">
              Contact Us
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
