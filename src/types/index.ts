export interface TicketTier {
  id: string;
  name: string;
  priceSol: number;
  priceVnd?: number;
  description: string;
  perks: string[];
  totalQuantity: number;
  remainingQuantity: number;
  colorHex?: string;
}

export type EventCategory =
  | 'Nhạc sống'
  | 'Sân khấu & Nghệ thuật'
  | 'Hội thảo & Workshop'
  | 'Tham quan & Trải nghiệm'
  | 'Thể thao'
  | 'Công nghệ'
  | 'Web3'
  | 'Khác'
  | 'Concert'
  | 'EDM Festival'
  | 'Web3 Hackathon'
  | 'Rock Arena'
  | 'DJ Night'
  | (string & {});

export interface EventSession {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'on_sale' | 'upcoming' | 'sold_out' | 'closed';
  remainingQuantity?: number;
}

export interface EventItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: EventCategory;
  bannerImage: string;
  thumbnailImage: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  organizer: {
    name: string;
    avatar: string;
    verified: boolean;
  };
  minPriceSol: number;
  minPriceVnd?: number;
  totalTickets: number;
  soldTickets: number;
  featured: boolean;
  tags: string[];
  status?: 'draft' | 'published' | 'cancelled';
  createdBy?: string;
  lineup?: string[];
  tiers?: TicketTier[];
}

export type UserRole = 'attendee' | 'organizer';

export interface NFTTicket {
  id: string;
  nftTokenId: string;
  eventId: string;
  eventTitle: string;
  eventBanner: string;
  tierName: string;
  seat: string;
  venue: string;
  date: string;
  time: string;
  qrPayload: string;
  ownerAddress: string;
  mintTransaction: string;
  status: 'VALID' | 'CHECKED_IN' | 'TRANSFERRED';
  resaleRoyaltyPercent: number;
}

export interface PurchasedTicket {
  id: string;               // ticketId duy nhất (vd: tkt-1729824000000-0)
  orderId: string;          // mã đơn hàng chung nếu mua nhiều vé (vd: ORD-202610-8921)
  eventId: string;
  eventTitle: string;
  eventBanner: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  tierId: string;
  tierName: string;
  seat: string;
  priceSol: number;
  priceVnd?: number;
  ticketCode: string;       // mã vé riêng biệt (vd: UT-SOL-8921-01)
  customerName: string;
  customerEmail: string;
  customerWallet: string;
  purchasedAt: string;      // ISO string
  purchaseDate: string;      // ISO string nghiệp vụ
  status: 'valid' | 'checked_in' | 'transferred' | 'VALID' | 'CHECKED_IN';
  isCheckedIn: boolean;
  checkInTime?: string;
  checkedInBy?: string;
  /** Explicit demo QR/check-in fields; legacy properties remain for stored tickets. */
  timestamp?: number;
  signatureVersion?: 'mock-v1';
  checkInStatus?: 'unused' | 'checked-in';
  checkedInAt?: number;
  qrPayload: string;        // JSON string mã hóa thông tin vé an toàn cho demo
}

export interface CheckInRecord {
  ticketId: string;
  ticketCode: string;
  checkedInAt: string;
  checkedInBy?: string;
}

export interface CheckInResult {
  status: 'valid' | 'used' | 'invalid' | 'error';
  message: string;
  ticket?: PurchasedTicket;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface CheckoutFormData {
  customerName: string;
  customerEmail: string;
}
