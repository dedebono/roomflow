export type Role = 'ADMIN_IT' | 'ROOM_ADMIN' | 'RENTER' | 'USER';

export type RoomStatus = 'ACTIVE' | 'MAINTENANCE';

export type BookingStatus = 'BOOKED' | 'CANCELLED';

export type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

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
  amenities?: string[];
  isRentable?: boolean;
  maxBookingHours?: number;
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

export interface RentalSlot {
  id: string;
  roomId: string;
  room?: Room;
  dayOfWeek: number; // 0=Sun, 1=Mon, ... 6=Sat
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  price: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BookingHold {
  id: string;
  roomId: string;
  room?: Room;
  userId: string;
  user?: Partial<User>;
  holdDate: string;
  startTime: string;
  endTime: string;
  price: number;
  status: 'ACTIVE' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  paymentId?: string;
  payment?: Payment;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  bookingHoldId?: string;
  bookingHold?: BookingHold;
  userId: string;
  user?: Partial<User>;
  roomId: string;
  room?: Room;
  amount: number;
  date: string;
  time: string;
  image?: string;
  status: PaymentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: Partial<User>;
  content: string;
  read: boolean;
  createdAt: string;
}

// API response shapes from /chat/conversations endpoints
// getConversationsForUser returns flat shape (list items)
export interface Conversation {
  userId: string;
  userName: string;
  userEmail: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount?: number;
  // For selected conversation (from createOrGetConversation):
  id?: string;
  participant1Id?: string;
  participant2Id?: string;
  participant2?: { id: string; name: string; email: string; role: string };
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}
