# 3D Crawler Spider Architecture & Interaction Plan

Upgrade the 3D Cyber Crawler Spider to deliver smooth 5-second crawling physics upon clicking any card or price tag, accurate `#DBFA6B` node styling with black outlines, and multi-tag leg touching within ±2.5% price range of current price tags ("現價").

## User Review & Critical Decisions

> [!IMPORTANT]
> The following interactive choices were confirmed by the user in Phase 1:

- **Confirmed Decision 1**: **全螢幕動態路徑巡檢 (Full-screen Dynamic Crawling)**
  - Clicking any card, section, or price tag triggers the spider to crawl from its current position across the screen to the target over a smooth 5-second duration (`duration: 5.0`).
- **Confirmed Decision 2**: **DBFA6B 黃綠色緩慢波紋 (Yellow-Green Wave Ripples)**
  - When reaching the target price tag (e.g. 現價), spider body movement stops completely (`isCrawling = false`). The 8 long legs extend outward and touch all nearby price tags (支撐/止損/壓力/止盈/歷史買入價/分批金字塔價格) within a ±2.5% price range, triggering gentle `#DBFA6B` wave ripples over each price tag.

---

## 1. Overview & Core Concept

- **What It Does**: The 3D Crawler is an interactive 3D WebGL cyber spider inspecting stock cards and technical price levels.
- **Target Audience / Persona**: Stock traders and chip analysts inspecting trading journals, price ladders, and averaging targets.
- **Key Value**: Provides an engaging visual inspection mechanic without obscuring price charts or card data, highlighting nearby price thresholds within ±2.5% of the current price ("現價").

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. User toggles `3D Crawler 巡檢` ON via the top header button.
  2. The slim left-top HUD ribbon banner (`fixed top-4 left-6`) displays active status, locked card name, and card navigation buttons without listing text tags.
  3. Clicking ANY card container, stock card, or price tag ("現價 $189.50") calculates target screen coordinates `(targetX, targetY)` immediately.
  4. The 3D spider rotates over 0.8s toward `(targetX, targetY)`, then gracefully crawls across the screen over **5.0 seconds** with continuous organic leg stepping (`walkCycle += 0.12`).
  5. Upon arrival at the price tag, the body stops moving. The 8 long legs reach out to touch all surrounding price tags within **±2.5%** price range (e.g. 支撐, 止損, 壓力, 止盈, 均本, 歷史買入價, 分批金字塔價格).
  6. Each touched price tag displays a gentle `#DBFA6B` yellow-green expanding wave ring ripple (`animate-ping`).

- **Visual Identity & Theme**:
  - *Spider Body*: Abstract vector wireframe (Hexagonal head + Diamond abdomen) in glowing cyan/emerald (`#34d399`), 0% solid color fill, semi-transparent wireframe lines.
  - *4x Long Legs*: 8 sprawling extra-long 3-segment wireframe legs with knee and tip joint spheres.
  - *#DBFA6B Outlined Nodes*: Sphere nodes filled with warm chartreuse yellow (`#DBFA6B`) and outlined with crisp black border rings (`#000000`).
  - *Left-Top HUD*: Slim horizontal glassmorphic ribbon (`bg-zinc-950/85 backdrop-blur-xl border-emerald-500/40 rounded-full sm:rounded-2xl`).

---

## 3. Technical Architecture & Component Mapping

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             src/Layout.tsx                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Fixed Top-Right Toolbar Button: <CrawlerSpider isActive={...} />       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      src/components/CrawlerSpider.tsx                       │
│                                                                             │
│ ┌───────────────────────────┐    ┌────────────────────────────────────────┐ │
│ │  Three.js WebGL Scene     │    │  Global Click & Target Extractor       │ │
│ │  - Orthographic Camera    │    │  - Capture event listener              │ │
│ │  - Hexagonal Head         │    │  - Finds clicked card & price tag      │ │
│ │  - Diamond Abdomen        │    │  - Extracts numeric price $P_{base}$    │ │
│ │  - 4x Long Wireframe Legs │    │  - Matches tags within ±2.5% price     │ │
│ │  - #DBFA6B Outlined Nodes │    └───────────────────┬────────────────────┘ │
│ └─────────────┬─────────────┘                        │                      │
│               │                                      │                      │
│               └───────────────────┬──────────────────┘                      │
│                                   ▼                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                     GSAP 5.0-Second Crawl Engine                        │ │
│ │  - Smooth rotation to (targetX, targetY) [0.8s]                         │ │
│ │  - Crawling translation over 5.0 seconds [duration: 5.0]                │ │
│ │  - Body halts; leg nodes touch nearby ±2.5% price tags                  │ │
│ │  - Triggers HTML #DBFA6B wave ripple animations                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Implementation Steps

1. **Universal Click Target Extractor**:
   - Register `window.addEventListener('click', handleCardClick, { capture: true })`.
   - On click, extract `targetEl`. Ignore HUD button clicks.
   - Match nearest card container using `targetEl.closest(...)` or fallback to parent container.
   - Detect clicked price tag or extract text (`現價`, `止盈`, `止損`, `支撐`, `壓力`, `均本`, `歷史買入價`, `分批金字塔價格`).
   - Extract numeric price value $P_{base}$.

2. **5-Second GSAP Crawling Motion**:
   - Calculate exact screen pixel coordinates `(targetX, targetY)`.
   - Rotate spider toward target over 0.8s.
   - Translate spider position `x, y` over **5.0 seconds** using GSAP (`duration: 5.0, ease: 'sine.inOut'`).
   - Increment `spiderPos.current.walkCycle += 0.12` continuously every frame.

3. **Multi-Tag ±2.5% Price Range Leg Touch**:
   - Query all price tags on the card.
   - Filter tags where $|P_{tag} - P_{base}| / P_{base} \le 0.025$.
   - Body freezes at destination; long legs extend and trigger gentle `#DBFA6B` wave ripples sequentially.

4. **#DBFA6B Nodes with Black Outlines**:
   - Construct Three.js joint nodes using `#DBFA6B` yellow-green sphere meshes paired with concentric black border wireframe rings.
