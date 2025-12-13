'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
    const pathname = usePathname();
    const { user, setUser, isAuthenticated } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const checkAuth = async () => {
        try {
          // 토큰 확인
          const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
          
          if (!token) {
            // 현재 URL을 쿼리 파라미터로 전달하여 로그인 후 복귀
            const returnUrl = encodeURIComponent(pathname || '/admin/dashboard');
            router.push(`/admin/login?returnUrl=${returnUrl}`);
            setIsLoading(false);
            return;
          }

          // 사용자 정보 조회
          const userInfo = await getCurrentUser();
          
          // 관리자/직원 권한 확인
          if (userInfo.role !== 'admin' && userInfo.role !== 'staff') {
            console.error('권한이 없습니다:', userInfo.role);
            // 현재 URL을 쿼리 파라미터로 전달
            const returnUrl = encodeURIComponent(pathname || '/admin/dashboard');
            router.push(`/admin/login?returnUrl=${returnUrl}`);
            setIsLoading(false);
            return;
          }

          setUser(userInfo);
        } catch (error: any) {
          console.error('인증 확인 실패:', error);
          // 토큰 제거
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
          }
          // 현재 URL을 쿼리 파라미터로 전달
          const returnUrl = encodeURIComponent(pathname || '/admin/dashboard');
          router.push(`/admin/login?returnUrl=${returnUrl}`);
        } finally {
          setIsLoading(false);
        }
      };

      checkAuth();
    }, [router, pathname, setUser]);

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

