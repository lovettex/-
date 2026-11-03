# 修正 Primial 分批進場金字塔動態圖表 已購/預購 數據與比例

## 問題根因分析 (Root Cause Analysis)
1. **模擬交易最大策略風險池資金池失真**:
   - `Dashboard.tsx` 傳入 `PrimialPyramidViewModal` 的 `maxStrategyRiskPool60` 是依據真實交易資金 `totalCapital` ($1,571.82) 計算所得 (~$1,886)，未依個股之 `tradeType === 'simulated'` 使用模擬總資金 `virtualCapital` ($1,005,048)。
   - 導致在推算預購總股數時，2% 佔比計算出 0 股，觸發了不適當的預設持股倍率備援公式 `Math.ceil(holdingQty / 0.15)`，將 71 股推算為 476 股（72/119/166/119）。
2. **個股存檔之 `plannedBuyQty` 優先級未對齊個股頁面**:
   - 個股頁面 (`StockTabDetail.tsx`) 優先採用個股存檔之 `tab.plannedBuyQty`（如 NEE 為 293 股）。
   - 模態視窗與計算函數未優先以 `plannedBuyQty` 作為權威基準。
3. **金字塔圖表已購股數雙重累計失真**:
   - `System2PlanningChart.tsx` 中的 `boughtQty` 之前使用了 `Math.max(batch.bought, s1Bought + s2Bought, safePlanBatch.bought)`。
   - 其中 `s1Bought` 與 `s2Bought` 分別取自不同來源的拆分一與拆分二已購數據，相加後產生了 109 股的錯誤數值（超過總持股 71 股及第一批上限 72 股）。

## 修正方案 (Fix Implementation)
1. **`src/lib/calculations.ts`**:
   - 智慧識別 `tradeType === 'simulated'`，當為模擬交易時強制採用 `virtualCapital` 計算最大策略風險池 `(virtualCapital * 2) * 0.6`。
   - 預購總股數推算優先採用 `plannedBuyQty`，若無則依有效可用資金除以現價推算。
   - 拆分交易已購股數約束：嚴格限制 `split1.bought + split2.bought` 不得超過該批次總已購股數，杜絕重複加總。
2. **`src/components/PrimialPyramidViewModal.tsx`**:
   - 對齊 `StockTabDetail.tsx` 的資金池與可用資金計算方式：`const effectiveCapital = (isSimulated ? virtualCapital : totalCapital) || totalCapital || 1000000; const currentRiskPool = (effectiveCapital * 2) * 0.6;`。
   - 優先讀取 `tab.plannedBuyQty` 作為預購總股數。
   - 完整傳遞 `tradeType`, `totalCapital`, `virtualCapital`, `maxStrategyRiskPool60` 至 `calculateBatchPlanning`。
3. **`src/components/System2PlanningChart.tsx`**:
   - 當傳入 `batches` prop 時，直接完全信任並採用該權威數據（包含 `size`, `bought`, `remaining`, `split1`, `split2`）。
   - 總已購股數 `totalBoughtShares` 不超過真實持有總股數 `effectiveHoldingShares`。
