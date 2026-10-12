import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange }) {
  const safePage = Math.max(1, page || 1)
  const safeTotalPages = Math.max(1, totalPages || 1)
  if ((total ?? 0) === 0) return null

  const go = (p) => {
    const next = Math.min(safeTotalPages, Math.max(1, p))
    if (next !== safePage) onPageChange(next)
  }

  // Dải số trang gọn: hiện tại ± 2
  const start = Math.max(1, safePage - 2)
  const end = Math.min(safeTotalPages, safePage + 2)
  const nums = []
  for (let i = start; i <= end; i++) nums.push(i)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
      <span className="text-slate-500 font-medium">
        Trang <strong className="text-slate-800">{safePage} / {safeTotalPages}</strong>
        {typeof total === 'number' && <span> — tổng <strong className="text-slate-800">{total}</strong> bản ghi</span>}
      </span>

      <div className="flex items-center gap-1.5">
        <button className="btn-outline text-xs px-2 py-1" disabled={safePage <= 1} onClick={() => go(safePage - 1)} title="Trang trước">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {start > 1 && (
          <>
            <button className="btn-outline text-xs px-2.5 py-1" onClick={() => go(1)}>1</button>
            {start > 2 && <span className="text-slate-400 px-1">…</span>}
          </>
        )}
        {nums.map(n => (
          <button
            key={n}
            onClick={() => go(n)}
            className={`text-xs px-2.5 py-1 rounded-md font-bold border transition ${n === safePage ? 'bg-brand-600 text-white border-brand-600' : 'btn-outline'}`}
          >
            {n}
          </button>
        ))}
        {end < safeTotalPages && (
          <>
            {end < safeTotalPages - 1 && <span className="text-slate-400 px-1">…</span>}
            <button className="btn-outline text-xs px-2.5 py-1" onClick={() => go(safeTotalPages)}>{safeTotalPages}</button>
          </>
        )}
        <button className="btn-outline text-xs px-2 py-1" disabled={safePage >= safeTotalPages} onClick={() => go(safePage + 1)} title="Trang sau">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {onPageSizeChange && (
        <select
          className="input text-xs w-28"
          value={pageSize}
          onChange={e => onPageSizeChange(parseInt(e.target.value, 10))}
          title="Số dòng mỗi trang"
        >
          <option value={20}>20 / trang</option>
          <option value={50}>50 / trang</option>
          <option value={100}>100 / trang</option>
        </select>
      )}
    </div>
  )
}
