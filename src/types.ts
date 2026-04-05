export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  approvedIncome: number;
  pendingIncome: number;
  conversions: number;
  clicks: number;
  lastUpdated?: any;
}

export interface ChartData {
  time: string;
  clicks: number;
  conversions: number;
  payout: number;
}
