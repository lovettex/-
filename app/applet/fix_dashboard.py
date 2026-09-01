with open('src/pages/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('{/* Templates list with edit/delete buttons */}')
if idx == -1:
    print('Pattern not found!')
    exit(1)

clean_prefix = content[:idx]

raw_ending = '''{/* Templates list with edit/delete buttons */}
                        <div className="flex flex-col gap-2 mt-2">
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            現有模版清單 ({dynamicPrompts.length})
                          </div>
                          <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
                            {dynamicPrompts.map((p) => (
                              <div
                                key={p.id}
                                className={`p-2.5 rounded-lg border transition-all flex flex-col gap-1.5 ${
                                  p.id === aiSelectedPromptId
                                    ? "bg-white/10 border-amber-500/50"
                                    : "bg-white/[0.02] border-white/5 hover:border-white/10"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs font-bold text-white truncate">
                                      {p.name}
                                    </span>
                                    {p.note && (
                                      <span className="text-[9px] text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 truncate max-w-[120px]">
                                        {p.note}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPromptId(p.id);
                                        setEditingPromptName(p.name);
                                        setEditingPromptTemplate(p.template);
                                        setEditingPromptNote(p.note || "");
                                        playClickSound();
                                      }}
                                      className="p-1 text-zinc-400 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-all cursor-pointer"
                                      title="編輯"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                    {confirmDeletePromptId === p.id ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = dynamicPrompts.filter((x) => x.id !== p.id);
                                            handleSavePrompts(updated);
                                            if (aiSelectedPromptId === p.id && updated.length > 0) {
                                              setAiSelectedPromptId(updated[0].id);
                                            }
                                            setConfirmDeletePromptId(null);
                                            toast.success("模版已刪除");
                                            playClickSound();
                                          }}
                                          className="px-1.5 py-0.5 text-[9px] bg-red-600 text-white rounded font-bold hover:bg-red-500 transition-all cursor-pointer"
                                        >
                                          確定
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeletePromptId(null)}
                                          className="px-1.5 py-0.5 text-[9px] bg-zinc-800 text-zinc-300 rounded font-bold hover:bg-zinc-700 transition-all cursor-pointer"
                                        >
                                          取消
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeletePromptId(p.id)}
                                        className="p-1 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-all cursor-pointer"
                                        title="刪除"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="text-[10px] text-zinc-400 font-mono line-clamp-2 bg-black/30 p-1.5 rounded border border-white/5">
                                  {p.template}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 animate-fadeIn">
                      {/* 1. Stock Selector */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
                          <span>選擇分析標的 SELECT STOCK</span>
                          <span className="text-[10px] text-zinc-500 font-normal">
                            共 {uniqueActiveStocks.length} 檔
                          </span>
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap max-h-[90px] overflow-y-auto pr-1">
                          {uniqueActiveStocks.map((stock) => {
                            const isSelected = aiSelectedSymbol === stock.symbol;
                            return (
                              <button
                                key={stock.symbol}
                                type="button"
                                onClick={() => {
                                  setAiSelectedSymbol(stock.symbol);
                                  playClickSound();
                                }}
                                className={`px-2.5 py-1 text-xs rounded-lg font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  isSelected
                                    ? "bg-[#e5484d] text-white shadow-sm"
                                    : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5"
                                }`}
                              >
                                <span>{stock.symbol}</span>
                                {stock.companyName && (
                                  <span className="text-[10px] font-normal opacity-80">
                                    {stock.companyName}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Prompt Template Selector */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-zinc-300">
                            選擇指令模版 PROMPT TEMPLATE
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setIsPromptManagerOpen(true);
                              playClickSound();
                            }}
                            className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-all cursor-pointer font-bold"
                          >
                            <Settings className="w-3 h-3" />
                            <span>管理模版</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                          {dynamicPrompts.map((t) => {
                            const isSelected = aiSelectedPromptId === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  setAiSelectedPromptId(t.id);
                                  playClickSound();
                                }}
                                className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? "bg-[#e5484d]/10 border-[#e5484d]/60 text-white"
                                    : "bg-white/[0.02] border-white/5 hover:border-white/15 text-zinc-400 hover:text-zinc-200"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate text-zinc-200">
                                    {t.name}
                                  </div>
                                  {t.note && (
                                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                                      {t.note}
                                    </div>
                                  )}
                                </div>
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-[#e5484d] shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Prompt Text Box & Actions */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-zinc-300">
                            指令預覽與編輯 PROMPT CONTENT
                          </label>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {aiPromptText.length} 字元
                          </span>
                        </div>
                        <textarea
                          value={aiPromptText}
                          onChange={(e) => setAiPromptText(e.target.value)}
                          rows={4}
                          className="w-full bg-[#161616] border border-white/10 text-zinc-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-[#e5484d]/50 leading-relaxed resize-none"
                        />
                        <button
                          type="button"
                          onClick={handlePasteOnDeepseek}
                          className="w-full py-2 bg-[#e5484d] hover:bg-[#e5484d]/90 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-[#e5484d]/20"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>複製指令並前往 DeepSeek</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </button>
                      </div>

                      {/* 4. Upload & Manage HTML Reports */}
                      <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-emerald-400" />
                            <span>上傳與管理分析網頁 HTML REPORTS</span>
                          </span>
                        </div>

                        {/* File input & Submit */}
                        <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/5 flex flex-col gap-2">
                          <input
                            type="file"
                            accept=".html,.htm"
                            onChange={handleAiFileChange}
                            className="text-[11px] text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
                          />
                          {aiUploadContent && (
                            <button
                              type="button"
                              onClick={handleAiUploadSubmit}
                              disabled={isAiUploading}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                            >
                              {isAiUploading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Upload className="w-3.5 h-3.5" />
                              )}
                              <span>{isAiUploading ? "上傳中..." : "確認上傳 HTML 報告"}</span>
                            </button>
                          )}
                        </div>

                        {/* Uploaded HTML Files List */}
                        {aiHtmlFiles.length > 0 && (
                          <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-1">
                            <div className="text-[10px] text-zinc-500 font-bold uppercase">
                              已儲存之報告清單 ({aiHtmlFiles.length})
                            </div>
                            {aiHtmlFiles.map((f: any) => {
                              const isSelected = selectedPreviewUrl === `/api/html-files/${f.id}/content`;
                              return (
                                <div
                                  key={f.id}
                                  onClick={() => {
                                    setSelectedPreviewUrl(`/api/html-files/${f.id}/content`);
                                    setSelectedPreviewLinkTitle(f.fileName);
                                    setAiMobileActiveTab("preview");
                                    playClickSound();
                                  }}
                                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                    isSelected
                                      ? "bg-emerald-500/10 border-emerald-500/50 text-white"
                                      : "bg-white/[0.02] border-white/5 hover:border-white/15 text-zinc-400 hover:text-zinc-200"
                                  }`}
                                >
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span className="text-xs font-mono font-bold truncate">
                                      {f.fileName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => handleAiDeleteHtmlFile(e, f.id)}
                                      className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                                      title="刪除"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column (Web Preview / DeepSeek / Iframe) */}
                <div className={`flex-1 min-w-0 flex flex-col bg-[#111] rounded-xl border border-white/5 overflow-hidden ${aiMobileActiveTab === "preview" ? "flex" : "hidden lg:flex"}`}>
                  <div className="p-3 border-b border-white/5 bg-zinc-950 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-zinc-300 truncate">
                        {selectedPreviewLinkTitle || "網頁分析預覽 WEB PREVIEW"}
                      </span>
                    </div>
                    {selectedPreviewUrl && (
                      <div className="flex items-center gap-2">
                        <a
                          href={selectedPreviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-zinc-300 font-bold border border-white/5 flex items-center gap-1 transition-all"
                        >
                          <span>新視窗開啟</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 w-full h-full relative overflow-hidden bg-white">
                    {selectedPreviewUrl ? (
                      <iframe
                        src={selectedPreviewUrl}
                        title="AI HTML Report Preview"
                        className="w-full h-full border-none"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#0f0f0f] text-zinc-500 p-6 text-center">
                        <FileText className="w-10 h-10 text-zinc-700" />
                        <div className="text-xs font-bold text-zinc-400">尚未載入網頁報告</div>
                        <p className="text-[11px] text-zinc-600 max-w-sm">
                          請於左側選擇已上傳的 HTML 報告，或在 DeepSeek 完成分析後下載 HTML 上傳進行預覽。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
    </div>
  );
}
'''

with open('src/pages/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(clean_prefix)
    f.write(raw_ending)

print("Dashboard.tsx cleanly updated!")
