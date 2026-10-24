import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import gsap from 'gsap';
import { Crosshair } from 'lucide-react';
import { SpiderIcon } from './SpiderIcon';

interface CrawlerSpiderProps {
  isActive: boolean;
  onToggle: () => void;
  hideButton?: boolean;
}

interface PriceTagTouchTarget {
  id: string;
  name: string;
  category: string;
  price?: number;
  diffPercent?: number;
  x: number;
  y: number;
  element: HTMLElement;
}

interface WaveRippleItem {
  id: number;
  localX: number;
  localY: number;
}

export const CrawlerSpider: React.FC<CrawlerSpiderProps> = ({ isActive, onToggle, hideButton = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesContainerRef = useRef<HTMLDivElement>(null);

  // Card docking refs: Anchors spider to the specific card it crawled to
  const anchoredCardRef = useRef<HTMLElement | null>(null);
  const anchoredCardIdRef = useRef<string | null>(null);
  const crawlStartPos = useRef({ x: 0, y: 0 });

  // 60-Second Active Wave Ripples (#DBFA6B) - Pure rings, NO textual labels!
  const [waveRipples, setWaveRipples] = useState<WaveRippleItem[]>([]);

  // Three.js scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const spiderGroupRef = useRef<THREE.Group | null>(null);
  const spiderBodyRef = useRef<THREE.Group | null>(null);

  // Spider 8 Legs Dynamic IK State Ref
  interface LegController {
    baseGroup: THREE.Group;
    femurLine: THREE.Line;
    tibiaLine: THREE.Line;
    hipNode: THREE.Group;
    kneeNode: THREE.Group;
    tipNode: THREE.Group;
    tipGoldRingMat: THREE.MeshBasicMaterial;
    tipCoreMat: THREE.MeshBasicMaterial;
    isLeft: boolean;
    legIndex: number;
    femurLen: number;
    tibiaLen: number;
    baseX: number;
    baseY: number;
    defaultTipX: number;
    defaultTipY: number;
    currTipX: number;
    currTipY: number;
  }
  const legsRef = useRef<LegController[]>([]);

  // Spider state ref
  const spiderPos = useRef({
    x: typeof window !== 'undefined' ? window.innerWidth * 0.45 : 400,
    y: typeof window !== 'undefined' ? window.innerHeight * 0.35 : 300,
    z: 0,
    rotation: 0,
    crawlProgress: 0,
    isCrawling: false,
    isRestingOnTags: false,
    restingBlend: 0,
  });

  // Leg target positions when resting on price tags (in baseGroup local coordinates)
  const restingLegTargetsRef = useRef<Array<{ targetX: number; targetY: number; active: boolean }>>(
    Array.from({ length: 8 }, () => ({ targetX: 0, targetY: 0, active: false }))
  );

  // Active tween references
  const crawlTweenRef = useRef<gsap.core.Tween | null>(null);
  const rotationTweenRef = useRef<gsap.core.Tween | null>(null);
  const restingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rippleIdCounter = useRef(0);
  const highlightedElementsRef = useRef<HTMLElement[]>([]);

  // Helper: Extract numeric price value from text string (e.g., "$189.50" -> 189.5)
  const extractNumericPrice = (text: string): number | null => {
    if (!text) return null;
    const cleaned = text.replace(/,/g, '');
    const match = cleaned.match(/[\$¥NT]?\s*(\d+(\.\d+)?)/);
    if (!match) return null;
    const num = parseFloat(match[1]);
    return isNaN(num) ? null : num;
  };

  // Fade 60s ripples & highlights only; SPIDER REMAINS PERMANENTLY STATIONED in its resting M-shape pose!
  const fadeRipplesAfter60s = useCallback(() => {
    if (restingTimeoutRef.current) {
      clearTimeout(restingTimeoutRef.current);
      restingTimeoutRef.current = null;
    }
    setWaveRipples([]);
    highlightedElementsRef.current.forEach((el) => {
      try {
        el.style.removeProperty('box-shadow');
        el.style.removeProperty('outline');
      } catch (e) {}
    });
    highlightedElementsRef.current = [];
    // CRITICAL: Spider body and M-shaped resting legs REMAIN DOCKED & STATIONED in place!
  }, []);

  // Clear active 60s ripples & highlights when starting a NEW crawl trip
  const clearActiveRipplesAndHighlights = useCallback(() => {
    if (restingTimeoutRef.current) {
      clearTimeout(restingTimeoutRef.current);
      restingTimeoutRef.current = null;
    }
    setWaveRipples([]);
    highlightedElementsRef.current.forEach((el) => {
      try {
        el.style.removeProperty('box-shadow');
        el.style.removeProperty('outline');
      } catch (e) {
        // element may have unmounted
      }
    });
    highlightedElementsRef.current = [];

    // Reset resting leg targets
    restingLegTargetsRef.current.forEach((t) => {
      t.active = false;
    });
    spiderPos.current.isRestingOnTags = false;
    spiderPos.current.restingBlend = 0;
  }, []);

  // Helper: Find parent card container from an element (prefers outermost stock-card card-wrapper)
  const findParentCard = (el: HTMLElement | null): HTMLElement | null => {
    let curr: HTMLElement | null = el;
    let candidateCard: HTMLElement | null = null;
    while (curr && curr !== document.body) {
      if (curr.id?.startsWith('stock-card-') || curr.classList.contains('card-wrapper')) {
        return curr;
      }
      const r = curr.getBoundingClientRect();
      if (
        curr.getAttribute('data-card') ||
        curr.getAttribute('data-stock-card') ||
        curr.classList.contains('slide-drawer-container') ||
        curr.classList.contains('glass-card') ||
        (r.width >= 180 && r.height >= 120 && !curr.classList.contains('fixed') && r.width < 1400)
      ) {
        if (!candidateCard) candidateCard = curr;
      }
      curr = curr.parentElement;
    }
    return candidateCard;
  };

  // Collect relevant ±2% price tags (支撐 / 止損 / 歷史買入 / 壓力 / 攤平 / 突破 / 現價 / 均本)
  const collectPriceTagsAround = useCallback(
    (cardEl: HTMLElement | null, originX: number, originY: number): PriceTagTouchTarget[] => {
      if (typeof document === 'undefined') return [];

      const searchRoot = cardEl || document.body;

      // 1. Extract base current price (現價)
      let basePrice: number | null = null;
      const cpEl = searchRoot.querySelector('[data-is-cp="true"], [data-category="現價"]');
      if (cpEl) {
        const attrP = cpEl.getAttribute('data-price');
        if (attrP) basePrice = parseFloat(attrP);
        if (!basePrice || isNaN(basePrice)) {
          basePrice = extractNumericPrice((cpEl as HTMLElement).innerText || '');
        }
      }

      // 2. Collect candidate tags on the card
      const allElements = Array.from(
        searchRoot.querySelectorAll<HTMLElement>('*')
      ).filter((el) => {
        const text = (el.innerText || '').trim();
        const hasTagAttr = el.hasAttribute('data-price-tag') || el.hasAttribute('data-category') || el.hasAttribute('data-label-id');
        const hasPriceKeyword = /(現價|均本|成本|支撐|壓力|止盈|止損|歷史買入|買入|歷史|攤平|突破|\$[\d,]+(\.\d+)?|\b\d{2,6}\.\d{2}\b)/.test(text);
        if (!hasTagAttr && !hasPriceKeyword) return false;

        const rect = el.getBoundingClientRect();
        return rect.width > 8 && rect.width < 340 && rect.height > 8 && rect.height < 80;
      });

      // Filter to innermost specific badge elements
      const specificTags = allElements.filter(
        (tag, idx) =>
          !allElements.some(
            (other, oIdx) => oIdx !== idx && other.contains(tag) && other !== tag && other.clientHeight < 60
          )
      );

      // 3. Classify and score tags
      interface TagCandidate {
        element: HTMLElement;
        category: string;
        price?: number;
        diffPercent?: number;
        score: number;
        rect: DOMRect;
        centerX: number;
        centerY: number;
      }

      const candidates: TagCandidate[] = [];

      specificTags.forEach((el) => {
        const text = (el.innerText || '').trim();
        const attrCat = el.getAttribute('data-category');
        const attrPrice = el.getAttribute('data-price');

        let category = attrCat || '';
        if (!category) {
          if (text.includes('現價') || el.getAttribute('data-is-cp') === 'true') category = '現價';
          else if (text.includes('支撐')) category = '支撐';
          else if (text.includes('止損')) category = '止損';
          else if (text.includes('歷史買入') || (text.includes('買') && text.includes('股'))) category = '歷史買入';
          else if (text.includes('買入') || text.startsWith('買')) category = '買入';
          else if (text.includes('壓力')) category = '壓力';
          else if (text.includes('攤平')) category = '攤平';
          else if (text.includes('突破')) category = '突破';
          else if (text.includes('止盈')) category = '止盈';
          else if (text.includes('均本') || text.includes('成本')) category = '均本';
          else category = '價位';
        }

        let price: number | undefined = undefined;
        if (attrPrice) {
          const p = parseFloat(attrPrice);
          if (!isNaN(p)) price = p;
        }
        if (price === undefined) {
          const num = extractNumericPrice(text);
          if (num !== null) price = num;
        }

        let diffPercent: number | undefined = undefined;
        let isWithin2Pct = false;
        let isWithin3Pct = false;

        if (basePrice && basePrice > 0 && price && price > 0) {
          const diff = Math.abs(price - basePrice) / basePrice;
          diffPercent = diff * 100;
          isWithin2Pct = diff <= 0.021; // Within ±2%
          isWithin3Pct = diff <= 0.035; // Within ±3.5%
        }

        let score = 10;
        const isCoreStructureCategory = ['支撐', '止損', '歷史買入', '買入', '壓力', '攤平', '突破'].includes(category);

        if (isCoreStructureCategory && isWithin2Pct) {
          score = 100;
        } else if (isCoreStructureCategory && isWithin3Pct) {
          score = 80;
        } else if (isWithin2Pct) {
          score = 70;
        } else if (isCoreStructureCategory) {
          score = 60;
        } else if (category === '現價') {
          score = 55;
        } else if (['均本', '止盈'].includes(category)) {
          score = 50;
        }

        const rect = el.getBoundingClientRect();
        candidates.push({
          element: el,
          category,
          price,
          diffPercent,
          score,
          rect,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
        });
      });

      // Filter duplicate physical coordinates (keep highest score)
      const uniqueCandidates: TagCandidate[] = [];
      candidates.forEach((cand) => {
        const existing = uniqueCandidates.find(
          (u) => Math.hypot(u.centerX - cand.centerX, u.centerY - cand.centerY) < 16
        );
        if (!existing) {
          uniqueCandidates.push(cand);
        } else if (cand.score > existing.score) {
          const idx = uniqueCandidates.indexOf(existing);
          uniqueCandidates[idx] = cand;
        }
      });

      // Sort by score DESC, then by diffPercent ASC
      uniqueCandidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.diffPercent !== undefined && b.diffPercent !== undefined) {
          return a.diffPercent - b.diffPercent;
        }
        const distA = Math.hypot(a.centerX - originX, a.centerY - originY);
        const distB = Math.hypot(b.centerX - originX, b.centerY - originY);
        return distA - distB;
      });

      // Build target list
      const resultTargets: PriceTagTouchTarget[] = uniqueCandidates.map((c, i) => ({
        id: `tag-${i}-${Date.now()}`,
        name: c.element.innerText.trim().slice(0, 12),
        category: c.category,
        price: c.price,
        diffPercent: c.diffPercent,
        x: c.centerX,
        y: c.centerY,
        element: c.element,
      }));

      return resultTargets.slice(0, 8);
    },
    []
  );

  // Apply Resting Leg Pose on Tags & 60-Second Wave Ripples (No extra info labels shown on tags)
  // Ensure NO feet or knees ever exceed the card boundary; non-touching legs strictly maintain M-shape posture
  const applyRestingLegsOnPriceTags = useCallback(
    (tags: PriceTagTouchTarget[], targetCard?: HTMLElement | null) => {
      clearActiveRipplesAndHighlights();

      spiderPos.current.isRestingOnTags = true;
      spiderPos.current.isCrawling = false;
      spiderPos.current.restingBlend = 1;

      // Settle rotation to upright (0 rad) aligned with the card
      let settleDiff = (0 - spiderPos.current.rotation) % (Math.PI * 2);
      if (settleDiff > Math.PI) settleDiff -= Math.PI * 2;
      if (settleDiff < -Math.PI) settleDiff += Math.PI * 2;
      gsap.to(spiderPos.current, {
        rotation: spiderPos.current.rotation + settleDiff,
        duration: 0.45,
        ease: 'power2.out',
      });

      // Spider body is centered on the card:
      const currentSpiderX = spiderPos.current.x;
      const currentSpiderY = spiderPos.current.y;

      // Determine real card dimensions for safe internal boundary clamping
      const cardEl = targetCard || anchoredCardRef.current;
      const cardRect = cardEl ? cardEl.getBoundingClientRect() : null;
      const cardW = cardRect ? cardRect.width : 480;
      const cardH = cardRect ? cardRect.height : 640;

      // Safe internal margins (feet stay at least 24px inside card edges, preventing any leg parts from extending outside)
      const safePadX = 24;
      const safePadY = 24;
      const minLocalX = -cardW / 2 + safePadX;
      const maxLocalX = cardW / 2 - safePadX;
      const minLocalY = -cardH / 2 + safePadY;
      const maxLocalY = cardH / 2 - safePadY;

      const newRipples: WaveRippleItem[] = [];

      // Calculate relative coordinates to spider body (with rotation = 0)
      const mappedTargets = tags.map((tag) => {
        const rawLocalX = tag.x - currentSpiderX;
        const rawLocalY = tag.y - currentSpiderY;
        // Clamp price tag targets within safe card bounds
        const localX = Math.max(minLocalX, Math.min(maxLocalX, rawLocalX));
        const localY = Math.max(minLocalY, Math.min(maxLocalY, rawLocalY));
        return { tag, localX, localY };
      });

      // STRICT ANATOMICAL QUADRANT SEPARATION (No Leg Crossing! Left legs only left, Right legs only right)
      const leftTargets = mappedTargets.filter((t) => t.localX < 0).sort((a, b) => a.localY - b.localY);
      const rightTargets = mappedTargets.filter((t) => t.localX >= 0).sort((a, b) => a.localY - b.localY);

      const leftLegIndices = [0, 1, 2, 3]; // L1 (Front-L), L2 (Mid-F-L), L3 (Mid-R-L), L4 (Rear-L)
      const rightLegIndices = [4, 5, 6, 7]; // R1 (Front-R), R2 (Mid-F-R), R3 (Mid-R-R), R4 (Rear-R)

      // Dynamic supportive stance anchors strictly scaled within the card (M-shape peaks)
      const spreadX = Math.min(180, Math.max(120, cardW * 0.36));
      const wideX = Math.min(205, Math.max(135, cardW * 0.41));
      const frontY = Math.max(minLocalY + 15, -cardH * 0.30);
      const midFrontY = -cardH * 0.08;
      const midRearY = cardH * 0.12;
      const rearY = Math.min(maxLocalY - 15, cardH * 0.30);

      const defaultStanceAnchors = [
        { x: -spreadX, y: frontY },   // L1 Front-Left (high upward M arch)
        { x: -wideX,   y: midFrontY }, // L2 Mid-Front-Left
        { x: -wideX,   y: midRearY },  // L3 Mid-Rear-Left
        { x: -spreadX, y: rearY },    // L4 Rear-Left
        { x: spreadX,  y: frontY },   // R1 Front-Right (high upward M arch)
        { x: wideX,    y: midFrontY }, // R2 Mid-Front-Right
        { x: wideX,    y: midRearY },  // R3 Mid-Rear-Right
        { x: spreadX,  y: rearY },    // R4 Rear-Right
      ];

      // Assign Left Legs
      leftLegIndices.forEach((legIdx, i) => {
        if (i < leftTargets.length) {
          const target = leftTargets[i];
          const clampedX = Math.max(minLocalX, Math.min(-65, target.localX));
          const clampedY = Math.max(minLocalY, Math.min(maxLocalY, target.localY));

          restingLegTargetsRef.current[legIdx] = {
            targetX: clampedX,
            targetY: clampedY,
            active: true,
          };

          // Ripples: Multi-colored prismatic wave rings ONLY on specific legs that touch a price tag
          newRipples.push({
            id: ++rippleIdCounter.current,
            localX: clampedX,
            localY: clampedY,
          });
        } else {
          // Unassigned left leg takes supportive anchor stance strictly within card (keeping M-shape, NO ripple)
          const anchor = defaultStanceAnchors[legIdx];
          const clampedX = Math.max(minLocalX, Math.min(-65, anchor.x));
          const clampedY = Math.max(minLocalY, Math.min(maxLocalY, anchor.y));
          restingLegTargetsRef.current[legIdx] = {
            targetX: clampedX,
            targetY: clampedY,
            active: false,
          };
        }
      });

      // Assign Right Legs
      rightLegIndices.forEach((legIdx, i) => {
        const rightOffset = legIdx - 4;
        if (rightOffset < rightTargets.length) {
          const target = rightTargets[rightOffset];
          const clampedX = Math.min(maxLocalX, Math.max(65, target.localX));
          const clampedY = Math.max(minLocalY, Math.min(maxLocalY, target.localY));

          restingLegTargetsRef.current[legIdx] = {
            targetX: clampedX,
            targetY: clampedY,
            active: true,
          };

          // Ripples: Multi-colored prismatic wave rings ONLY on specific legs that touch a price tag
          newRipples.push({
            id: ++rippleIdCounter.current,
            localX: clampedX,
            localY: clampedY,
          });
        } else {
          // Unassigned right leg takes supportive anchor stance strictly within card (keeping M-shape, NO ripple)
          const anchor = defaultStanceAnchors[legIdx];
          const clampedX = Math.min(maxLocalX, Math.max(65, anchor.x));
          const clampedY = Math.max(minLocalY, Math.min(maxLocalY, anchor.y));
          restingLegTargetsRef.current[legIdx] = {
            targetX: clampedX,
            targetY: clampedY,
            active: false,
          };
        }
      });

      setWaveRipples(newRipples);

      // Keep ripples active for 60 SECONDS; spider stays stationed in its resting M-shape pose!
      restingTimeoutRef.current = setTimeout(() => {
        fadeRipplesAfter60s();
      }, 60000);
    },
    [clearActiveRipplesAndHighlights, fadeRipplesAfter60s]
  );

  // Core Crawl Function: Crawl spider smoothly over 3.5 SECONDS to Card Center with deliberate mantis steps
  // Head faces in the direction of the target price tag and card without crawling backwards
  const crawlToCoords = useCallback(
    (
      centerCardX: number,
      centerCardY: number,
      targetCard: HTMLElement | null,
      clickedTag: HTMLElement | null
    ) => {
      clearActiveRipplesAndHighlights();

      // Lock anchored target card
      anchoredCardRef.current = targetCard;
      anchoredCardIdRef.current = targetCard?.id || null;

      const startX = spiderPos.current.x;
      const startY = spiderPos.current.y;
      crawlStartPos.current = { x: startX, y: startY };

      // Calculate direction of travel towards the clicked price tag and card
      const targetTagRect = clickedTag ? clickedTag.getBoundingClientRect() : null;
      const tagCenterX = targetTagRect ? targetTagRect.left + targetTagRect.width / 2 : centerCardX;
      const tagCenterY = targetTagRect ? targetTagRect.top + targetTagRect.height / 2 : centerCardY;

      // Primary trajectory vector towards destination
      const moveDx = tagCenterX - startX;
      const moveDy = tagCenterY - startY;

      // Head is at local (0, -1). Under rotation R = atan2(moveDy, moveDx) + PI/2,
      // the head faces precisely along the vector (moveDx, moveDy) towards the target!
      const targetAngle = Math.atan2(moveDy, moveDx) + Math.PI / 2;

      // Turn along shortest angular distance so spider turns cleanly
      let angleDiff = (targetAngle - spiderPos.current.rotation) % (Math.PI * 2);
      if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      const smoothTargetAngle = spiderPos.current.rotation + angleDiff;

      spiderPos.current.isCrawling = true;
      spiderPos.current.isRestingOnTags = false;
      spiderPos.current.crawlProgress = 0;

      // Kill previous tweens
      if (crawlTweenRef.current) crawlTweenRef.current.kill();
      if (rotationTweenRef.current) rotationTweenRef.current.kill();

      // 1. Rotate body so HEAD faces towards the target price tag
      rotationTweenRef.current = gsap.to(spiderPos.current, {
        rotation: smoothTargetAngle,
        duration: 0.45,
        ease: 'power2.out',
      });

      // 2. Smooth 3.5-Second Crawling Journey to CARD CENTER (螳螂式沉穩步伐，頭朝向標籤爬過來)
      crawlTweenRef.current = gsap.to(spiderPos.current, {
        crawlProgress: 1, // Progresses from 0 to 1 over 3.5s
        duration: 3.5,
        ease: 'power1.inOut',
        onComplete: () => {
          spiderPos.current.isCrawling = false;
          spiderPos.current.crawlProgress = 1;

          // Arrived at Card Center! Settle rotation back to 0 (upright relative to card) along shortest arc
          let settleDiff = (0 - spiderPos.current.rotation) % (Math.PI * 2);
          if (settleDiff > Math.PI) settleDiff -= Math.PI * 2;
          if (settleDiff < -Math.PI) settleDiff += Math.PI * 2;
          gsap.to(spiderPos.current, {
            rotation: spiderPos.current.rotation + settleDiff,
            duration: 0.45,
            ease: 'power2.out',
          });

          // Fetch fresh card position at arrival (in case card moved/scrolled during crawl)
          let cardEl = anchoredCardRef.current;
          if (cardEl && !document.contains(cardEl) && anchoredCardIdRef.current) {
            const reFound = document.getElementById(anchoredCardIdRef.current);
            if (reFound) {
              anchoredCardRef.current = reFound;
              cardEl = reFound;
            }
          }
          const currRect = cardEl ? cardEl.getBoundingClientRect() : null;
          const currX = currRect ? currRect.left + currRect.width / 2 : centerCardX;
          const currY = currRect ? currRect.top + currRect.height / 2 : centerCardY;
          spiderPos.current.x = currX;
          spiderPos.current.y = currY;

          // Feet reach out and stay resting on the specified price tags (支撐/止損/歷史買入/壓力/攤平/突破/現價)
          // Clamped strictly within card boundaries so no leg exceeds the card!
          const tags = collectPriceTagsAround(cardEl || targetCard, currX, currY);
          applyRestingLegsOnPriceTags(tags, cardEl || targetCard);
        },
      });
    },
    [clearActiveRipplesAndHighlights, collectPriceTagsAround, applyRestingLegsOnPriceTags]
  );

  // Three.js Render Geometric Wireframe Spider with Golden Yellow Nodes & Semi-Transparent Resting Tips
  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(0, width, 0, height, -1000, 1000);
    camera.position.z = 500;
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    const spiderGroup = new THREE.Group();
    spiderGroupRef.current = spiderGroup;
    scene.add(spiderGroup);

    const spiderBody = new THREE.Group();
    spiderBodyRef.current = spiderBody;
    spiderGroup.add(spiderBody);

    // Wireframe Line Materials (Semi-transparent, NO solid color fill)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x34d399, // Glowing Emerald Cyan lines
      transparent: true,
      opacity: 0.88,
    });

    const thinLineMaterial = new THREE.LineBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.65,
    });

    // GOLDEN YELLOW Materials for Nodes (金黃色節點，原黑色節點全數改為金黃色)
    const goldNodeMaterial = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // Luminous Amber Gold (#F59E0B)
    });

    const goldCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0xfacc15, // Bright Golden Yellow (#FACC15)
    });

    const goldOutlineMaterial = new THREE.MeshBasicMaterial({
      color: 0xd97706, // Deep Golden Yellow Outline (#D97706)
      wireframe: true,
    });

    // Helper: Create a node sphere with Golden Yellow color and Golden Yellow wireframe outline
    const createGoldOutlinedNode = (radius: number) => {
      const group = new THREE.Group();

      const sphereGeo = new THREE.SphereGeometry(radius, 12, 12);
      const sphereMesh = new THREE.Mesh(sphereGeo, goldCoreMaterial);
      group.add(sphereMesh);

      const outlineGeo = new THREE.SphereGeometry(radius * 1.35, 8, 8);
      const outlineMesh = new THREE.Mesh(outlineGeo, goldOutlineMaterial);
      group.add(outlineMesh);

      return group;
    };

    // Helper: Create a leg tip double-ring node with dynamic opacity support (金黃色 + 停留在標籤時半透明)
    const createDynamicTipNode = () => {
      const group = new THREE.Group();

      // Outer Golden Yellow Ring (formerly black ring, now golden yellow)
      const ringGeo = new THREE.RingGeometry(3.6, 5.8, 14);
      const tipGoldRingMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b, // 金黃色
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      });
      const ringMesh = new THREE.Mesh(ringGeo, tipGoldRingMat);
      group.add(ringMesh);

      // Core Golden Yellow / Chartreuse Disc
      const coreGeo = new THREE.CircleGeometry(2.8, 14);
      const tipCoreMat = new THREE.MeshBasicMaterial({
        color: 0xdbfa6b, // #DBFA6B
        transparent: true,
        opacity: 0.95,
      });
      const coreMesh = new THREE.Mesh(coreGeo, tipCoreMat);
      coreMesh.position.z = 0.1;
      group.add(coreMesh);

      return { group, tipGoldRingMat, tipCoreMat };
    };

    // 1. Central Hexagonal Head Outline (Cephalothorax at FRONT: negative Y)
    const hexPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const angle = (i * Math.PI) / 3;
      hexPoints.push(new THREE.Vector3(Math.cos(angle) * 14, -18 + Math.sin(angle) * 14, 0));
    }
    const hexGeo = new THREE.BufferGeometry().setFromPoints(hexPoints);
    const hexMesh = new THREE.Line(hexGeo, lineMaterial);
    spiderBody.add(hexMesh);

    // Front Pincers / Pedipalps (front of head, pointing forward)
    const pedipalpsGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-4, -30, 0),
      new THREE.Vector3(-2, -37, 0),
      new THREE.Vector3(4, -30, 0),
      new THREE.Vector3(2, -37, 0),
    ]);
    const pedipalpsMesh = new THREE.LineSegments(pedipalpsGeo, thinLineMaterial);
    spiderBody.add(pedipalpsMesh);

    // 2. Central Diamond Abdomen Outline (at REAR: positive Y)
    const diamondPoints = [
      new THREE.Vector3(0, 10, 0),
      new THREE.Vector3(14, 30, 0),
      new THREE.Vector3(0, 52, 0),
      new THREE.Vector3(-14, 30, 0),
      new THREE.Vector3(0, 10, 0),
    ];
    const diamondGeo = new THREE.BufferGeometry().setFromPoints(diamondPoints);
    const diamondMesh = new THREE.Line(diamondGeo, lineMaterial);
    spiderBody.add(diamondMesh);

    // Inner geometric connecting web lines
    const innerWebGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-8, 6, 0),
      new THREE.Vector3(-14, 30, 0),
      new THREE.Vector3(8, 6, 0),
      new THREE.Vector3(14, 30, 0),
    ]);
    const innerWebMesh = new THREE.LineSegments(innerWebGeo, thinLineMaterial);
    spiderBody.add(innerWebMesh);

    // 3. Spider Body Golden Yellow Nodes (身上的黑色節點全部為金黃色)
    const headNode = createGoldOutlinedNode(3.2);
    headNode.position.set(0, -22, 0.5); // Head at FRONT
    spiderBody.add(headNode);

    const thoraxNode = createGoldOutlinedNode(3.6);
    thoraxNode.position.set(0, 0, 0.5); // Thorax at CENTER
    spiderBody.add(thoraxNode);

    const abdomenNode = createGoldOutlinedNode(3.0);
    abdomenNode.position.set(0, 32, 0.5); // Abdomen at REAR
    spiderBody.add(abdomenNode);

    // 4. Construct 8 Proportionate Legs (femur 88-98px, tibia 155-175px: fits within card boundaries)
    const legs: LegController[] = [];
    legsRef.current = legs;

    const legConfigs = [
      { femurLen: 88, tibiaLen: 155, baseAngle: -0.75 }, // L1/R1 Front (pointing forward-outward towards negative Y)
      { femurLen: 92, tibiaLen: 165, baseAngle: -0.22 }, // L2/R2 Mid-Front
      { femurLen: 92, tibiaLen: 165, baseAngle: 0.22 },  // L3/R3 Mid-Rear
      { femurLen: 98, tibiaLen: 175, baseAngle: 0.75 },  // L4/R4 Rear (pointing rear-outward towards positive Y)
    ];

    for (let i = 0; i < 8; i++) {
      const isLeft = i < 4;
      const legIndex = i % 4;
      const config = legConfigs[legIndex];

      const baseGroup = new THREE.Group();
      const yOffset = (legIndex - 1.5) * 11;
      const xOffset = isLeft ? -14 : 14;
      baseGroup.position.set(xOffset, yOffset, 0);

      // Hip Node: Golden Yellow (金黃色節點)
      const hipNode = createGoldOutlinedNode(2.9);
      baseGroup.add(hipNode);

      // Femur Line (dynamic BufferGeometry)
      const femurGeo = new THREE.BufferGeometry();
      const femurPositions = new Float32Array([0, 0, 0, 0, 0, 0]);
      femurGeo.setAttribute('position', new THREE.BufferAttribute(femurPositions, 3));
      const femurLine = new THREE.Line(femurGeo, lineMaterial);
      baseGroup.add(femurLine);

      // Knee Node: Golden Yellow (金黃色節點)
      const kneeNode = createGoldOutlinedNode(3.2);
      baseGroup.add(kneeNode);

      // Tibia Line (dynamic BufferGeometry)
      const tibiaGeo = new THREE.BufferGeometry();
      const tibiaPositions = new Float32Array([0, 0, 0, 0, 0, 0]);
      tibiaGeo.setAttribute('position', new THREE.BufferAttribute(tibiaPositions, 3));
      const tibiaLine = new THREE.Line(tibiaGeo, lineMaterial);
      baseGroup.add(tibiaLine);

      // Tip Node: Golden Yellow Outer Ring + Disc with Dynamic Translucency
      const { group: tipNode, tipGoldRingMat, tipCoreMat } = createDynamicTipNode();
      baseGroup.add(tipNode);

      // Default stance foot position (proportionate to stay within card)
      const defaultAngle = config.baseAngle + (isLeft ? -0.15 : 0.15);
      const totalLen = (config.femurLen + config.tibiaLen) * 0.72;
      const defaultTipX = (isLeft ? -1 : 1) * Math.cos(defaultAngle) * totalLen;
      const defaultTipY = Math.sin(defaultAngle) * totalLen;

      spiderBody.add(baseGroup);

      legs.push({
        baseGroup,
        femurLine,
        tibiaLine,
        hipNode,
        kneeNode,
        tipNode,
        tipGoldRingMat,
        tipCoreMat,
        isLeft,
        legIndex,
        femurLen: config.femurLen,
        tibiaLen: config.tibiaLen,
        baseX: xOffset,
        baseY: yOffset,
        defaultTipX,
        defaultTipY,
        currTipX: defaultTipX,
        currTipY: defaultTipY,
      });
    }

    // Animation Render Loop
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const p = spiderPos.current;

      // 1. CARD-ANCHORED REAL-TIME POSITION TRACKING
      // "蜘蛛的位置駐留. 是指在觸動到的卡片上.若已經切換看其他卡片. 但沒有觸動現價標籤. 蜘蛛仍停留在原本觸動到的卡片上 (既使已經超出螢幕外 蜘蛛仍停在該卡片上)"
      if (anchoredCardRef.current) {
        let cardEl = anchoredCardRef.current;
        if (!document.contains(cardEl) && anchoredCardIdRef.current) {
          const reFound = document.getElementById(anchoredCardIdRef.current);
          if (reFound) {
            anchoredCardRef.current = reFound;
            cardEl = reFound;
          }
        }

        if (document.contains(cardEl)) {
          const r = cardEl.getBoundingClientRect();
          const targetCardCenterX = r.left + r.width / 2;
          const targetCardCenterY = r.top + r.height / 2;

          if (p.isRestingOnTags) {
            // Firmly docked to this specific card's center:
            // Follows the card when scrolling page up/down, dragging carousel left/right,
            // or when the card moves outside viewport (超出螢幕外仍駐留於該卡片)
            p.x = targetCardCenterX;
            p.y = targetCardCenterY;
          } else if (p.isCrawling) {
            // While crawling: smoothly steer towards the card's real-time center
            const t = p.crawlProgress;
            p.x = crawlStartPos.current.x + (targetCardCenterX - crawlStartPos.current.x) * t;
            p.y = crawlStartPos.current.y + (targetCardCenterY - crawlStartPos.current.y) * t;
          }
        }
      }

      spiderGroup.position.set(p.x, p.y, p.z);
      spiderGroup.rotation.z = p.rotation;

      // Update ripples container transform to follow card/spider in lock-step
      if (ripplesContainerRef.current) {
        ripplesContainerRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      }

      const isCrawling = p.isCrawling;
      const isResting = p.isRestingOnTags;
      const crawlProgress = p.crawlProgress;

      // Mantis creeping gait: 4 deliberate, steady strides during 3.5s journey (像爬蟲類一步一步爬，不快速晃動)
      const totalStrides = 4.0;
      const strideCycle = (crawlProgress * totalStrides) % 1.0;

      // Update each leg's positions and joint IK
      legs.forEach((leg, idx) => {
        const restingTarget = restingLegTargetsRef.current[idx];

        let targetTipX = leg.defaultTipX;
        let targetTipY = leg.defaultTipY;

        const isRestingOnTag = isResting && restingTarget && restingTarget.active;

        if (isRestingOnTag) {
          // RESTING ON PRICE TAG: The leg tip stays firmly planted on the price tag!
          // Convert from spiderGroup local coordinate to baseGroup local coordinate
          targetTipX = restingTarget.targetX - leg.baseX;
          targetTipY = restingTarget.targetY - leg.baseY;
        } else if (isCrawling) {
          // DELIBERATE STEP-BY-STEP MANTIS GAIT:
          // Alternating tetrapod groups:
          // Group 1: Legs [0, 2, 5, 7] (L1, L3, R2, R4)
          // Group 2: Legs [1, 3, 4, 6] (L2, L4, R1, R3)
          const isGroup1 = [0, 2, 5, 7].includes(idx);
          const phaseOffset = isGroup1 ? 0 : 0.5;
          const legPhase = (strideCycle + phaseOffset) % 1.0;

          const strideLength = 46;

          if (legPhase < 0.5) {
            // SWING PHASE (Deliberate lift & step forward, high steady knee):
            const swingT = legPhase / 0.5;
            const reachProgress = -Math.cos(swingT * Math.PI);
            const forwardOffset = (reachProgress * strideLength) / 2;
            const lateralOffset = Math.sin(swingT * Math.PI) * 12 * (leg.isLeft ? -1 : 1);

            targetTipX = leg.defaultTipX + lateralOffset;
            targetTipY = leg.defaultTipY + forwardOffset;
          } else {
            // STANCE PHASE (Firmly planted on ground, steady support):
            const stanceT = (legPhase - 0.5) / 0.5;
            const reachProgress = Math.cos(stanceT * Math.PI);
            const forwardOffset = (reachProgress * strideLength) / 2;

            targetTipX = leg.defaultTipX;
            targetTipY = leg.defaultTipY + forwardOffset;
          }
        } else {
          // IDLE STANCE: Very slow, subtle organic breathing
          const breathe = Math.sin(Date.now() * 0.0012 + idx) * 2.0;
          targetTipX = leg.defaultTipX + (leg.isLeft ? -breathe : breathe);
          targetTipY = leg.defaultTipY + breathe * 0.4;
        }

        // Smoothly interpolate current leg tip coordinates (mantis: smooth, steady lerp)
        const lerpFactor = isCrawling ? 0.28 : 0.18;
        leg.currTipX += (targetTipX - leg.currTipX) * lerpFactor;
        leg.currTipY += (targetTipY - leg.currTipY) * lerpFactor;

        // DYNAMIC TRANSLUCENCY REQUIREMENT:
        // "停留在節點標籤上的節點變成半透明 (以方便觀察其停留的價格標籤)"
        // When resting on a price tag, tip node opacity drops to 0.35 (semi-transparent)!
        // When crawling or in idle stance, opacity returns to 0.95!
        const targetTipOpacity = isRestingOnTag ? 0.35 : 0.95;
        leg.tipGoldRingMat.opacity += (targetTipOpacity - leg.tipGoldRingMat.opacity) * 0.15;
        leg.tipCoreMat.opacity += (targetTipOpacity - leg.tipCoreMat.opacity) * 0.15;

        // 2-Link Analytical IK solver with STRICT M-SHAPE POSTURE GUARANTEE
        // "蜘蛛停留的時候. 腳是呈現M 形狀 而不是有的呈現W形狀."
        // An M-shape requires the knee (joint between femur & tibia) to arch HIGH UPWARDS
        // like a peak (/\), and NEVER sag downwards into a valley (\/).
        const dist = Math.hypot(leg.currTipX, leg.currTipY);
        const maxReach = leg.femurLen + leg.tibiaLen - 2;
        const minReach = Math.abs(leg.tibiaLen - leg.femurLen) + 12;
        const clampedDist = Math.max(minReach, Math.min(dist, maxReach));

        const alpha = Math.atan2(leg.currTipY, leg.currTipX);

        const cosKnee =
          (leg.femurLen * leg.femurLen + clampedDist * clampedDist - leg.tibiaLen * leg.tibiaLen) /
          (2 * leg.femurLen * clampedDist);
        const kneeOffset = Math.acos(Math.max(-1, Math.min(1, cosKnee)));

        // The two circle-intersection solutions for the knee:
        const kA_x = Math.cos(alpha - kneeOffset) * leg.femurLen;
        const kA_y = Math.sin(alpha - kneeOffset) * leg.femurLen;

        const kB_x = Math.cos(alpha + kneeOffset) * leg.femurLen;
        const kB_y = Math.sin(alpha + kneeOffset) * leg.femurLen;

        let kneeX = kA_x;
        let kneeY = kA_y;

        if (leg.isLeft) {
          // Left leg M-shape: Knee must arch outward (kneeX < -8) and arch high upward (smaller Y)
          const aOutward = kA_x < -8;
          const bOutward = kB_x < -8;
          if (aOutward && bOutward) {
            // Both outward: strictly pick the one arching higher upwards (smaller Y in screen coords) for M-apex
            if (kB_y < kA_y) {
              kneeX = kB_x;
              kneeY = kB_y;
            } else {
              kneeX = kA_x;
              kneeY = kA_y;
            }
          } else if (bOutward) {
            kneeX = kB_x;
            kneeY = kB_y;
          } else {
            kneeX = kA_x;
            kneeY = kA_y;
          }
        } else {
          // Right leg M-shape: Knee must arch outward (kneeX > 8) and arch high upward (smaller Y)
          const aOutward = kA_x > 8;
          const bOutward = kB_x > 8;
          if (aOutward && bOutward) {
            // Both outward: strictly pick the one arching higher upwards (smaller Y in screen coords) for M-apex
            if (kB_y < kA_y) {
              kneeX = kB_x;
              kneeY = kB_y;
            } else {
              kneeX = kA_x;
              kneeY = kA_y;
            }
          } else if (bOutward) {
            kneeX = kB_x;
            kneeY = kB_y;
          } else {
            kneeX = kA_x;
            kneeY = kA_y;
          }
        }

        // Elevate Knee in 3D (Z = 34px) towards camera to form prominent 3D M-shaped arch
        const kneeZ = 34;

        // Update Knee Node position
        leg.kneeNode.position.set(kneeX, kneeY, kneeZ);

        // Update Tip Node position (ground level Z = 0)
        leg.tipNode.position.set(leg.currTipX, leg.currTipY, 0);

        // Update Femur Line geometry (Hip at 0,0,0 -> Knee at kneeX, kneeY, kneeZ)
        const femurAttr = leg.femurLine.geometry.attributes.position as THREE.BufferAttribute;
        femurAttr.setXYZ(0, 0, 0, 0);
        femurAttr.setXYZ(1, kneeX, kneeY, kneeZ);
        femurAttr.needsUpdate = true;

        // Update Tibia Line geometry (Knee at kneeX, kneeY, kneeZ -> Tip at currTipX, currTipY, 0)
        const tibiaAttr = leg.tibiaLine.geometry.attributes.position as THREE.BufferAttribute;
        tibiaAttr.setXYZ(0, kneeX, kneeY, kneeZ);
        tibiaAttr.setXYZ(1, leg.currTipX, leg.currTipY, 0);
        tibiaAttr.needsUpdate = true;
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      if (cameraRef.current) {
        cameraRef.current.right = w;
        cameraRef.current.bottom = h;
        cameraRef.current.updateProjectionMatrix();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      clearActiveRipplesAndHighlights();
    };
  }, [isActive, clearActiveRipplesAndHighlights]);

  // Global Click Listeners (Capture Phase)
  // CRITICAL REQUIREMENT:
  // "當滑鼠點向網頁背景時候. 蜘蛛不需要任何觸動動作發生. 也取消點選卡片時候 蜘蛛爬過來的觸發動作. 唯有點擊卡片的現價標籤才會觸發動作"
  useEffect(() => {
    if (!isActive) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Ignore clicks on crawler toggle button
      if (target.closest('[data-crawler-toggle]')) {
        return;
      }

      // Check if clicked element is strictly the card's CURRENT PRICE (現價) tag
      let clickedCpTag: HTMLElement | null = null;
      let curr: HTMLElement | null = target;
      while (curr && curr !== document.body) {
        const isCpMarked =
          curr.getAttribute('data-is-cp') === 'true' ||
          curr.getAttribute('data-category') === '現價' ||
          curr.id === 'cp' ||
          curr.getAttribute('data-label-id') === 'cp';

        const text = (curr.innerText || '').trim();
        const isCpText =
          (text.startsWith('現價') || text === '現價' || (text.includes('現價') && text.includes('$'))) &&
          curr.clientWidth > 8 &&
          curr.clientWidth < 320 &&
          curr.clientHeight > 8 &&
          curr.clientHeight < 80;

        if (isCpMarked || isCpText) {
          clickedCpTag = curr;
          break;
        }

        // Stop checking upward if we hit a card container boundary without finding cp tag
        if (
          curr.getAttribute('data-card') ||
          curr.getAttribute('data-stock-card') ||
          curr.id?.startsWith('stock-card-') ||
          curr.classList.contains('card-wrapper')
        ) {
          break;
        }

        curr = curr.parentElement;
      }

      // If clicked element is NOT the "現價" tag:
      // Clicking background: ignored!
      // Clicking card body/header: ignored!
      // Clicking other buttons/tags: ignored!
      if (!clickedCpTag) {
        return;
      }

      // Find the parent card containing this "現價" tag
      const targetCard = findParentCard(clickedCpTag);
      if (!targetCard) return;

      const cardRect = targetCard.getBoundingClientRect();
      const centerCardX = cardRect.left + cardRect.width / 2;
      const centerCardY = cardRect.top + cardRect.height / 2;

      // Crawl smoothly to the CARD CENTER over 3.5s with deliberate mantis steps
      crawlToCoords(centerCardX, centerCardY, targetCard, clickedCpTag);
    };

    window.addEventListener('click', handleGlobalClick, { capture: true });
    document.addEventListener('click', handleGlobalClick, { capture: true });

    return () => {
      window.removeEventListener('click', handleGlobalClick, { capture: true });
      document.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, [isActive, crawlToCoords]);

  return (
    <>
      {/* Top Header Toggle Control Button (Optional floating toggle) */}
      {!hideButton && (
        <button
          data-crawler-toggle="true"
          onClick={onToggle}
          className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-300 shadow-sm border cursor-pointer ${
            isActive
              ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-105'
              : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60 hover:text-white backdrop-blur-md'
          }`}
          title="開啟 / 關閉 3D Crawler 蜘蛛籌碼巡檢"
        >
          <div className="relative flex items-center justify-center">
            <SpiderIcon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'animate-bounce text-white' : ''}`} />
            {isActive && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-300 rounded-full animate-ping" />
            )}
          </div>
          <span>{isActive ? '3D 蜘蛛巡檢 ON' : '3D Crawler 巡檢'}</span>
          <Crosshair className="w-3.5 h-3.5 opacity-70" />
        </button>
      )}

      {/* 3D WebGL Canvas Overlay mounted to body via Portal (No screenshot info HUD banner!) */}
      {isActive &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[998] pointer-events-none overflow-hidden select-none">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* 60-Second Clean Wave Ripples on Touched Price Tags (Dynamically anchored to card) */}
            <div
              ref={ripplesContainerRef}
              className="absolute left-0 top-0 pointer-events-none will-change-transform"
              style={{
                transform: `translate3d(${spiderPos.current.x}px, ${spiderPos.current.y}px, 0)`,
              }}
            >
              {waveRipples.map((ripple) => (
                <div
                  key={ripple.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left: ripple.localX, top: ripple.localY }}
                >
                  {/* 1st expanding slow wave ring */}
                  <div
                    className="w-16 h-16 rounded-full border-2 border-[#DBFA6B]/70 bg-[#DBFA6B]/10 animate-ping opacity-75 shadow-[0_0_12px_rgba(219,250,107,0.5)]"
                    style={{ animationDuration: '2.8s', animationIterationCount: 'infinite' }}
                  />

                  {/* 2nd delayed soft wave ring */}
                  <div
                    className="absolute inset-0 w-24 h-24 -m-4 rounded-full border border-[#DBFA6B]/40 animate-ping opacity-50 shadow-[0_0_16px_rgba(219,250,107,0.3)]"
                    style={{ animationDuration: '3.6s', animationIterationCount: 'infinite', animationDelay: '1.0s' }}
                  />

                  {/* Central indicator node: SEMI-TRANSPARENT so price tag underneath is clearly visible */}
                  <div className="absolute inset-0 w-3.5 h-3.5 m-auto rounded-full bg-[#DBFA6B]/30 border border-[#F59E0B]/50 shadow-[0_0_8px_rgba(219,250,107,0.4)]" />
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
