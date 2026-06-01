export const venueTypes = [
  { id: 'sports', label: 'Sports', icon: 'Trophy' },
  { id: 'wedding', label: 'Wedding', icon: 'Heart' },
  { id: 'event', label: 'Event', icon: 'Calendar' },
  { id: 'training', label: 'Training', icon: 'GraduationCap' },
  { id: 'birthday', label: 'Birthday', icon: 'Cake' },
  { id: 'community', label: 'Community', icon: 'Users' },
] as const;

export const stats = [
  { value: 95, suffix: '%', label: 'Booking Success' },
  { value: 2, suffix: ' min', label: 'Average Booking Time' },
  { value: 1000, suffix: '+', label: 'Events Hosted' },
  { value: 24, suffix: '/7', label: 'Online Booking' },
];

export const facilities = [
  { icon: 'Car', label: 'Parking' },
  { icon: 'Wifi', label: 'WiFi' },
  { icon: 'Fan', label: 'Air Conditioning' },
  { icon: 'Accessibility', label: 'Wheelchair Access' },
  { icon: 'Utensils', label: 'Food Area' },
  { icon: 'DoorOpen', label: 'Changing Rooms' },
  { icon: 'Shield', label: 'Security' },
  { icon: 'Package', label: 'Equipment Rental' },
];
