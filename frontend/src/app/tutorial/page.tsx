'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, UserPlus, LogIn, Building2, Calendar, Clock, CreditCard, CheckCircle, Sparkles } from 'lucide-react';

const steps = [
  {
    num: 1,
    icon: <UserPlus className="w-6 h-6" />,
    title: 'Create Account',
    desc: 'Sign up for a RoomFlow account using your email. Fill in your details and choose a secure password.',
    link: '/register',
    linkLabel: 'Create Account',
  },
  {
    num: 2,
    icon: <LogIn className="w-6 h-6" />,
    title: 'Log In',
    desc: 'Log in with your email and password. Once logged in, you\'ll have access to browse and book rooms.',
    link: '/login',
    linkLabel: 'Log In',
  },
  {
    num: 3,
    icon: <Building2 className="w-6 h-6" />,
    title: 'Browse & Choose Room',
    desc: 'Browse available rooms by category — Sport or Event. Filter by date, search by name, and pick the room that fits your needs.',
    link: '/renter/rooms',
    linkLabel: 'Browse Rooms',
  },
  {
    num: 4,
    icon: <Calendar className="w-6 h-6" />,
    title: 'Pick a Date',
    desc: 'On the room detail page, select your rental date from the date picker. Available dates are shown with open time slots.',
  },
  {
    num: 5,
    icon: <Clock className="w-6 h-6" />,
    title: 'Choose Time Slot',
    desc: 'Pick an available time slot that works for you. Each slot shows the price. After selecting, click "Create Booking Hold" to reserve it.',
  },
  {
    num: 6,
    icon: <CreditCard className="w-6 h-6" />,
    title: 'Make Payment',
    desc: 'Upload your payment proof (transfer receipt/screenshot) within 1 hour to confirm the booking. The hold expires if payment isn\'t uploaded in time.',
  },
  {
    num: 7,
    icon: <CheckCircle className="w-6 h-6" />,
    title: 'Booking Confirmed',
    desc: 'Once manager approves your payment, the booking is confirmed. You\'ll see it in your bookings list with confirmed status.',
  },
];

const StepCard = ({ step, index }: { step: typeof steps[0]; index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1, duration: 0.5 }}
    className="relative"
  >
    {/* Connector line */}
    {index < steps.length - 1 && (
      <div className="hidden lg:block absolute left-8 top-20 w-px h-24 bg-gradient-to-b from-indigo-500/40 to-transparent" />
    )}

    <div className="flex gap-6">
      {/* Step number */}
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 flex-shrink-0">
          {step.icon}
        </div>
        <span className="text-xs font-bold text-indigo-400 mt-2">Step {step.num}</span>
      </div>

      {/* Content */}
      <div className="flex-1 pb-16">
        <h3 className="text-2xl font-bold text-white mb-2">{step.title}</h3>
        <p className="text-slate-500 text-base leading-relaxed mb-4">{step.desc}</p>
        {step.link && (
          <Link href={step.link}>
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/30 cursor-pointer">
              {step.linkLabel} <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        )}
      </div>
    </div>
  </motion.div>
);

export default function TutorialPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-4 max-w-3xl text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-600/20 text-indigo-400 text-sm font-semibold border border-indigo-600/30 mb-6">
              <Sparkles className="w-4 h-4" /> How to Rent
            </span>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              How to <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">Rent a Room</span>
            </h1>
            <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
              Follow these simple steps to book a venue on RoomFlow. From signing up to confirming your booking — we've got you covered.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="pb-28">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-4">
            {steps.map((step, i) => (
              <StepCard key={step.num} step={step} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Quick Recap */}
      <section className="pb-28">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 rounded-3xl p-10 text-center"
          >
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-3">Ready to Rent?</h2>
            <p className="text-slate-500 mb-8 max-w-md mx-auto">
              Create an account and start browsing available venues. Your perfect space is just a few clicks away.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <span className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xl shadow-indigo-600/30 transition-all cursor-pointer">
                  Get Started <ArrowRight className="w-5 h-5" />
                </span>
              </Link>
              <Link href="/renter/rooms">
                <span className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold transition-all cursor-pointer">
                  Browse Rooms
                </span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}