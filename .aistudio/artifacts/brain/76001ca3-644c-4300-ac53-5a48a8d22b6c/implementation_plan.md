# PS5 Dynamic Mode Card Styling & Menu Dialog Optimization

## Requirements Addressed
1. **Card Background & Embossed Effects in PS5 Mode**:
   - When PS5 dynamic background is turned on, the card should not have dark/black shadows behind it, nor should it present an embossed/raised (凸起) effect (`卡片背影不需要有黑影也不需要呈現凸起的效果`).
2. **PS5 Dynamic Background Menu Optimization**:
   - The PS5 dynamic background dialog list should stay strictly inside the dialog window and not overflow or spill out (`列表內容保持在對話窗內. 不要超出`).
3. **Constraint**:
   - No other functional or visual features changed (`其他的不需要做任何變更`).

## Changes Made
1. **PS5 Theme / White Noise Menu (`src/components/WhiteNoisePlayer.tsx`)**:
   - Added `overflow-hidden` to the modal container.
   - Wrapped the Soundscapes catalog and PS5 Themes tab in `flex-1 min-h-0 flex flex-col overflow-hidden`.
   - Made the banner and speed controller `shrink-0`.
   - Converted the themes scroll container from fixed `max-h-[360px]` to `flex-1 min-h-0 overflow-y-auto overscroll-contain`.
   - Docked the footer with `shrink-0 mt-auto`.
   - Result: All cards and list items remain strictly enclosed inside the modal window and scroll smoothly without overflowing the bottom border.

2. **PS5 Mode Card & Tag Styling (`src/index.css` & `src/components/StockCardVisualizer.tsx`)**:
   - In `src/index.css`:
     - Removed `transform: translateZ(14px)` and `translateZ(20px)` from `[data-price-tag="true"]`.
     - Removed dark floating `box-shadow` and beveled border highlights/shadows from price tags, CP, and AC tags.
     - Removed drop-shadow filters from SVG benchmark lines, AC lines, CP lines, and axis text.
     - Removed `box-shadow` from `.glass-card`, `.card-front`, `.card-back`, `.card-wrapper`, `[id^="stock-card-"]`, and `.slide-drawer-container`.
   - In `src/components/StockCardVisualizer.tsx`:
     - Removed `ps5Line3dShadow` and `ps5BenchmarkGlow` SVG filter definitions and usages.
     - Removed `textShadow: "0 1px 2px rgba(0, 0, 0, 0.9)"` and `filter: drop-shadow` on axis text.
     - Kept tags flat and clean with standard delicate borders.

3. **Verification**:
   - `tsc --noEmit` passed with 0 errors.
   - `npm run build` compiled cleanly.
   - Dev server running on port 3000.
