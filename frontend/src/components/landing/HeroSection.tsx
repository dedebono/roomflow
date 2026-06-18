"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Trophy, Users, Calendar, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const HeroSection = () => {
  const router = useRouter();
  return (
    <section className="relative h-screen min-h-[700px] flex items-center justify-center overflow-hidden">
      {/* Background Overlay */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-100/60 via-blue-50/80 to-slate-100 z-10" />
        <img 
          src="https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=2000&auto=format&fit=crop" 
          className="w-full h-full object-cover"
          alt="Venue Background"
        />
      </div>

      <div className="relative z-20 container mx-auto px-4 text-center max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold border border-blue-200 mb-6">
            <Trophy className="w-4 h-4" /> Premium Venue Rental Platform
          </span>
          <h1 className="text-5xl md:text-7xl font-playfair font-bold text-slate-900 mb-6 leading-tight tracking-tight">
            Your Event <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-800 to-blue-600">Starts Here.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Book halls, sports courts, and event venues in minutes. 
            Find the perfect space for every occasion, from intense matches to grand celebrations.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => router.push('/login')} className="w-full sm:w-auto bg-blue-800 hover:bg-blue-900 text-white px-10 h-14 rounded-full font-bold text-lg shadow-xl shadow-blue-800/30 cursor-pointer transition-all duration-300">
              Find a Venue <ArrowRight className="ml-2" />
            </Button>
            <Button variant="secondary" size="lg" className="w-full sm:w-auto bg-white/90 backdrop-blur-md hover:bg-white border border-slate-200 text-slate-800 px-10 h-14 rounded-full font-bold text-lg cursor-pointer transition-all duration-300 shadow-md">
              Watch Venue Tour
            </Button>
          </div>
        </motion.div>

        {/* Floating Stats */}
        <div className="hidden lg:grid grid-cols-4 gap-4 mt-20">
          {[
            { label: 'Available Today', count: '12', icon: <Calendar /> },
            { label: 'Sports Courts', count: '8', icon: <Trophy /> },
            { label: 'Event Halls', count: '15', icon: <Users /> },
            { label: 'Instant Booking', count: 'Now', icon: <CheckCircle /> },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + (i * 0.1), duration: 0.5 }}
              className="glass p-6 rounded-2xl flex items-center gap-4 text-left border border-slate-200 shadow-lg"
              style={{ animation: `floating ${3 + i}s ease-in-out infinite` }}
            >
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 leading-none">{stat.count}</p>
                <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes floating {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </section>
  );
};
