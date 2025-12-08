'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { getCurrentUser } from '@/lib/api/auth';

interface WithAdminAuthProps {
  children: React.ReactNode;
}

export default function withAdminAuth<P extends object>(
  Component: React.ComponentType<P>
) {
  return function AuthenticatedComponent(props: P) {
    const router = useRouter();
    const { user, setUser, isAuthenticated } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const checkAuth = async () => {
        try {
          // 토큰 확인
          const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
          
          if (!token) {
            router.push('/login');
            return;
          }

          // 사용자 정보 조회
          const userInfo = await getCurrentUser();
          
          // 관리자/직원 권한 확인
          if (userInfo.role !== 'admin' && userInfo.role !== 'staff') {
            router.push('/login');
            return;
          }

          setUser(userInfo);
        } catch (error) {
          console.error('인증 확인 실패:', error);
          router.push('/login');
        } finally {
          setIsLoading(false);
        }
      };

      checkAuth();
    }, [router, setUser]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">로딩 중...</div>
        </div>
      );
    }

    if (!isAuthenticated || !user) {
      return null;
    }

    return <Component {...props} />;
  };
}

