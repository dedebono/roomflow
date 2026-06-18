'use client';

import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: any;
}

interface BookingCalendarProps {
  events: CalendarEvent[];
  onDateSelect?: (selectInfo: any) => void;
  onEventClick?: (clickInfo: any) => void;
  onEventDrop?: (dropInfo: any) => void;
  editable?: boolean;
}

export default function BookingCalendar({
  events,
  onDateSelect,
  onEventClick,
  onEventDrop,
  editable = false,
}: BookingCalendarProps) {
  return (
    <div className="w-full glass rounded-2xl p-2 sm:p-6 border border-slate-200 shadow-xl bg-white calendar-container">
      <style jsx global>{`
        .fc {
          --fc-border-color: rgba(30, 41, 59, 0.5);
          --fc-button-bg-color: #1e293b;
          --fc-button-border-color: #334155;
          --fc-button-hover-bg-color: #334155;
          --fc-button-active-bg-color: #4f46e5;
          --fc-button-active-border-color: #4f46e5;
          --fc-today-bg-color: rgba(79, 70, 229, 0.05);
          font-size: 0.85rem;
        }
        .fc .fc-toolbar {
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem !important;
        }
        .fc .fc-toolbar-title {
          font-size: 1rem !important;
          font-weight: 700;
        }
        .fc .fc-button {
          padding: 0.4rem 0.6rem !important;
          font-size: 0.75rem !important;
          font-weight: 600 !important;
          text-transform: capitalize !important;
        }
        @media (max-width: 640px) {
          .fc .fc-toolbar {
            flex-direction: column;
            align-items: center;
          }
          .fc .fc-toolbar-chunk {
            display: flex;
            gap: 4px;
          }
          .fc-header-toolbar {
            margin-bottom: 0.5rem !important;
          }
          .fc-view-harness {
            height: 500px !important;
          }
        }
      `}</style>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={typeof window !== 'undefined' && window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek'}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        allDaySlot={false}
        slotMinTime="00:00:00" // Show all hours so early/late bookings visible
        slotMaxTime="24:00:00"
        timeZone='UTC' // Ensure FullCalendar interprets times as UTC from backend
        contentHeight={600}
        handleWindowResize={true}
        expandRows={true}
        editable={editable}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        weekends={true}
        events={events}
        displayEventEnd={true} // Always show event end times for clarity
        select={onDateSelect}
        eventClick={onEventClick}
        eventDrop={onEventDrop}
        slotDuration="00:30:00"
        snapDuration="00:15:00"
        nowIndicator={true}
      />
    </div>
  );
}
