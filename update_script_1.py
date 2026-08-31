import re

# 1. Update StockTabDetail.tsx
with open('src/pages/StockTabDetail.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Update System 1 block
old_sys1_pattern = """                            {averagingRows.map((row, idx) => {
                              const discountLabels = ['-2%', '-4%', '-6%', '-8%'];
                              const discountLabel = discountLabels[idx];
                              const riskMessages: Record<number, string> = {
                                1: '(進入平倉籌碼倉位)',
                                2: '(進入負籌碼博弈倉位)',
                                3: '(進入強制關閉倉位)',
                              };

                              return (
                                <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                                  {/* 組別 */}
                                  <div className="col-span-3 flex items-center gap-1 min-w-0 flex-wrap">
                                    <input
                                      type="checkbox"
                                      checked={!!row.bought}
                                      onChange={(e) => {
                                        const newRows = [...averagingRows];
                                        newRows[idx] = { ...newRows[idx], bought: e.target.checked };
                                        setAveragingRows(newRows);
                                      }}
                                      className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer shrink-0"
                                      title={row.bought ? "已購入" : "勾選標記為已購入"}
                                    />
                                    <span className="text-xs text-zinc-500 font-bold shrink-0">#{idx + 1}</span>
                                    {discountLabel && (
                                      <span className="text-[11px] font-black text-red-600 shrink-0">{discountLabel}</span>
                                    )}

                                    {idx >= 1 && (
                                      <label
                                        className="inline-flex items-center cursor-pointer ml-0.5 shrink-0"
                                        title="點擊勾選切換風險倉位提示"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!!row.riskFlag}
                                          onChange={(e) => {
                                            const newRows = [...averagingRows];
                                            newRows[idx] = { ...newRows[idx], riskFlag: e.target.checked };
                                            setAveragingRows(newRows);
                                          }}
                                          className="sr-only"
                                        />
                                        <div className={`p-0.5 rounded transition-all flex items-center justify-center ${
                                          row.riskFlag
                                            ? 'bg-rose-100 text-rose-600 ring-1 ring-rose-400'
                                            : 'text-zinc-400 hover:text-rose-500 hover:bg-rose-50'
                                        }`}>
                                          <AlertTriangle className="h-3 w-3 fill-current" />
                                        </div>
                                      </label>
                                    )}
                                  </div>"""

new_sys1_replacement = """                            {averagingRows.map((row, idx) => {
                              const discountLabels = ['-2%', '-4%', '-6%', '-8%'];
                              const discountLabel = discountLabels[idx];
                              const isClosePosition = idx === 2; // 系統一第三欄位 (-6%) 為平倉
                              const riskMessages: Record<number, string> = {
                                1: '(進入觀察倉位)',
                                2: '(進入平倉籌碼倉位)',
                                3: '(進入強制關閉倉位)',
                              };

                              return (
                                <div
                                  key={idx}
                                  className={`grid grid-cols-12 gap-1.5 items-center p-1 rounded-xl transition-all ${
                                    isClosePosition
                                      ? 'bg-rose-50/80 border border-rose-300/90 ring-1 ring-rose-200 shadow-2xs'
                                      : 'border border-transparent'
                                  }`}
                                >
                                  {/* 組別 */}
                                  <div className="col-span-3 flex items-center gap-1 min-w-0 flex-wrap">
                                    <input
                                      type="checkbox"
                                      checked={!!row.bought}
                                      onChange={(e) => {
                                        const newRows = [...averagingRows];
                                        newRows[idx] = { ...newRows[idx], bought: e.target.checked };
                                        setAveragingRows(newRows);
                                      }}
                                      className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer shrink-0"
                                      title={row.bought ? "已購入" : "勾選標記為已購入"}
                                    />
                                    <span className={`text-xs font-bold shrink-0 ${isClosePosition ? 'text-rose-700 font-black' : 'text-zinc-500'}`}>
                                      #{idx + 1}
                                    </span>
                                    {discountLabel && (
                                      <span
                                        className={`text-[11px] font-black shrink-0 ${
                                          isClosePosition
                                            ? 'text-rose-700 bg-rose-200/90 px-1 py-0.5 rounded border border-rose-300 shadow-2xs flex items-center gap-0.5'
                                            : 'text-red-600'
                                        }`}
                                      >
                                        {discountLabel}
                                        {isClosePosition && <span className="text-[10px] font-bold text-rose-800">(平倉)</span>}
                                      </span>
                                    )}

                                    {idx >= 1 && (
                                      <label
                                        className="inline-flex items-center cursor-pointer ml-0.5 shrink-0"
                                        title="點擊勾選切換風險倉位提示"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={row.riskFlag !== undefined ? !!row.riskFlag : isClosePosition}
                                          onChange={(e) => {
                                            const newRows = [...averagingRows];
                                            newRows[idx] = { ...newRows[idx], riskFlag: e.target.checked };
                                            setAveragingRows(newRows);
                                          }}
                                          className="sr-only"
                                        />
                                        <div className={`p-0.5 rounded transition-all flex items-center justify-center ${
                                          (row.riskFlag ?? isClosePosition)
                                            ? 'bg-rose-100 text-rose-600 ring-1 ring-rose-400'
                                            : 'text-zinc-400 hover:text-rose-500 hover:bg-rose-50'
                                        }`}>
                                          <AlertTriangle className="h-3 w-3 fill-current" />
                                        </div>
                                      </label>
                                    )}
                                  </div>"""

assert old_sys1_pattern in code, "old_sys1_pattern not found"
code = code.replace(old_sys1_pattern, new_sys1_replacement, 1)

# Update System 1 status risk message check
old_sys1_status = """                                    {idx >= 1 && row.riskFlag && riskMessages[idx] && (
                                       <span className="text-[9px] font-bold text-red-600 leading-tight whitespace-nowrap">
                                         {riskMessages[idx]}
                                       </span>
                                     )}"""

new_sys1_status = """                                    {idx >= 1 && (row.riskFlag ?? isClosePosition) && riskMessages[idx] && (
                                       <span className="text-[9px] font-bold text-red-600 leading-tight whitespace-nowrap">
                                         {riskMessages[idx]}
                                       </span>
                                     )}"""

assert old_sys1_status in code, "old_sys1_status not found"
code = code.replace(old_sys1_status, new_sys1_status, 1)

# Update System 2 block
old_sys2_pattern = """                            {averagingRowsSys2.map((row, idx) => {
                              const discountLabels = ['-3%', '-6%', '-9%', '-12%'];
                              const discountLabel = discountLabels[idx];
                              const riskMessages: Record<number, string> = {
                                1: '(進入平倉籌碼倉位)',
                                2: '(進入負籌碼博弈倉位)',
                                3: '(進入強制關閉倉位)',
                              };

                              return (
                                <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                                  {/* 組別 */}
                                  <div className="col-span-3 flex items-center gap-1 min-w-0 flex-wrap">
                                    <input
                                      type="checkbox"
                                      checked={!!row.bought}
                                      onChange={(e) => {
                                        const newRows = [...averagingRowsSys2];
                                        newRows[idx] = { ...newRows[idx], bought: e.target.checked };
                                        setAveragingRowsSys2(newRows);
                                      }}
                                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer shrink-0"
                                      title={row.bought ? "已購入" : "勾選標記為已購入"}
                                    />
                                    <span className="text-xs text-zinc-500 font-bold shrink-0">#{idx + 1}</span>
                                    {discountLabel && (
                                      <span className="text-[11px] font-black text-red-600 shrink-0">{discountLabel}</span>
                                    )}

                                    {idx >= 1 && (
                                      <label
                                        className="inline-flex items-center cursor-pointer ml-0.5 shrink-0"
                                        title="點擊勾選切換風險倉位提示"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!!row.riskFlag}
                                          onChange={(e) => {
                                            const newRows = [...averagingRowsSys2];
                                            newRows[idx] = { ...newRows[idx], riskFlag: e.target.checked };
                                            setAveragingRowsSys2(newRows);
                                          }}
                                          className="sr-only"
                                        />
                                        <div className={`p-0.5 rounded transition-all flex items-center justify-center ${
                                          row.riskFlag
                                            ? 'bg-rose-100 text-rose-600 ring-1 ring-rose-400'
                                            : 'text-zinc-400 hover:text-rose-500 hover:bg-rose-50'
                                        }`}>
                                          <AlertTriangle className="h-3 w-3 fill-current" />
                                        </div>
                                      </label>
                                    )}
                                  </div>"""

new_sys2_replacement = """                            {averagingRowsSys2.map((row, idx) => {
                              const discountLabels = ['-3%', '-6%', '-9%', '-12%'];
                              const discountLabel = discountLabels[idx];
                              const isClosePosition = idx === 1; // 系統二第二欄位 (-6%) 為平倉
                              const riskMessages: Record<number, string> = {
                                1: '(進入平倉籌碼倉位)',
                                2: '(進入負籌碼博弈倉位)',
                                3: '(進入強制關閉倉位)',
                              };

                              return (
                                <div
                                  key={idx}
                                  className={`grid grid-cols-12 gap-1.5 items-center p-1 rounded-xl transition-all ${
                                    isClosePosition
                                      ? 'bg-rose-50/80 border border-rose-300/90 ring-1 ring-rose-200 shadow-2xs'
                                      : 'border border-transparent'
                                  }`}
                                >
                                  {/* 組別 */}
                                  <div className="col-span-3 flex items-center gap-1 min-w-0 flex-wrap">
                                    <input
                                      type="checkbox"
                                      checked={!!row.bought}
                                      onChange={(e) => {
                                        const newRows = [...averagingRowsSys2];
                                        newRows[idx] = { ...newRows[idx], bought: e.target.checked };
                                        setAveragingRowsSys2(newRows);
                                      }}
                                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer shrink-0"
                                      title={row.bought ? "已購入" : "勾選標記為已購入"}
                                    />
                                    <span className={`text-xs font-bold shrink-0 ${isClosePosition ? 'text-rose-700 font-black' : 'text-zinc-500'}`}>
                                      #{idx + 1}
                                    </span>
                                    {discountLabel && (
                                      <span
                                        className={`text-[11px] font-black shrink-0 ${
                                          isClosePosition
                                            ? 'text-rose-700 bg-rose-200/90 px-1 py-0.5 rounded border border-rose-300 shadow-2xs flex items-center gap-0.5'
                                            : 'text-red-600'
                                        }`}
                                      >
                                        {discountLabel}
                                        {isClosePosition && <span className="text-[10px] font-bold text-rose-800">(平倉)</span>}
                                      </span>
                                    )}

                                    {idx >= 1 && (
                                      <label
                                        className="inline-flex items-center cursor-pointer ml-0.5 shrink-0"
                                        title="點擊勾選切換風險倉位提示"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={row.riskFlag !== undefined ? !!row.riskFlag : isClosePosition}
                                          onChange={(e) => {
                                            const newRows = [...averagingRowsSys2];
                                            newRows[idx] = { ...newRows[idx], riskFlag: e.target.checked };
                                            setAveragingRowsSys2(newRows);
                                          }}
                                          className="sr-only"
                                        />
                                        <div className={`p-0.5 rounded transition-all flex items-center justify-center ${
                                          (row.riskFlag ?? isClosePosition)
                                            ? 'bg-rose-100 text-rose-600 ring-1 ring-rose-400'
                                            : 'text-zinc-400 hover:text-rose-500 hover:bg-rose-50'
                                        }`}>
                                          <AlertTriangle className="h-3 w-3 fill-current" />
                                        </div>
                                      </label>
                                    )}
                                  </div>"""

assert old_sys2_pattern in code, "old_sys2_pattern not found"
code = code.replace(old_sys2_pattern, new_sys2_replacement, 1)

# Update System 2 status risk message check
old_sys2_status = """                                    {idx >= 1 && row.riskFlag && riskMessages[idx] && (
                                       <span className="text-[9px] font-bold text-red-600 leading-tight whitespace-nowrap">
                                         {riskMessages[idx]}
                                       </span>
                                     )}"""

new_sys2_status = """                                    {idx >= 1 && (row.riskFlag ?? isClosePosition) && riskMessages[idx] && (
                                       <span className="text-[9px] font-bold text-red-600 leading-tight whitespace-nowrap">
                                         {riskMessages[idx]}
                                       </span>
                                     )}"""

assert old_sys2_status in code, "old_sys2_status not found"
code = code.replace(old_sys2_status, new_sys2_status, 1)

with open('src/pages/StockTabDetail.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("StockTabDetail.tsx updated successfully!")
