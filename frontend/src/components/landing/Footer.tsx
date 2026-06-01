"use client";
import React from 'react';
import Link from 'next/link';
import { Globe, MessageCircle, Share2, Mail, Phone, MapPin } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 pt-16 pb-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-lg">
                ML
              </div>
              <span className="font-bold text-lg tracking-tight text-white">MLB <span className="text-blue-500">HALL RENT</span></span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed">
              Premium venue discovery and booking platform for all your sports and event needs. Experience seamless venue management.
            </p>
            <div className="flex gap-4">
              <Link href="#" className="h-8 w-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"><Globe className="w-4 h-4" /></Link>
              <Link href="#" className="h-8 w-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"><MessageCircle className="w-4 h-4" /></Link>
              <Link href="#" className="h-8 w-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"><Share2 className="w-4 h-4" /></Link>
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 uppercase text-xs tracking-widest">Venue Types</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><Link href="#" className="hover:text-blue-400 transition-colors">Sports Courts</Link></li>
              <li><Link href="#" className="hover:text-blue-400 transition-colors">Event Halls</Link></li>
              <li><Link href="#" className="hover:text-blue-400 transition-colors">Conference Rooms</Link></li>
              <li><Link href="#" className="hover:text-blue-400 transition-colors">Training Spaces</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 uppercase text-xs tracking-widest">Support</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><Link href="#" className="hover:text-blue-400 transition-colors">How it works</Link></li>
              <li><Link href="#" className="hover:text-blue-400 transition-colors">Pricing</Link></li>
              <li><Link href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-blue-400 transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 uppercase text-xs tracking-widest">Contact</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-center gap-3"><MapPin className="w-4 h-4 text-blue-500" /> MLB Center, Jakarta</li>
              <li className="flex items-center gap-3"><Phone className="w-4 h-4 text-blue-500" /> +62 812-3456-7890</li>
              <li className="flex items-center gap-3"><Mail className="w-4 h-4 text-blue-500" /> support@mlbhall.com</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 MLB HALL RENT. All rights reserved.</p>
          <p>Powered by RoomFlow Engine</p>
        </div>
      </div>
    </footer>
  );
};
