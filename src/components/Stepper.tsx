import React from 'react';
import { StepNumber } from '../types';
import { FolderOpen, Cpu, CheckCircle2, TableProperties, Download, Check } from 'lucide-react';

interface StepperProps {
  currentStep: StepNumber;
  maxStepReached: StepNumber;
  onStepClick: (step: StepNumber) => void;
}

export const Stepper: React.FC<StepperProps> = ({ currentStep, maxStepReached, onStepClick }) => {
  const steps = [
    { num: 1 as StepNumber, title: 'Bước 1', label: 'Thư mục & Thông tin', icon: FolderOpen },
    { num: 2 as StepNumber, title: 'Bước 2', label: 'Phân tích AI', icon: Cpu },
    { num: 3 as StepNumber, title: 'Bước 3', label: 'Đối chiếu thông số', icon: CheckCircle2 },
    { num: 4 as StepNumber, title: 'Bước 4', label: 'Bảng duyệt', icon: TableProperties },
    { num: 5 as StepNumber, title: 'Bước 5', label: 'Xuất file & Word', icon: Download },
  ];

  return (
    <div className="bg-white border-b border-slate-200 shadow-xs px-4 sm:px-6 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto">
        <nav aria-label="Progress">
          <ol className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
            {steps.map((step) => {
              const isCurrent = currentStep === step.num;
              const isCompleted = step.num < currentStep;
              const isClickable = step.num <= maxStepReached;
              const Icon = step.icon;

              return (
                <li key={step.num}>
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && onStepClick(step.num)}
                    className={`group w-full flex items-center p-2 rounded-lg text-left transition ${
                      isCurrent
                        ? 'bg-blue-50 border border-blue-300 text-blue-900 shadow-xs'
                        : isCompleted
                        ? 'bg-slate-50 border border-slate-200 text-slate-800 hover:bg-slate-100'
                        : 'border border-transparent text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mr-2.5 text-xs font-semibold ${
                        isCurrent
                          ? 'bg-blue-600 text-white shadow-xs'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1">
                        <span className={`text-[10px] uppercase tracking-wider font-semibold ${
                          isCurrent ? 'text-blue-600' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
                        }`}>
                          {step.title}
                        </span>
                      </div>
                      <div className={`text-xs font-medium truncate ${
                        isCurrent ? 'text-blue-950 font-bold' : isCompleted ? 'text-slate-900' : 'text-slate-500'
                      }`}>
                        {step.label}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
};
