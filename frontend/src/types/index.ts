export type Role = 'ADMIN_IT' | 'ROOM_ADMIN' | 'USER';

export type RoomStatus = 'ACTIVE' | 'MAINTENANCE';

export type BookingStatus = 'BOOKED' | 'CANCELLED';

export type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Building {
  id: string;
  name: string;
  rooms?: Room[];
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  buildingId: string;
  building?: Building;
  name: string;
  capacity: number;
  description?: string;
  imageUrl?: string;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  roomId: string;
  room?: Room;
  userId: string;
  user?: Partial<User>;
  title: string;
  notes?: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BookingChangeRequest {
  id: string;
  bookingId: string;
  booking?: Booking;
  requestedById: string;
  requestedBy?: User;
  requestedRoomId?: string;
  requestedStart?: string;
  requestedEnd?: string;
  reason?: string;
  status: ChangeRequestStatus;
  createdAt: string;
  updatedAt: string;
}
