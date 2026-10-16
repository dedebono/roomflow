"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const NAV = [
  { href: '#venues', label: 'Venues' },
  { href: '#sports', label: 'Sports Zone' },
  { href: '#events', label: 'Event Hall' },
  { href: '/tutorial', label: 'How to Rent' },
  { href: '#why-us', label: 'Why Choose Us' },
];

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/95 backdrop-blur-md border-b border-[#FDE68A] shadow-sm' : 'bg-transparent border-b border-white/10'}`}
      style={{ height: 'var(--header-height)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 touch-target">
          <div className="h-9 w-9 rounded-xl bg-[#F59E0B] flex items-center justify-center font-bold text-[#0F172A] text-sm shadow-md">RF</div>
          <span className="font-[var(--font-barlow-condensed)] font-bold text-lg tracking-tight uppercase text-white" style={{ color: isScrolled ? '#0F172A' : '#fff' }}>
            Room<span className="text-[#F59E0B]">Flow</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {NAV.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-2 rounded-full text-sm font-semibold touch-target inline-flex items-center transition-colors ${isScrolled ? 'text-[#57534E] hover:text-[#0F172A] hover:bg-[#FFFBEB]' : 'text-white/90 hover:text-white hover:bg-white/10'}`}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/login" className="ml-2"><Button variant="ghost" className={isScrolled ? 'bg-[#FFFBEB] border border-[#FDE68A]' : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'}>Login</Button></Link>
          <Link href="/register" className="ml-1"><Button className="bg-[#F59E0B] hover:bg-[#FBBF24] text-[#0F172A] shadow-md">Find a Venue <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className={`md:hidden touch-target rounded-xl inline-flex items-center justify-center border ${isScrolled ? 'bg-white border-[#FDE68A] text-[#0F172A]' : 'bg-white/10 border-white/20 text-white'}`}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="md:hidden absolute top-full inset-x-0 bg-white border-b border-[#FDE68A] shadow-xl"
          >
            <div className="px-4 py-4 space-y-1">
              {NAV.map(l => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex items-center touch-target px-3 rounded-xl text-[15px] font-semibold text-[#0F172A] hover:bg-[#FFFBEB] active:bg-[#FDE68A]">
                  {l.label}
                </Link>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#FDE68A] mt-2">
                <Link href="/login" onClick={() => setOpen(false)}><Button variant="secondary" className="w-full justify-center">Login</Button></Link>
                <Link href="/register" onClick={() => setOpen(false)}><Button className="w-full justify-center bg-[#F59E0B] text-[#0F172A]">Register</Button></Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
