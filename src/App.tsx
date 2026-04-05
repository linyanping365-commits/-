import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  History, 
  Settings, 
  LogOut, 
  Menu, 
  Maximize, 
  Bell, 
  Info, 
  User as UserIcon,
  ChevronRight,
  TrendingUp,
  DollarSign,
  MousePointerClick,
  RefreshCw,
  Plus,
  Tag,
  Search,
  Filter,
  Download,
  RotateCcw,
  Database,
  ExternalLink,
  X,
  ChevronLeft,
  Copy,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  googleProvider, 
  OperationType, 
  handleFirestoreError 
} from './firebase';
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { cn } from './lib/utils';
import { DailyStats, UserProfile } from './types';

// --- Components ---

const Card = ({ title, children, className }: { title: string, children: React.ReactNode, className?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden", className)}
  >
    <div className="bg-blue-500 text-white px-4 py-2 text-sm font-medium text-center">
      {title}
    </div>
    <div className="p-4">
      {children}
    </div>
  </motion.div>
);

const StatItem = ({ label, value, color = "text-gray-600" }: { label: string, value: string | number, color?: string }) => (
  <div className="flex flex-col items-center">
    <span className="text-xs text-gray-400 mb-1">{label}</span>
    <span className={cn("text-lg font-semibold", color)}>{value}</span>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'offers' | 'settings'>('dashboard');
  const [selectedRange, setSelectedRange] = useState<'today' | 'yesterday' | 'month'>('today');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null);
  const [activeModalTab, setActiveModalTab] = useState('Basic');
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const itemsPerPage = 50;

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Seeded random function to ensure "permanent" fixed positions
  const seededRandom = (seed: number) => {
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  };

  // Generate 1980 Offers with fixed randomization
  const allOffers = useMemo(() => {
    const rng = seededRandom(12345); // Fixed seed for permanent positions
    const offers = [];
    
    // 500 items: $10.00 - $15.99, no approval
    const startTime = new Date(2025, 9, 1).getTime(); // Oct 2025
    const endTime = new Date(2026, 3, 3).getTime(); // Apr 3, 2026
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 500; i++) {
      const id = 1001 + i;
      const created = new Date(startTime + rng() * (endTime - startTime));
      // Update time is within 5 days of creation, but not exceeding endTime
      const maxUpdate = Math.min(created.getTime() + fiveDaysMs, endTime);
      const updated = new Date(created.getTime() + rng() * (maxUpdate - created.getTime()));
      
      offers.push({
        id: id,
        name: `(Web/Wap) #${id} V2 (Weekly) Supersonic - US - CC SUBMIT`,
        payout: Number((rng() * 5.99 + 10).toFixed(2)),
        needApproval: false,
        status: 'Available',
        category: 'Mainstream',
        countries: ['us', 'ca', 'gb'],
        type: 'CPA',
        createdAt: format(created, 'yyyy-MM-dd HH:mm:ss'),
        updatedAt: format(updated, 'yyyy-MM-dd HH:mm:ss')
      });
    }
    
    // 1480 items: $16.00 - $30.99, need approval
    for (let i = 0; i < 1480; i++) {
      const id = 1501 + i;
      const created = new Date(startTime + rng() * (endTime - startTime));
      const maxUpdate = Math.min(created.getTime() + fiveDaysMs, endTime);
      const updated = new Date(created.getTime() + rng() * (maxUpdate - created.getTime()));

      offers.push({
        id: id,
        name: `(Web/Wap) #${id} V2 (Biweekly) Campaignworld - BLANK V7 - US/AU/FR - CC`,
        payout: Number((rng() * 14.99 + 16).toFixed(2)),
        needApproval: true,
        status: 'Available',
        category: 'Sweepstakes',
        countries: ['us', 'au', 'fr', 'kr', 'jp'],
        type: 'CPA',
        createdAt: format(created, 'yyyy-MM-dd HH:mm:ss'),
        updatedAt: format(updated, 'yyyy-MM-dd HH:mm:ss')
      });
    }

    // Fisher-Yates Shuffle with seeded RNG
    for (let i = offers.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [offers[i], offers[j]] = [offers[j], offers[i]];
    }

    return offers;
  }, []);

  const [filteredOffers, setFilteredOffers] = useState(allOffers);
  const [filterValues, setFilterValues] = useState({
    name: '',
    id: '',
    status: 'Active',
    category: '',
    country: '',
  });

  const paginatedOffers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOffers.slice(start, start + itemsPerPage);
  }, [filteredOffers, currentPage]);

  const totalPages = Math.ceil(filteredOffers.length / itemsPerPage);

  const handleApplyFilter = () => {
    let result = allOffers;
    if (filterValues.name) {
      result = result.filter(o => o.name.toLowerCase().includes(filterValues.name.toLowerCase()));
    }
    if (filterValues.id) {
      result = result.filter(o => o.id.toString() === filterValues.id);
    }
    setFilteredOffers(result);
    setCurrentPage(1);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'User',
            photoURL: currentUser.photoURL || '',
            role: currentUser.email === 'linyanping365@gmail.com' ? 'admin' : 'user',
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', currentUser.uid), newProfile);
          setUserProfile(newProfile);
        } else {
          setUserProfile(userDoc.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Stats Listener
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'daily_stats'), orderBy('date', 'desc'), limit(31));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stats = snapshot.docs.map(doc => doc.data() as DailyStats);
      setDailyStats(stats);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'daily_stats');
    });

    return () => unsubscribe();
  }, [user]);

  // Derived Stats
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  const statsToday = dailyStats.find(s => s.date === todayStr) || { date: todayStr, approvedIncome: 0, pendingIncome: 0, conversions: 0, clicks: 0 };
  const statsYesterday = dailyStats.find(s => s.date === yesterdayStr) || { date: yesterdayStr, approvedIncome: 0, pendingIncome: 0, conversions: 0, clicks: 0 };
  
  const statsMonth = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return dailyStats.filter(s => {
      const d = parseISO(s.date);
      return isWithinInterval(d, { start, end });
    }).reduce((acc, curr) => ({
      approvedIncome: acc.approvedIncome + curr.approvedIncome,
      pendingIncome: acc.pendingIncome + curr.pendingIncome,
      conversions: acc.conversions + curr.conversions,
      clicks: acc.clicks + curr.clicks,
    }), { approvedIncome: 0, pendingIncome: 0, conversions: 0, clicks: 0 });
  }, [dailyStats]);

  const chartData = useMemo(() => {
    // Mock hourly data based on daily stats for visualization
    // In a real app, this would be another collection or more granular data
    return Array.from({ length: 24 }).map((_, i) => ({
      time: `${i.toString().padStart(2, '0')}:00`,
      clicks: Math.floor(statsToday.clicks / 24 * (0.5 + Math.random())),
      conversions: Math.floor(statsToday.conversions / 24 * (0.5 + Math.random())),
      payout: Number((statsToday.approvedIncome / 24 * (0.5 + Math.random())).toFixed(2)),
    }));
  }, [statsToday]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const seedData = async () => {
    if (userProfile?.role !== 'admin') return;
    
    const dates = Array.from({ length: 7 }).map((_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'));
    
    for (const date of dates) {
      const mockData: DailyStats = {
        date,
        approvedIncome: Math.floor(Math.random() * 1000),
        pendingIncome: Math.floor(Math.random() * 500),
        conversions: Math.floor(Math.random() * 50),
        clicks: Math.floor(Math.random() * 500),
        lastUpdated: serverTimestamp()
      };
      await setDoc(doc(db, 'daily_stats', date), mockData);
    }
    alert("Seed data created!");
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <LayoutDashboard className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-500 mb-8">Sign in to access your real-time performance data and historical records.</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        "bg-[#2c3e50] text-gray-300 transition-all duration-300 flex flex-col fixed h-full z-50",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        <div className="p-4 flex items-center gap-3 border-b border-gray-700">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center text-white font-bold shrink-0">
            L
          </div>
          {sidebarOpen && <span className="font-bold text-white tracking-wider">LOGO</span>}
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'offers', icon: Tag, label: 'Offers' },
            { id: 'history', icon: History, label: 'History' },
            { id: 'settings', icon: Settings, label: 'Settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-700/50",
                activeTab === item.id && "bg-blue-600 text-white hover:bg-blue-600"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-2 py-2 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        sidebarOpen ? "ml-64" : "ml-16"
      )}>
        {/* Header */}
        <header className="bg-[#f39c12] text-white h-16 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-white/10 rounded">
              <Menu className="w-6 h-6" />
            </button>
            <button className="p-1 hover:bg-white/10 rounded">
              <Maximize className="w-5 h-5" />
            </button>
            <div className="hidden md:flex flex-col text-xs font-medium">
              <span className="opacity-80">CURRENT PANEL TIME:</span>
              <span>{format(new Date(), 'EEEE, MMMM d, yyyy @ HH:mm:ss')} UTC +00:00</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <img src="https://flagcdn.com/us.svg" className="w-6 h-4 rounded-sm" alt="US" />
              <div className="relative">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/30 overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} className="w-full h-full object-cover" alt="Profile" />
                  ) : (
                    <UserIcon className="w-6 h-6" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-[#f39c12] rounded-full" />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-6 max-w-[1600px] mx-auto">
          {activeTab === 'dashboard' ? (
            <div className="space-y-6">
              {/* Top Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card title="Today">
                  <div className="grid grid-cols-2 gap-4">
                    <StatItem label="Approved Income" value={`$ ${statsToday.approvedIncome.toFixed(2)}`} />
                    <StatItem label="Pending Income" value={`$ ${statsToday.pendingIncome.toFixed(2)}`} />
                  </div>
                </Card>
                <Card title="Yesterday">
                  <div className="grid grid-cols-2 gap-4">
                    <StatItem label="Approved Income" value={`$ ${statsYesterday.approvedIncome.toFixed(2)}`} />
                    <StatItem label="Pending Income" value={`$ ${statsYesterday.pendingIncome.toFixed(2)}`} />
                  </div>
                </Card>
                <Card title="Month">
                  <div className="grid grid-cols-2 gap-4">
                    <StatItem label="Approved Income" value={`$ ${statsMonth.approvedIncome.toFixed(2)}`} />
                    <StatItem label="Pending Income" value={`$ ${statsMonth.pendingIncome.toFixed(2)}`} />
                  </div>
                </Card>
              </div>

              {/* Main Chart Section */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <h2 className="text-lg font-semibold text-gray-800">Summary</h2>
                      <select 
                        value={selectedRange}
                        onChange={(e) => setSelectedRange(e.target.value as any)}
                        className="bg-gray-50 border border-gray-200 rounded px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="month">Month</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium text-gray-400">
                      <button className="hover:text-gray-600"><RefreshCw className="w-4 h-4" /></button>
                      <button className="hover:text-gray-600"><Maximize className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10 text-center">
                    <div>
                      <p className="text-red-500 text-sm mb-1">Approved Income</p>
                      <p className="text-2xl font-bold text-red-500">$ {statsToday.approvedIncome.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-yellow-500 text-sm mb-1">Pending Income</p>
                      <p className="text-2xl font-bold text-yellow-500">$ {statsToday.pendingIncome.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-green-500 text-sm mb-1">Conversions</p>
                      <p className="text-2xl font-bold text-green-500">{statsToday.conversions}</p>
                    </div>
                    <div>
                      <p className="text-blue-500 text-sm mb-1">Clicks</p>
                      <p className="text-2xl font-bold text-blue-500">{statsToday.clicks}</p>
                    </div>
                  </div>

                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="time" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                          interval={2}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="top" align="center" iconType="rect" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} />
                        <Area type="monotone" dataKey="clicks" stroke="#3b82f6" fillOpacity={1} fill="url(#colorClicks)" strokeWidth={2} />
                        <Area type="monotone" dataKey="conversions" stroke="#10b981" fillOpacity={1} fill="url(#colorConversions)" strokeWidth={2} />
                        <Area type="monotone" dataKey="payout" stroke="#ec4899" fillOpacity={0} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Right Profile Cards */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg p-6 text-white text-center shadow-md">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/30 overflow-hidden">
                      {user.photoURL ? (
                        <img src={user.photoURL} className="w-full h-full object-cover" alt="Profile" />
                      ) : (
                        <UserIcon className="w-10 h-10" />
                      )}
                    </div>
                    <h3 className="font-bold text-lg mb-1">{user.email}</h3>
                    <div className="flex items-center justify-center gap-2 text-sm opacity-90">
                      <UserIcon className="w-4 h-4" />
                      <span>{userProfile?.role || 'publisher'}</span>
                    </div>
                    <div className="mt-2 text-xs opacity-75 flex items-center justify-center gap-1">
                      <Info className="w-3 h-3" />
                      <span>Not Mentioned</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500 to-pink-400 rounded-lg p-6 text-white text-center shadow-md">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/30 overflow-hidden">
                      <UserIcon className="w-10 h-10" />
                    </div>
                    <h3 className="font-bold text-lg mb-1">Manager</h3>
                    <p className="text-sm opacity-90 mb-2">erqiang</p>
                    <div className="text-xs opacity-75 space-y-1">
                      <p>@ heatherann_w@hotmail.com</p>
                      <p className="flex items-center justify-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        live:.cid.83138053aeeb3f0a
                      </p>
                    </div>
                  </div>

                  {userProfile?.role === 'admin' && (
                    <button 
                      onClick={seedData}
                      className="w-full bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Seed Mock Data
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'offers' ? (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-white mb-4">All Offers</h1>
              
              {/* Filters Section */}
              <div className="bg-white rounded shadow-sm p-4 text-gray-700">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
                  <span className="text-sm font-bold flex items-center gap-2">
                    <Filter className="w-4 h-4" /> Filters
                  </span>
                  <div className="flex gap-2">
                    <button className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs text-gray-400 self-center">Active Filters :</span>
                  <div className="bg-orange-500 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1">
                    Sort by Column : createdtimestr <X className="w-3 h-3 cursor-pointer" />
                  </div>
                  <div className="bg-orange-500 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1">
                    Sort Order : desc <X className="w-3 h-3 cursor-pointer" />
                  </div>
                  <div className="bg-orange-500 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1">
                    Status : active <X className="w-3 h-3 cursor-pointer" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold">Offer Name</label>
                    <input 
                      type="text" 
                      value={filterValues.name}
                      onChange={(e) => setFilterValues({...filterValues, name: e.target.value})}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-blue-500" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold">Offer ID</label>
                    <input 
                      type="text" 
                      value={filterValues.id}
                      onChange={(e) => setFilterValues({...filterValues, id: e.target.value})}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-blue-500" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold">Incent Allowed</label>
                    <select className="w-full border border-gray-200 rounded px-2 py-1 text-sm outline-none bg-white">
                      <option>Any</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold">Stream Type</label>
                    <select className="w-full border border-gray-200 rounded px-2 py-1 text-sm outline-none bg-white">
                      <option>Any</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold">Status</label>
                    <select className="w-full border border-gray-200 rounded px-2 py-1 text-sm outline-none bg-white">
                      <option>Active</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold">Category</label>
                    <input type="text" className="w-full border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="bg-blue-500 text-white text-xs px-4 py-2 rounded font-bold hover:bg-blue-600 transition-colors">Show More Filters +</button>
                  <button 
                    onClick={handleApplyFilter}
                    className="bg-[#34495e] text-white text-xs px-4 py-2 rounded font-bold hover:bg-[#2c3e50] transition-colors"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-4 py-2">
                <div className="flex rounded overflow-hidden border border-gray-200">
                  <button 
                    onClick={() => setViewMode('table')}
                    className={cn("px-4 py-1 text-[10px] font-bold", viewMode === 'table' ? "bg-green-500 text-white" : "bg-white text-gray-400")}
                  >
                    TABLE
                  </button>
                  <button 
                    onClick={() => setViewMode('cards')}
                    className={cn("px-4 py-1 text-[10px] font-bold", viewMode === 'cards' ? "bg-red-500 text-white" : "bg-white text-gray-400")}
                  >
                    CARDS
                  </button>
                </div>

                <div className="flex gap-1">
                  {[
                    { icon: LayoutDashboard, label: 'Columns' },
                    { icon: Download, label: 'Export' },
                    { icon: RotateCcw, label: 'Refresh' },
                    { icon: Database, label: 'Cache' },
                    { icon: Maximize, label: 'Expand' },
                  ].map((btn, i) => (
                    <button key={i} className="bg-[#4ebcd5] text-white px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-[#3da9c2]">
                      <btn.icon className="w-3 h-3" /> {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {paginatedOffers.map(offer => (
                  <motion.div 
                    key={offer.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setSelectedOffer(offer)}
                    className="bg-white rounded shadow-sm border border-gray-100 overflow-hidden relative flex flex-col items-center p-4 text-center group cursor-pointer hover:shadow-md transition-shadow"
                  >
                    {/* Available Ribbon */}
                    <div className="absolute top-0 right-0">
                      <div className="bg-[#333] text-white text-[10px] px-3 py-1 rounded-bl-lg font-bold">
                        {offer.needApproval ? "Need Approval" : "Available"}
                      </div>
                    </div>

                    {/* Best Offer Badge */}
                    <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex flex-col items-center justify-center text-white shadow-lg mb-4 mt-4 relative">
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full" />
                      <span className="text-[10px] font-bold tracking-tighter">BEST</span>
                      <span className="text-lg font-black leading-none">OFFER</span>
                    </div>

                    <h4 className="text-[11px] text-gray-500 font-medium mb-2 line-clamp-3 h-12">
                      {offer.name}
                    </h4>
                    
                    <p className="text-xl font-black text-gray-800 mb-1">
                      ${offer.payout.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold mb-4">
                      ID: {offer.id}
                    </p>

                    <button className={cn(
                      "w-full py-2 rounded text-white text-[10px] font-bold mb-4 transition-all active:scale-95",
                      offer.needApproval ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-500 hover:bg-blue-600"
                    )}>
                      {offer.needApproval ? "Request Approval" : "Get Offer Link"}
                    </button>

                    <div className="flex gap-1 mt-auto">
                      {offer.countries.map(c => (
                        <img key={c} src={`https://flagcdn.com/${c}.svg`} className="w-4 h-3 rounded-sm shadow-sm" alt={c} />
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-2 py-8">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 bg-white border border-gray-200 rounded-full disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-gray-500">
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 bg-white border border-gray-200 rounded-full disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : activeTab === 'history' ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Historical Records</h2>
                <div className="flex items-center gap-2">
                  <button className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors">Export CSV</button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600">Date</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600">Approved Income</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600">Pending Income</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600">Conversions</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600">Clicks</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600">CR (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyStats.length > 0 ? dailyStats.map((stat) => (
                      <tr key={stat.date} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4 text-sm text-gray-700">{stat.date}</td>
                        <td className="px-4 py-4 text-sm font-medium text-green-600">$ {stat.approvedIncome.toFixed(2)}</td>
                        <td className="px-4 py-4 text-sm text-yellow-600">$ {stat.pendingIncome.toFixed(2)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{stat.conversions}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{stat.clicks}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {stat.clicks > 0 ? ((stat.conversions / stat.clicks) * 100).toFixed(2) : '0.00'}%
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400 italic">No historical data found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
              <Settings className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Settings</h2>
              <p className="text-gray-500">Settings panel is under development.</p>
            </div>
          )}
        </div>
      </main>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-[200] flex items-center gap-3 px-6 py-3 bg-white rounded-lg shadow-2xl border border-gray-100 min-w-[320px]"
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <p className="text-sm font-medium text-gray-700">{notification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offer Details Modal */}
      <AnimatePresence>
        {selectedOffer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-medium text-gray-800">
                  Details of Offer ID : <span className="font-bold">{selectedOffer.id}</span>
                </h2>
                <button 
                  onClick={() => {
                    setSelectedOffer(null);
                    setActiveModalTab('Basic');
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-6 pt-4 flex gap-4 border-b border-gray-50">
                {['Basic', 'Description', 'Tracking', 'Creatives'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveModalTab(tab)}
                    className={cn(
                      "px-6 py-2 text-sm font-medium transition-all rounded-t-lg",
                      activeModalTab === tab ? "bg-[#6c5ce7] text-white shadow-lg" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-8">
                {activeModalTab === 'Basic' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-2">
                    {/* Left Column */}
                    <div className="space-y-0 text-sm">
                      {[
                        { label: 'Offer ID', value: selectedOffer.id },
                        { label: 'Name', value: selectedOffer.name },
                        { label: 'Payout to Affiliate', value: `$${selectedOffer.payout.toFixed(2)}` },
                        { label: 'Status', value: (
                          <span className={cn(
                            "text-white text-[10px] font-bold px-2 py-0.5 rounded",
                            selectedOffer.needApproval ? "bg-orange-500" : "bg-[#2ecc71]"
                          )}>
                            {selectedOffer.needApproval ? "PENDING" : "ACTIVE"}
                          </span>
                        ) },
                        { label: 'Offer Type', value: <span className="bg-[#9b59b6] text-white text-[10px] font-bold px-2 py-0.5 rounded">CPA</span> },
                        { label: 'Allowed Countries', value: (
                          <div className="flex gap-1">
                            {selectedOffer.countries.map((c: string) => (
                              <span key={c} className="bg-[#3498db] text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">{c}</span>
                            ))}
                          </div>
                        )},
                        { label: 'Restricted Countries', value: '' },
                        { label: 'Device', value: <span className="bg-[#1abc9c] text-white text-[10px] font-bold px-2 py-0.5 rounded">ALL</span> },
                        { label: 'Platforms', value: <span className="bg-[#1abc9c] text-white text-[10px] font-bold px-2 py-0.5 rounded">ALL</span> },
                        { label: 'StreamType', value: '' },
                        { label: 'Incetive Allowed', value: '' },
                      ].map((item, i) => (
                        <div key={i} className="grid grid-cols-3 py-3 border-b border-gray-50 items-center">
                          <span className="text-gray-500 font-medium">{item.label}</span>
                          <div className="col-span-2 text-gray-700">{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-0 text-sm">
                      {[
                        { label: 'Category', value: selectedOffer.category },
                        { label: 'Tags', value: '' },
                        { label: 'Creation Time', value: <span className="bg-[#34495e] text-white text-[10px] font-mono px-2 py-1 rounded">{selectedOffer.createdAt}</span> },
                        { label: 'Update Time', value: <span className="bg-[#34495e] text-white text-[10px] font-mono px-2 py-1 rounded">{selectedOffer.updatedAt}</span> },
                      ].map((item, i) => (
                        <div key={i} className="grid grid-cols-3 py-3 border-b border-gray-50 items-center">
                          <span className="text-gray-500 font-medium">{item.label}</span>
                          <div className="col-span-2 text-gray-700">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : activeModalTab === 'Tracking' ? (
                  <div className="space-y-8">
                    {selectedOffer.needApproval ? (
                      <div className="bg-orange-50 border border-orange-100 rounded-lg p-12 text-center">
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Info className="w-8 h-8 text-orange-500" />
                        </div>
                        <h4 className="text-orange-800 font-bold text-lg mb-2">Approval Required</h4>
                        <p className="text-orange-600 text-sm max-w-md mx-auto leading-relaxed">
                          This offer requires manual approval. Your unique tracking link will be displayed here once your request has been reviewed and approved by our team.
                        </p>
                        <button 
                          onClick={() => showNotification("Application submitted successfully! Our team will review it shortly.", "success")}
                          className="mt-6 bg-orange-500 hover:bg-orange-600 text-white px-8 py-2 rounded font-bold text-sm transition-all shadow-md active:scale-95"
                        >
                          Apply for this Offer
                        </button>
                      </div>
                    ) : (
                      <div className="bg-[#24a0bd] rounded p-6 relative">
                        <h4 className="text-white font-bold text-sm mb-3">Default Affiliate Link :</h4>
                        <div className="bg-white/95 rounded p-3 text-gray-600 text-sm break-all font-mono">
                          http://dealeraff.a1.arcanetechs.com/go.php?oid={selectedOffer.id}&pid=q943&sub1={"{clickid}"}
                        </div>
                        <div className="flex justify-end mt-2">
                          <button 
                            onClick={() => {
                              const link = `http://dealeraff.a1.arcanetechs.com/go.php?oid=${selectedOffer.id}&pid=q943&sub1={clickid}`;
                              navigator.clipboard.writeText(link);
                            }}
                            className="bg-gray-200/80 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Parameters Table */}
                    <div>
                      <h4 className="text-[#6c5ce7] font-bold text-sm mb-4 border-b border-gray-100 pb-2">
                        Available Tracking Parameters/Macros :
                      </h4>
                      <div className="space-y-0 text-[11px]">
                        {[
                          { name: 'sub1', desc: 'Macro for sending your 1st Variable example : ClickId / TransactionID' },
                          { name: 'sub2', desc: 'Macro for sending your 2nd Variable example : PubId / Source' },
                          { name: 'sub3', desc: 'Macro for sending your 3rd Variable' },
                          { name: 'sub4', desc: 'Macro for sending your 4th Variable' },
                          { name: 'droidid', desc: 'Macro for sending androidID' },
                          { name: 'gaid', desc: 'Macro for sending Google Advertising ID' },
                          { name: 'idfa', desc: 'Macro for sending your Iphone ID' },
                        ].map((param, i) => (
                          <div key={i} className="grid grid-cols-6 py-2 border-b border-gray-50 hover:bg-gray-50/50 px-2">
                            <span className="text-gray-500 font-medium">{param.name}</span>
                            <span className="col-span-5 text-gray-400">{param.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : activeModalTab === 'Description' ? (
                  <div className="space-y-4">
                    <h3 className="text-[#6c5ce7] font-bold text-lg">Description</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {selectedOffer.name}
                    </p>
                  </div>
                ) : (
                  <div className="py-12 text-center text-gray-400 italic">
                    {activeModalTab} content is currently empty.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => {
                    setSelectedOffer(null);
                    setActiveModalTab('Basic');
                  }}
                  className="bg-[#6c5ce7] hover:bg-[#5b4bc4] text-white px-8 py-2 rounded text-sm font-medium transition-colors shadow-lg"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
