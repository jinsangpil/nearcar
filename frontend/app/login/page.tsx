'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, register } from '@/lib/api/auth';
import { useAuthStore } from '@/stores/authStore';

type TabType = 'login' | 'register' | 'find';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('login');
  
  // 로그인 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 회원가입 상태
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    passwordConfirm: '',
  });
  const [registerError, setRegisterError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // 아이디/비밀번호 찾기 상태
  const [findType, setFindType] = useState<'email' | 'password'>('email');
  const [findData, setFindData] = useState({
    email: '',
    phone: '',
  });
  const [findError, setFindError] = useState('');
  const [isFinding, setIsFinding] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ email, password });

      try {
        const userInfo = await import('@/lib/api/auth').then(m => m.getCurrentUser());
        setUser(userInfo);
        
        // 역할에 따라 리다이렉트
        if (userInfo.role === 'admin' || userInfo.role === 'staff') {
          router.push('/admin/dashboard');
        } else if (userInfo.role === 'inspector') {
          router.push('/inspector/dashboard');
        } else {
          // 고객은 신청 플로우나 메인으로
          router.push('/');
        }
      } catch (userErr) {
        console.error('사용자 정보 조회 실패:', userErr);
        router.push('/');
      }
    } catch (err: any) {
      console.error('로그인 실패:', err);
      setError(err.response?.data?.detail || err.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');

    // 비밀번호 확인
    if (registerData.password !== registerData.passwordConfirm) {
      setRegisterError('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 비밀번호 길이 확인
    if (registerData.password.length < 8) {
      setRegisterError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setIsRegistering(true);

    try {
      // 고객용 회원가입 API 사용
      await register({
        name: registerData.name,
        email: registerData.email,
        phone: registerData.phone,
        password: registerData.password,
      });
      
      // 사용자 정보 가져오기
      try {
        const userInfo = await import('@/lib/api/auth').then(m => m.getCurrentUser());
        setUser(userInfo);
        router.push('/');
      } catch (userErr) {
        console.error('사용자 정보 조회 실패:', userErr);
        // 사용자 정보 조회 실패해도 회원가입은 성공했으므로 진행
        router.push('/');
      }
    } catch (err: any) {
      console.error('회원가입 실패:', err);
      setRegisterError(err.response?.data?.detail || err.message || '회원가입에 실패했습니다.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleFind = async (e: React.FormEvent) => {
    e.preventDefault();
    setFindError('');
    setIsFinding(true);

    try {
      // TODO: 아이디/비밀번호 찾기 API 구현 필요
      setFindError('아이디/비밀번호 찾기 기능은 준비 중입니다.');
    } catch (err: any) {
      console.error('찾기 실패:', err);
      setFindError(err.response?.data?.detail || err.message || '처리 중 오류가 발생했습니다.');
    } finally {
      setIsFinding(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            NearCar 로그인
          </h2>
        </div>

        {/* 탭 메뉴 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 px-4 text-center font-medium ${
              activeTab === 'login'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2 px-4 text-center font-medium ${
              activeTab === 'register'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            회원가입
          </button>
          <button
            onClick={() => setActiveTab('find')}
            className={`flex-1 py-2 px-4 text-center font-medium ${
              activeTab === 'find'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            찾기
          </button>
        </div>

        {/* 로그인 폼 */}
        {activeTab === 'login' && (
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
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
          </form>
        )}

        {/* 회원가입 폼 */}
        {activeTab === 'register' && (
          <form className="mt-8 space-y-6" onSubmit={handleRegister}>
            {registerError && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-800">{registerError}</div>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  이름
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="이름을 입력하세요"
                  value={registerData.name}
                  onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                  disabled={isRegistering}
                />
              </div>
              <div>
                <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="이메일을 입력하세요"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  disabled={isRegistering}
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  휴대폰 번호
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="010-1234-5678"
                  value={registerData.phone}
                  onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                  disabled={isRegistering}
                />
              </div>
              <div>
                <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호
                </label>
                <input
                  id="register-password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="8자 이상 입력하세요"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  disabled={isRegistering}
                />
              </div>
              <div>
                <label htmlFor="password-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호 확인
                </label>
                <input
                  id="password-confirm"
                  name="passwordConfirm"
                  type="password"
                  required
                  minLength={8}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={registerData.passwordConfirm}
                  onChange={(e) => setRegisterData({ ...registerData, passwordConfirm: e.target.value })}
                  disabled={isRegistering}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isRegistering}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegistering ? '가입 중...' : '회원가입'}
              </button>
            </div>
          </form>
        )}

        {/* 아이디/비밀번호 찾기 폼 */}
        {activeTab === 'find' && (
          <form className="mt-8 space-y-6" onSubmit={handleFind}>
            {findError && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-800">{findError}</div>
              </div>
            )}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                type="button"
                onClick={() => setFindType('email')}
                className={`flex-1 py-2 text-center text-sm font-medium ${
                  findType === 'email'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                이메일 찾기
              </button>
              <button
                type="button"
                onClick={() => setFindType('password')}
                className={`flex-1 py-2 text-center text-sm font-medium ${
                  findType === 'password'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                비밀번호 찾기
              </button>
            </div>
            <div className="space-y-4">
              {findType === 'email' ? (
                <div>
                  <label htmlFor="find-phone" className="block text-sm font-medium text-gray-700 mb-1">
                    휴대폰 번호
                  </label>
                  <input
                    id="find-phone"
                    name="phone"
                    type="tel"
                    required
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="010-1234-5678"
                    value={findData.phone}
                    onChange={(e) => setFindData({ ...findData, phone: e.target.value })}
                    disabled={isFinding}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="find-email" className="block text-sm font-medium text-gray-700 mb-1">
                      이메일
                    </label>
                    <input
                      id="find-email"
                      name="email"
                      type="email"
                      required
                      className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="이메일을 입력하세요"
                      value={findData.email}
                      onChange={(e) => setFindData({ ...findData, email: e.target.value })}
                      disabled={isFinding}
                    />
                  </div>
                  <div>
                    <label htmlFor="find-phone-pw" className="block text-sm font-medium text-gray-700 mb-1">
                      휴대폰 번호
                    </label>
                    <input
                      id="find-phone-pw"
                      name="phone"
                      type="tel"
                      required
                      className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="010-1234-5678"
                      value={findData.phone}
                      onChange={(e) => setFindData({ ...findData, phone: e.target.value })}
                      disabled={isFinding}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isFinding}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFinding ? '처리 중...' : findType === 'email' ? '이메일 찾기' : '비밀번호 찾기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
