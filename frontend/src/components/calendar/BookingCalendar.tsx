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
    <div className="w-full glass rounded-2xl p-6 border border-slate-900 shadow-xl bg-slate-900/10">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        allDaySlot={false}
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        height="680px"
        editable={editable}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        weekends={true}
        events={events}
        select={onDateSelect}
        eventClick={onEventClick}
        eventDrop={onEventDrop}
        slotDuration="00:30:00"
        snapDuration="00:15:00"
      />
    </div>
  );
}
