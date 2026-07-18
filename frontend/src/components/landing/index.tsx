"use client";
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { VenueMatch } from './VenueMatch';
import { FeaturedSpaces } from './FeaturedSpaces';
import { LiveAvailability } from './LiveAvailability';
import { SportsZone } from './SportsZone';
import { EventZone } from './EventZone';
import { StatsSection } from './StatsSection';
import { FinalCTA } from './FinalCTA';
import { Footer } from './Footer';
import { Room } from '@/types/index';

export default function LandingPage() {
  const [sportRooms, setSportRooms] = useState<Room[]>([]);
  const [eventRooms, setEventRooms] = useState<Room[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const [sportRes, eventRes, allRes] = await Promise.all([
          api.get<Room[]>('/rentals/available-rooms', { params: { category: 'SPORT' } }),
          api.get<Room[]>('/rentals/available-rooms', { params: { category: 'EVENT' } }),
          api.get<Room[]>('/rentals/available-rooms'),
        ]);
        setSportRooms(sportRes.data);
        setEventRooms(eventRes.data);
        setAllRooms(allRes.data);
      } catch (error) {
        console.error('Error fetching available rooms:', error);
      }
    };
    fetchRooms();
  }, []);

  return (
    <main className="bg-[#f1dece] min-h-screen overflow-x-hidden">
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <Navbar />
      <HeroSection />
      <VenueMatch />
      <FeaturedSpaces rooms={allRooms} />
      <LiveAvailability rooms={allRooms} />
      <SportsZone rooms={sportRooms} />
      <EventZone rooms={eventRooms} />
      <StatsSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}
