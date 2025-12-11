'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { getCurrentUser, logout } from '@/lib/api/auth';
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Package,
  Tag,
  Map,
  Car,
  Users,
  CreditCard,
  Star,
  HelpCircle,
  LogOut,
  Menu,
  X
} from 'lucide-react';

function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

      if (isAuthenticated && user && user.role && (user.role === 'admin' || user.role === 'staff') && token) {
        if (isMounted) setIsLoading(false);
        return;
      }

      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.error('인증 확인 타임아웃');
          setIsLoading(false);
          if (!token) router.push('/login');
        }
      }, 5000);

      try {
        if (!token) {
          clearTimeout(timeoutId);
          if (isMounted) {
            setIsLoading(false);
            router.push('/login');
          }
          return;
        }

        const userInfo = await getCurrentUser();
        clearTimeout(timeoutId);

        if (!isMounted) return;

        if (userInfo.role !== 'admin' && userInfo.role !== 'staff') {
          console.error('권한이 없습니다:', userInfo.role);
          if (typeof window !== 'undefined') localStorage.removeItem('access_token');
          setIsLoading(false);
          router.push('/login');
          return;
        }

        setUser(userInfo);
        setIsLoading(false);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('인증 확인 실패:', error);
        if (typeof window !== 'undefined') localStorage.removeItem('access_token');
        if (isMounted) {
          setIsLoading(false);
          if (window.location.pathname !== '/login') router.push('/login');
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [router, setUser, isAuthenticated, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-lg font-medium text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (!user) return null;

  const navigation = [
    { name: '대시보드', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: '신청 관리', href: '/admin/inspections', icon: FileText },
    { name: '레포트 검수', href: '/admin/reports', icon: ClipboardCheck },
    { name: '패키지 관리', href: '/admin/packages', icon: Package },
    { name: '가격 관리', href: '/admin/prices', icon: Tag },
    { name: '서비스 지역', href: '/admin/regions', icon: Map },
    { name: '차량 관리', href: '/admin/vehicles', icon: Car },
    { name: '유저 관리', href: '/admin/users', icon: Users },
    { name: '정산 관리', href: '/admin/settlements', icon: CreditCard },
    { name: '리뷰 관리', href: '/admin/reviews', icon: Star },
    { name: 'FAQ 관리', href: '/admin/faqs', icon: HelpCircle },
  ];

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const NavLink = ({ item }: { item: typeof navigation[0] }) => {
    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
    return (
      <Link
        href={item.href}
        className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 transition-colors ${isActive
            ? 'bg-indigo-50 text-indigo-600'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
          }`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <item.icon
          className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'
            }`}
        />
        {item.name}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 bg-indigo-600">
            <h1 className="text-xl font-bold text-white">니어카 관리자</h1>
            <button
              className="ml-auto md:hidden text-white"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 flex flex-col overflow-y-auto px-3 py-4">
            <nav className="flex-1 space-y-1">
              {navigation.map((item) => (
                <NavLink key={item.name} item={item} />
              ))}
            </nav>
          </div>

          {/* User Profile & Logout */}
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                  {user.name?.[0] || 'A'}
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">{user.name}</p>
                <p className="text-xs text-gray-500 truncate max-w-[150px]">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 border-gray-300 shadow-sm transition-colors"
            >
              <LogOut className="mr-2 h-4 w-4 text-gray-500" />
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden bg-white shadow-sm h-16 flex items-center px-4 border-b border-gray-200">
          <button
            type="button"
            className="-ml-2 mr-2 p-2 rounded-md text-gray-500 hover:text-gray-900 focus:outline-none"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="text-lg font-bold text-gray-900">
            {navigation.find(item => pathname?.startsWith(item.href))?.name || '관리자 페이지'}
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;

