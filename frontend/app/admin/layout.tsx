'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { getCurrentUser } from '@/lib/api/auth';

function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const checkAuth = async () => {
      // 이미 인증된 사용자가 있고 토큰이 있으면 재확인 생략
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      
      if (isAuthenticated && user && user.role && (user.role === 'admin' || user.role === 'staff') && token) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      // 타임아웃 설정 (최대 5초 대기)
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.error('인증 확인 타임아웃');
          setIsLoading(false);
          if (!token) {
            router.push('/login');
          }
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
        
        if (!isMounted) {
          return;
        }
        
        if (userInfo.role !== 'admin' && userInfo.role !== 'staff') {
          console.error('권한이 없습니다:', userInfo.role);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
          }
          setIsLoading(false);
          router.push('/login');
          return;
        }

        setUser(userInfo);
        setIsLoading(false);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('인증 확인 실패:', error);
        
        // 토큰 제거
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
        }
        
        if (isMounted) {
          setIsLoading(false);
          // 인터셉터에서 이미 리다이렉트했을 수 있으므로 확인
          if (window.location.pathname !== '/login') {
            router.push('/login');
          }
        }
      }
    };

    checkAuth();
    
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [router, setUser, isAuthenticated, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">니어카 관리자</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link 
                  href="/admin/dashboard" 
                  className={`${
                    pathname === '/admin/dashboard'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  대시보드
                </Link>
                <Link 
                  href="/admin/inspections" 
                  className={`${
                    pathname?.startsWith('/admin/inspections')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  신청 관리
                </Link>
                <Link 
                  href="/admin/reports" 
                  className={`${
                    pathname?.startsWith('/admin/reports')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  레포트 검수
                </Link>
                <Link 
                  href="/admin/packages" 
                  className={`${
                    pathname?.startsWith('/admin/packages')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  패키지 관리
                </Link>
                <Link 
                  href="/admin/prices" 
                  className={`${
                    pathname?.startsWith('/admin/prices')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  가격 관리
                </Link>
                <Link 
                  href="/admin/regions" 
                  className={`${
                    pathname?.startsWith('/admin/regions')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  서비스 지역 관리
                </Link>
                <Link 
                  href="/admin/vehicles" 
                  className={`${
                    pathname?.startsWith('/admin/vehicles')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  차량 관리
                </Link>
                <Link 
                  href="/admin/users" 
                  className={`${
                    pathname?.startsWith('/admin/users')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  유저 관리
                </Link>
                <Link 
                  href="/admin/settlements" 
                  className={`${
                    pathname?.startsWith('/admin/settlements')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  정산 관리
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-700 mr-4">{user.name}님</span>
              <button
                onClick={async () => {
                  await import('@/lib/api/auth').then(m => m.logout());
                  router.push('/login');
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export default AdminLayout;

