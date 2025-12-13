'use client';

import Link from 'next/link';
import CustomerNavbar from '@/components/customer/CustomerNavbar';
import CustomerFooter from '@/components/customer/CustomerFooter';

const DIAGNOSIS_SECTIONS = [
  {
    name: '외관',
    description: '차량 외부 상태를 꼼꼼히 점검합니다',
    items: [
      '앞/뒤 범퍼 상태',
      '헤드라이트 및 테일라이트',
      '앞/뒤 유리 및 사이드 미러',
      '도어 개폐 상태',
      '타이어 마모도 및 상태',
    ],
    icon: '🚗',
  },
  {
    name: '엔진룸',
    description: '엔진 및 주요 부품 상태를 확인합니다',
    items: [
      '엔진 오일 상태',
      '냉각수 및 브레이크 오일',
      '배터리 상태',
      '벨트 및 호스 점검',
    ],
    icon: '⚙️',
  },
  {
    name: '하부',
    description: '차량 하부 구조를 전문적으로 점검합니다',
    items: [
      '하부 손상 여부',
      '배기계 상태',
      '서스펜션 점검',
      '변속기 상태',
    ],
    icon: '🔧',
  },
  {
    name: '실내',
    description: '실내 상태 및 편의 기능을 확인합니다',
    items: [
      '대시보드 및 시트 상태',
      '에어컨 작동 여부',
      '오디오 시스템',
      '실내등 점검',
    ],
    icon: '🪑',
  },
  {
    name: '전장품',
    description: '전기/전자 시스템을 종합적으로 점검합니다',
    items: [
      '전기 시스템 점검',
      '조명 시스템',
      '센서 및 계기판',
      '기타 전자 장치',
    ],
    icon: '⚡',
  },
];

const INSPECTOR_VERIFICATION = [
  {
    title: '엄격한 검증 과정',
    description: '전문 자격과 경력을 갖춘 기사만 선발합니다',
  },
  {
    title: '등급별 관리',
    description: '1~5등급 체계로 기사 역량을 관리합니다',
  },
  {
    title: '수수료율 투명화',
    description: '공정한 수수료율로 기사와 고객 모두 만족합니다',
  },
  {
    title: '활동 지역 관리',
    description: '지역별 전문 기사를 배정하여 빠른 서비스를 제공합니다',
  },
];

const SERVICE_STEPS = [
  {
    step: 1,
    title: '차량 정보 입력',
    description: '차량번호 또는 제조사/모델을 선택합니다',
  },
  {
    step: 2,
    title: '지역 및 패키지 선택',
    description: '서비스 지역과 진단 패키지를 선택하고 견적을 확인합니다',
  },
  {
    step: 3,
    title: '일정 선택',
    description: '원하시는 날짜와 시간을 선택합니다',
  },
  {
    step: 4,
    title: '본인 인증',
    description: '휴대폰 번호로 본인 인증을 진행합니다',
  },
  {
    step: 5,
    title: '결제 및 신청 완료',
    description: '결제를 완료하면 신청이 완료됩니다',
  },
  {
    step: 6,
    title: '기사 배정 및 방문',
    description: '전문 기사가 배정되어 현장에서 진단을 진행합니다',
  },
  {
    step: 7,
    title: '진단 레포트 수신',
    description: '상세한 진단 레포트를 PDF로 받아보실 수 있습니다',
  },
];

export default function ServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <CustomerNavbar />
      {/* 히어로 섹션 */}
      <section className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
              NearCar 진단 서비스
            </h1>
            <p className="text-xl sm:text-2xl text-indigo-100">
              전문 기사가 직접 방문하여 체계적으로 진단합니다
            </p>
          </div>
        </div>
      </section>

      {/* 진단 범위 설명 섹션 */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              진단 범위
            </h2>
            <p className="text-lg text-gray-600">
              5개 섹션으로 나누어 체계적으로 진단합니다
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {DIAGNOSIS_SECTIONS.map((section, index) => (
              <div
                key={section.name}
                className="bg-gray-50 rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="text-4xl mb-4">{section.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {section.name}
                </h3>
                <p className="text-gray-600 mb-4">{section.description}</p>
                <ul className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start text-sm text-gray-700">
                      <span className="text-indigo-600 mr-2">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 기사 검증 시스템 소개 섹션 */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              검증된 전문 기사 시스템
            </h2>
            <p className="text-lg text-gray-600">
              엄격한 검증을 통과한 전문 기사만 서비스를 제공합니다
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {INSPECTOR_VERIFICATION.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-indigo-50 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              기사 등급 시스템
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((level) => (
                <div key={level} className="text-center">
                  <div className="text-3xl font-bold text-indigo-600 mb-2">
                    {level}등급
                  </div>
                  <p className="text-sm text-gray-600">
                    {level === 1 && '신입 기사'}
                    {level === 2 && '주니어 기사'}
                    {level === 3 && '시니어 기사'}
                    {level === 4 && '마스터 기사'}
                    {level === 5 && '엘리트 기사'}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-gray-600 text-center">
              등급이 높을수록 더 많은 경험과 전문성을 갖춘 기사입니다
            </p>
          </div>
        </div>
      </section>

      {/* 이용 가이드 섹션 */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              이용 가이드
            </h2>
            <p className="text-lg text-gray-600">
              신청부터 완료까지 단계별 안내
            </p>
          </div>

          <div className="relative">
            {/* 연결선 (데스크톱) */}
            <div className="hidden lg:block absolute top-12 left-0 right-0 h-0.5 bg-indigo-200" style={{ top: '3rem' }}></div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
              {SERVICE_STEPS.map((step, index) => (
                <div key={step.step} className="relative">
                  {/* 스텝 번호 */}
                  <div className="flex flex-col items-center">
                    <div className="relative z-10 w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4 shadow-lg">
                      {step.step}
                    </div>
                    <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow w-full">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-gray-600">{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 추가 단계 (모바일/태블릿에서 2열로 표시) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-4 mt-6">
              {SERVICE_STEPS.slice(4).map((step, index) => (
                <div key={step.step} className="flex flex-col items-center">
                  <div className="relative z-10 w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4 shadow-lg">
                    {step.step}
                  </div>
                  <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow w-full">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-16 bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            지금 바로 진단을 신청하세요
          </h2>
          <p className="text-xl mb-8 text-indigo-100">
            간단한 정보 입력만으로 전문 진단 서비스를 받을 수 있습니다
          </p>
          <Link
            href="/apply/vehicle"
            className="inline-block px-8 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
          >
            진단 신청하기
          </Link>
        </div>
      </section>

      <CustomerFooter />
    </div>
  );
}

