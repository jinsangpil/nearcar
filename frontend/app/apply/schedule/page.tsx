'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useInspectionStore } from '@/stores/inspectionStore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function SchedulePage() {
  const router = useRouter();
  const { scheduleInfo, setScheduleInfo, setCurrentStep } = useInspectionStore();
  
  // 날짜 및 시간 상태
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    scheduleInfo.date ? new Date(scheduleInfo.date) : null
  );
  const [selectedTime, setSelectedTime] = useState<string>(scheduleInfo.time || '');
  
  // 시간 슬롯 생성 (30분 단위, 09:00 ~ 18:00)
  const timeSlots = React.useMemo(() => {
    const slots: string[] = [];
    for (let hour = 9; hour < 18; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);
  
  // 예약 불가능한 날짜 필터링 (과거 날짜, 오늘 이전)
  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };
  
  // 날짜 선택 핸들러
  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
    setSelectedTime(''); // 날짜 변경 시 시간 초기화
  };
  
  // 시간 선택 핸들러
  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };
  
  // 다음 단계로 진행
  const handleNext = () => {
    if (!selectedDate) {
      alert('날짜를 선택해주세요');
      return;
    }
    if (!selectedTime) {
      alert('시간을 선택해주세요');
      return;
    }
    
    // 날짜와 시간을 결합하여 ISO 형식으로 저장
    const dateTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(':').map(Number);
    dateTime.setHours(hours, minutes, 0, 0);
    
    setScheduleInfo({
      date: format(selectedDate, 'yyyy-MM-dd'),
      time: selectedTime,
    });
    
    // 다음 단계로 이동
    setCurrentStep(4);
    router.push('/apply/auth');
  };
  
  // 이전 단계로 이동
  const handleBack = () => {
    setCurrentStep(2);
    router.push('/apply/quote');
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">일정 선택</h1>
          <p className="text-gray-600">진단 서비스를 받을 날짜와 시간을 선택해주세요</p>
        </div>
        
        {/* 진행 단계 표시 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">차량 정보</span>
            </div>
            <div className="flex-1 h-0.5 bg-indigo-600 mx-4"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">견적 및 옵션</span>
            </div>
            <div className="flex-1 h-0.5 bg-indigo-600 mx-4"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white font-semibold">
                3
              </div>
              <span className="ml-2 text-sm font-medium text-gray-900">일정 선택</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-4"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-500 font-semibold">
                4
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">본인 인증</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽: 캘린더 */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">날짜 선택</h2>
            <div className="flex justify-center">
              <DatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                filterDate={isDateDisabled}
                minDate={new Date()}
                locale={ko}
                dateFormat="yyyy년 MM월 dd일"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-base text-center"
                placeholderText="날짜를 선택해주세요"
                calendarClassName="react-datepicker-custom"
              />
            </div>
            {selectedDate && (
              <p className="mt-4 text-sm text-gray-600 text-center">
                선택된 날짜: {format(selectedDate, 'yyyy년 MM월 dd일 (EEE)', { locale: ko })}
              </p>
            )}
          </div>
          
          {/* 오른쪽: 시간 선택 */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">시간 선택</h2>
            {!selectedDate ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">먼저 날짜를 선택해주세요</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
                {timeSlots.map((time) => {
                  // TODO: 예약 가능한 시간 조회 API 연동 후 비활성화 처리
                  // const isDisabled = unavailableTimes.includes(time);
                  const isDisabled = false; // 임시로 모든 시간 활성화
                  const isSelected = selectedTime === time;
                  
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => !isDisabled && handleTimeSelect(time)}
                      disabled={isDisabled}
                      className={`px-4 py-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : isDisabled
                          ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedTime && (
              <p className="mt-4 text-sm text-gray-600 text-center">
                선택된 시간: {selectedTime}
              </p>
            )}
          </div>
        </div>
        
        {/* 선택 요약 */}
        {selectedDate && selectedTime && (
          <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-indigo-900 mb-2">선택된 일정</h3>
            <p className="text-base text-indigo-700">
              {format(selectedDate, 'yyyy년 MM월 dd일 (EEE)', { locale: ko })} {selectedTime}
            </p>
          </div>
        )}
        
        {/* 버튼 */}
        <div className="flex justify-between gap-4 mt-8">
          <button
            type="button"
            onClick={handleBack}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            이전 단계
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!selectedDate || !selectedTime}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            다음 단계
          </button>
        </div>
      </div>
    </div>
  );
}

