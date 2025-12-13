'use client';

import Link from 'next/link';

export default function CustomerFooter() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-white font-bold text-lg mb-4">NearCar</h3>
            <p className="text-sm">
              중고차 구매 전 전문 진단 서비스
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">서비스</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/service" className="hover:text-white">서비스 소개</Link></li>
              <li><Link href="/pricing" className="hover:text-white">이용 요금</Link></li>
              <li><Link href="/reviews" className="hover:text-white">고객 후기</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">고객지원</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/faq" className="hover:text-white">자주 묻는 질문</Link></li>
              <li><Link href="/apply/vehicle" className="hover:text-white">진단 신청</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">계정</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/login" className="hover:text-white">로그인</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
          <p>&copy; 2024 NearCar. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

