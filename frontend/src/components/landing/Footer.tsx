"use client";
import React from 'react';
import Link from 'next/link';
import { Globe, MessageCircle, Share2, Mail, Phone, MapPin } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-slate-100 border-t border-slate-200 pt-16 pb-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-2 cursor-pointer">
              <div className="h-8 w-8 rounded-lg bg-blue-800 flex items-center justify-center font-bold text-white text-lg">
                RF
              </div>
              <span className="font-playfair font-bold text-lg tracking-tight text-slate-900">Room<span className="text-blue-700">Flow</span></span>
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed">
              Premium venue discovery and booking platform for all your sports and event needs. Experience seamless venue management.
            </p>
            <div className="flex gap-4">
              <Link href="#" className="h-8 w-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-all"><Globe className="w-4 h-4" /></Link>
              <Link href="#" className="h-8 w-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-all"><MessageCircle className="w-4 h-4" /></Link>
              <Link href="#" className="h-8 w-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-all"><Share2 className="w-4 h-4" /></Link>
            </div>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold mb-6 uppercase text-xs tracking-widest">Venue Types</h4>
            <ul className="space-y-3 text-sm text-slate-500">
              <li><Link href="#" className="hover:text-blue-700 transition-colors cursor-pointer">Sports Courts</Link></li>
              <li><Link href="#" className="hover:text-blue-700 transition-colors cursor-pointer">Event Halls</Link></li>
              <li><Link href="#" className="hover:text-blue-700 transition-colors cursor-pointer">Conference Rooms</Link></li>
              <li><Link href="#" className="hover:text-blue-700 transition-colors cursor-pointer">Training Spaces</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold mb-6 uppercase text-xs tracking-widest">Support</h4>
            <ul className="space-y-3 text-sm text-slate-500">
              <li><Link href="#" className="hover:text-blue-700 transition-colors cursor-pointer">How it works</Link></li>
              <li><Link href="#" className="hover:text-blue-700 transition-colors cursor-pointer">Pricing</Link></li>
              <li><Link href="#" className="hover:text-blue-700 transition-colors cursor-pointer">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-blue-700 transition-colors cursor-pointer">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold mb-6 uppercase text-xs tracking-widest">Contact</h4>
            <ul className="space-y-3 text-sm text-slate-500">
              <li className="flex items-center gap-3"><MapPin className="w-4 h-4 text-blue-600" /> MLB Center, Jakarta</li>
              <li className="flex items-center gap-3"><Phone className="w-4 h-4 text-blue-600" /> +62 812-3456-7890</li>
              <li className="flex items-center gap-3"><Mail className="w-4 h-4 text-blue-600" /> support@roomflow.com</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 RoomFlow. All rights reserved.</p>
          <p>Premium Venue Booking Platform</p>
        </div>
      </div>
    </footer>
  );
};
