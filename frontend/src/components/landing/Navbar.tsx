"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="h-10 w-10 rounded-xl bg-blue-800 flex items-center justify-center font-bold text-white text-xl shadow-lg group-hover:scale-105 transition-transform">
              RF
            </div>
            <span className="font-playfair font-bold text-xl tracking-tight text-slate-900">Room<span className="text-blue-700">Flow</span></span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#venues" className="text-sm font-medium text-slate-600 hover:text-blue-800 transition-colors">Venues</Link>
            <Link href="#sports" className="text-sm font-medium text-slate-600 hover:text-blue-800 transition-colors">Sports Zone</Link>
            <Link href="#events" className="text-sm font-medium text-slate-600 hover:text-blue-800 transition-colors">Event Hall</Link>
            <Link href="/tutorial" className="text-sm font-medium text-slate-600 hover:text-blue-800 transition-colors">How to Rent</Link>
            <Link href="#why-us" className="text-sm font-medium text-slate-600 hover:text-blue-800 transition-colors">Why Choose Us</Link>
            <Link href="/login">
              <Button variant="secondary" className="bg-slate-100 hover:bg-slate-200 border-none text-slate-800 px-6 cursor-pointer">
                Login
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" className="bg-blue-800 hover:bg-blue-900 shadow-lg px-6 cursor-pointer text-white">
                Find a Venue <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button className="md:hidden text-slate-700" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-200 p-4 space-y-4 shadow-lg"
        >
          <Link href="#venues" className="block text-base font-medium text-slate-700" onClick={() => setMobileMenuOpen(false)}>Venues</Link>
          <Link href="#sports" className="block text-base font-medium text-slate-700" onClick={() => setMobileMenuOpen(false)}>Sports Zone</Link>
          <Link href="#events" className="block text-base font-medium text-slate-700" onClick={() => setMobileMenuOpen(false)}>Event Hall</Link>
          <Link href="/tutorial" className="block text-base font-medium text-slate-700" onClick={() => setMobileMenuOpen(false)}>How to Rent</Link>
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/login">
              <Button variant="secondary" className="w-full">Login</Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" className="w-full">Register Now</Button>
            </Link>
          </div>
        </motion.div>
      )}
    </nav>
  );
};
