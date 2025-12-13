'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login } from '@/lib/api/auth';
import { useAuthStore } from '@/stores/authStore';

export default function InspectorLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 로그인 후 돌아갈 URL 확인
  const returnUrl = searchParams?.get('returnUrl') || '/inspector/dashboard';

  useEffect(() => {
    // 이미 로그인된 경우 대시보드로 리다이렉트
    const checkAuth = async () => {
      try {
        const { getCurrentUser } = await import('@/lib/api/auth');
        const userInfo = await getCurrentUser();
        if (userInfo && userInfo.role === 'inspector') {
          router.push(returnUrl);
        }
      } catch (err) {
        // 인증되지 않은 경우 로그인 페이지 유지
      }
    };
    checkAuth();
  }, [router, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ email, password });

      // 사용자 정보 가져오기
      try {
        const { getCurrentUser } = await import('@/lib/api/auth');
        const userInfo = await getCurrentUser();
        
        // 기사 역할 확인
        if (userInfo.role !== 'inspector') {
          setError('기사 계정으로 로그인해주세요.');
          // 로그아웃 처리
          const { logout } = await import('@/lib/api/auth');
          await logout();
          return;
        }
        
        setUser(userInfo);
        router.push(returnUrl);
      } catch (userErr) {
        console.error('사용자 정보 조회 실패:', userErr);
        // 사용자 정보 조회 실패해도 로그인은 성공했으므로 진행
        router.push(returnUrl);
      }
    } catch (err: any) {
      console.error('로그인 실패:', err);
      setError(err.response?.data?.detail || err.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            기사 로그인
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            NearCar 진단 기사 전용 로그인
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              기사 계정이 필요하신가요? 관리자에게 문의해주세요.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

