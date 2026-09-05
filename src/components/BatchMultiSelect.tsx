import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, Plus } from 'lucide-react';

export interface BatchOption {
  id: string;
  label: string;
  group: '第一批' | '第二批' | '第三批' | '第四批';
  isSplit?: boolean;
  borderColor: string;
  bgColor: string;
  textColor: string;
  activeBg: string;
  dotColor: string;
}

export const BATCH_OPTIONS: BatchOption[] = [
  // === 第一批 ===
  {
    id: '第一批交易(15%)',
    label: '第一批交易(15%)',
    group: '第一批',
    borderColor: 'border-blue-300',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    activeBg: 'bg-blue-600',
    dotColor: 'bg-blue-500',
  },
  {
    id: '第一批拆分交易(7%)',
    label: '第一批拆分交易(7%)',
    group: '第一批',
    isSplit: true,
    borderColor: 'border-sky-300',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
    activeBg: 'bg-sky-600',
    dotColor: 'bg-sky-500',
  },
  {
    id: '第一批拆分交易(8%)',
    label: '第一批拆分交易(8%)',
    group: '第一批',
    isSplit: true,
    borderColor: 'border-cyan-300',
    bgColor: 'bg-cyan-50',
    textColor: 'text-cyan-800',
    activeBg: 'bg-cyan-600',
    dotColor: 'bg-cyan-500',
  },

  // === 第二批 ===
  {
    id: '第二批交易(25%)',
    label: '第二批交易(25%)',
    group: '第二批',
    borderColor: 'border-emerald-300',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    activeBg: 'bg-emerald-600',
    dotColor: 'bg-emerald-500',
  },
  {
    id: '第二批拆分交易(10%)',
    label: '第二批拆分交易(10%)',
    group: '第二批',
    isSplit: true,
    borderColor: 'border-teal-300',
    bgColor: 'bg-teal-50',
    textColor: 'text-teal-700',
    activeBg: 'bg-teal-600',
    dotColor: 'bg-teal-500',
  },
  {
    id: '第二批拆分交易(15%)',
    label: '第二批拆分交易(15%)',
    group: '第二批',
    isSplit: true,
    borderColor: 'border-green-300',
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
    activeBg: 'bg-green-600',
    dotColor: 'bg-green-500',
  },

  // === 第三批 ===
  {
    id: '第三批交易 (35%)',
    label: '第三批交易 (35%)',
    group: '第三批',
    borderColor: 'border-amber-300',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
    activeBg: 'bg-amber-600',
    dotColor: 'bg-amber-500',
  },
  {
    id: '第三批拆分交易(15%)',
    label: '第三批拆分交易(15%)',
    group: '第三批',
    isSplit: true,
    borderColor: 'border-orange-300',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-800',
    activeBg: 'bg-orange-600',
    dotColor: 'bg-orange-500',
  },
  {
    id: '第三批拆分交易(20%)',
    label: '第三批拆分交易(20%)',
    group: '第三批',
    isSplit: true,
    borderColor: 'border-yellow-300',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-800',
    activeBg: 'bg-yellow-600',
    dotColor: 'bg-yellow-500',
  },

  // === 第四批 ===
  {
    id: '第四批交易 (25%)',
    label: '第四批交易 (25%)',
    group: '第四批',
    borderColor: 'border-purple-300',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    activeBg: 'bg-purple-600',
    dotColor: 'bg-purple-500',
  },
  {
    id: '第四批拆分交易(10%)',
    label: '第四批拆分交易(10%)',
    group: '第四批',
    isSplit: true,
    borderColor: 'border-fuchsia-300',
    bgColor: 'bg-fuchsia-50',
    textColor: 'text-fuchsia-800',
    activeBg: 'bg-fuchsia-600',
    dotColor: 'bg-fuchsia-500',
  },
  {
    id: '第四批拆分交易(15%)',
    label: '第四批拆分交易(15%)',
    group: '第四批',
    isSplit: true,
    borderColor: 'border-violet-300',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    activeBg: 'bg-violet-600',
    dotColor: 'bg-violet-500',
  },
];

// Helper to normalize and parse comma-separated batch strings
export function parseBatches(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Find matching option with whitespace tolerance
export function findBatchOption(batchName: string): BatchOption | undefined {
  const clean = batchName.replace(/\s+/g, '');
  return BATCH_OPTIONS.find((opt) => opt.id.replace(/\s+/g, '') === clean);
}

interface BatchMultiSelectProps {
  value: string | string[] | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: 'table' | 'form';
  className?: string;
}

export const BatchMultiSelect: React.FC<BatchMultiSelectProps> = ({
  value,
  onChange,
  placeholder = '選擇批次',
  variant = 'table',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize selected list
  const selectedBatches = Array.isArray(value)
    ? value
    : parseBatches(value);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (optionId: string) => {
    const currentMatches = selectedBatches.some(
      (b) => b.replace(/\s+/g, '') === optionId.replace(/\s+/g, '')
    );
    let next: string[];
    if (currentMatches) {
      next = selectedBatches.filter(
        (b) => b.replace(/\s+/g, '') !== optionId.replace(/\s+/g, '')
      );
    } else {
      next = [...selectedBatches, optionId];
    }
    onChange(next.join(', '));
  };

  const removeOption = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = selectedBatches.filter(
      (b) => b.replace(/\s+/g, '') !== optionId.replace(/\s+/g, '')
    );
    onChange(next.join(', '));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const isFormVariant = variant === 'form';

  // Group options by batch group for organized menu rendering
  const groups: Array<{ name: string; color: string; options: BatchOption[] }> = [
    {
      name: '第一批 (15%)',
      color: 'text-blue-600 border-blue-200 bg-blue-50/50',
      options: BATCH_OPTIONS.filter((o) => o.group === '第一批'),
    },
    {
      name: '第二批 (25%)',
      color: 'text-emerald-600 border-emerald-200 bg-emerald-50/50',
      options: BATCH_OPTIONS.filter((o) => o.group === '第二批'),
    },
    {
      name: '第三批 (35%)',
      color: 'text-amber-700 border-amber-200 bg-amber-50/50',
      options: BATCH_OPTIONS.filter((o) => o.group === '第三批'),
    },
    {
      name: '第四批 (25%)',
      color: 'text-purple-600 border-purple-200 bg-purple-50/50',
      options: BATCH_OPTIONS.filter((o) => o.group === '第四批'),
    },
  ];

  return (
    <div className={`relative inline-block ${isFormVariant ? 'w-full' : ''} ${className}`} ref={containerRef}>
      {/* Selected Tags Display Container (選好後用標籤顯示) */}
      {selectedBatches.length > 0 ? (
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`flex flex-wrap items-center gap-1.5 p-1 rounded-xl cursor-pointer transition-all border ${
            isFormVariant
              ? 'w-full min-h-[42px] bg-white border-zinc-250 hover:border-zinc-400 shadow-2xs'
              : 'min-h-[32px] bg-transparent border-transparent hover:bg-zinc-50/60'
          } ${isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-400' : ''}`}
        >
          {selectedBatches.map((batchName) => {
            const opt = findBatchOption(batchName);
            const style = opt
              ? `${opt.bgColor} ${opt.borderColor} ${opt.textColor}`
              : 'bg-zinc-100 border-zinc-300 text-zinc-700';

            return (
              <span
                key={batchName}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs transition-transform hover:scale-[1.02] ${style}`}
                title={batchName}
              >
                <span>{opt ? opt.label : batchName}</span>
                <span
                  onClick={(e) => removeOption(batchName, e)}
                  title="移除此標籤"
                  className="p-0.5 rounded-full hover:bg-black/10 transition-colors cursor-pointer ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </span>
              </span>
            );
          })}

          {/* Small add/expand button pill */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen)}
            }
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-colors"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>加批次</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Quick Clear All */}
          <button
            type="button"
            onClick={handleClearAll}
            title="清除全部"
            className="p-1 text-zinc-400 hover:text-rose-500 rounded-full transition-colors ml-auto text-[10px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Empty State Button Trigger */
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between gap-1.5 transition-all cursor-pointer select-none text-left border ${
            isFormVariant
              ? 'w-full h-9 px-3 rounded-lg bg-white border-zinc-250 hover:border-zinc-400 text-zinc-400 shadow-2xs'
              : 'h-8 px-3 rounded-full bg-zinc-50/80 border-dashed border-zinc-300 text-zinc-400 hover:text-zinc-600 hover:border-zinc-400 shadow-2xs min-w-[120px]'
          } ${isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-400' : ''}`}
        >
          <span className="text-xs text-zinc-400 font-medium flex items-center gap-1">
            <Plus className="w-3 h-3 text-zinc-400" />
            {placeholder}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-zinc-700' : ''
            }`}
          />
        </button>
      )}

      {/* Multi-Select Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute left-0 mt-1.5 w-72 max-h-[380px] overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-2xl z-50 p-2 text-zinc-800 animate-in fade-in-50 zoom-in-95 duration-100 ${
            isFormVariant ? 'w-full min-w-[260px]' : ''
          }`}
        >
          <div className="flex items-center justify-between px-2 py-1 mb-1.5 border-b border-zinc-100 sticky top-0 bg-white z-10">
            <span className="text-[11px] font-bold text-zinc-500">
              選擇交易批次 (可複選)
            </span>
            {selectedBatches.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
              >
                全部清除
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {groups.map((grp) => (
              <div key={grp.name} className="space-y-1">
                <div className={`text-[10px] font-black px-2 py-0.5 rounded-md border tracking-wider flex items-center justify-between ${grp.color}`}>
                  <span>{grp.name}</span>
                </div>
                <div className="space-y-0.5 pl-1">
                  {grp.options.map((opt) => {
                    const isSelected = selectedBatches.some(
                      (b) => b.replace(/\s+/g, '') === opt.id.replace(/\s+/g, '')
                    );
                    return (
                      <div
                        key={opt.id}
                        onClick={() => toggleOption(opt.id)}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all border text-xs ${
                          isSelected
                            ? `${opt.bgColor} ${opt.borderColor} font-bold shadow-2xs`
                            : 'border-transparent hover:bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                              isSelected
                                ? `${opt.activeBg} border-transparent text-white`
                                : 'border-zinc-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className={`${isSelected ? opt.textColor : 'text-zinc-700 font-medium'}`}>
                            {opt.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {selectedBatches.length > 0 && (
            <div className="mt-2.5 pt-1.5 border-t border-zinc-100 flex items-center justify-between px-2 text-[11px] text-zinc-400 sticky bottom-0 bg-white">
              <span>已選擇 {selectedBatches.length} 個批次標籤</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer bg-indigo-50 px-2.5 py-0.5 rounded-md"
              >
                完成
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
