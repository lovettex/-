import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import { useStockTabs } from "../hooks/useStockTabs";
import { playClickSound, playSwipeSound, playSuccessSound, playPriceImportSound, playAddStockSound } from "../lib/audio";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import Lenis from "lenis";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { formatTimestamp, getTimestampDate } from "../lib/dateUtils";
import { toast } from "sonner";
import {
  ScrollIn,
  InteractiveButton,
  Magnetic,
} from "../components/MotionWrappers";
import { AnimatedNumber } from "../components/AnimatedNumber";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import {
  Plus,
  TrendingUp,
  Target,
  Clock,
  Activity,
  TrendingDown,
  DownloadCloud,
  Trash2,
  RotateCcw,
  Gamepad2,
  ShieldCheck,
  EyeOff,
  Eye,
  Search,
  Settings2,
  ArrowUp,
  ArrowDown,
  Calendar,
  FileJson,
  Upload,
  Trash,
  Check,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Star,
  CheckCircle2,
  SlidersHorizontal,
  Sparkles,
  Link,
  Copy,
  FileText,
  LogOut,
  BookOpen,
  Tv,
  Maximize2,
  Loader2,
  Printer,
  Save,
  Edit3,
  Settings,
  Layers,
  X,
  Keyboard,
  RefreshCw,
  Globe,
  Zap,
  Database,
  Circle,
} from "lucide-react";
import { calculateStats, generateAveragingDownRows, shouldUpdateAveragingRows } from "../lib/calculations";
import { safeLocalStorage, safeSessionStorage } from "../lib/utils";
import { format } from "date-fns";
import { StockCardVisualizer, prefetchStockPrice } from "../components/StockCardVisualizer";
import { CinemaDock } from "../components/CinemaDock";
import { DynamicVisualLinesModal } from "../components/DynamicVisualLinesModal";
import { MiniVisualLinesModal } from "../components/MiniVisualLinesModal";
import { syncSubTabDividersToCanvas } from "../utils/visualLinesSync";
import { ChartAnnotation } from "../types";

const EMPTY_CHART_ANNOTATIONS: ChartAnnotation[] = [];

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  user: any,
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isOffline =
    errorMessage.includes("offline") ||
    errorMessage.includes("client is offline") ||
    errorMessage.includes("unavailable") ||
    errorMessage.includes("could not reach") ||
    errorMessage.includes("backend didn't respond");

  if (isOffline) {
    console.warn(`[Firestore Offline Cache Active] ${operationType} '${path}': ${errorMessage}`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
}

const getDisplayHoldingStatus = (
  status: string | undefined,
): "觀察中" | "候選名單" | "買進操作" | "賣出操作" | "平倉操作" | "乖離名單" => {
  if (
    status === "觀察中" ||
    status === "買進操作" ||
    status === "賣出操作" ||
    status === "平倉操作" ||
    status === "乖離名單"
  )
    return status;
  return "候選名單";
};

const holdingTabConfig = {
  "觀察中": {
    icon: Eye,
    colorClass: "text-sky-650 text-sky-600 font-bold",
    bgClass: "bg-sky-50",
    borderClass: "border-sky-200",
    shadowClass: "shadow-[0_4px_12px_rgba(56,189,248,0.06)]",
    activeCountClass: "bg-sky-100/80 text-sky-700 border-sky-200/50",
  },
  "候選名單": {
    icon: Star,
    colorClass: "text-amber-700 font-bold",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    shadowClass: "shadow-[0_4px_12px_rgba(245,158,11,0.06)]",
    activeCountClass: "bg-amber-100/80 text-amber-800 border-amber-200/50",
  },
  "買進操作": {
    icon: TrendingUp,
    colorClass: "text-emerald-700 font-bold",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    shadowClass: "shadow-[0_4px_12px_rgba(16,185,129,0.06)]",
    activeCountClass: "bg-emerald-100/80 text-emerald-800 border-emerald-200/50",
  },
  "賣出操作": {
    icon: TrendingDown,
    colorClass: "text-rose-700 font-bold",
    bgClass: "bg-rose-50",
    borderClass: "border-rose-200",
    shadowClass: "shadow-[0_4px_12px_rgba(225,29,72,0.06)]",
    activeCountClass: "bg-rose-100/80 text-rose-850 text-rose-800 border-rose-200/50",
  },
  "平倉操作": {
    icon: CheckCircle2,
    colorClass: "text-fuchsia-700 font-bold",
    bgClass: "bg-fuchsia-50",
    borderClass: "border-fuchsia-200",
    shadowClass: "shadow-[0_4px_12px_rgba(217,70,239,0.06)]",
    activeCountClass: "bg-fuchsia-100/80 text-fuchsia-800 border-fuchsia-200/50",
  },
  "乖離名單": {
    icon: Activity,
    colorClass: "text-indigo-700 font-bold",
    bgClass: "bg-indigo-50",
    borderClass: "border-indigo-200",
    shadowClass: "shadow-[0_4px_12px_rgba(99,102,241,0.06)]",
    activeCountClass: "bg-indigo-100/80 text-indigo-800 border-indigo-200/50",
  },
} as const;

const calculatePositiveValue = (
  rating: number = 5,
  qualityScore: number = 5,
  valueScore: number = 5,
  buyRate: number = 5
) => {
  return (
    Math.max(0, rating - 5) +
    Math.max(0, qualityScore - 5) +
    Math.max(0, valueScore - 5) +
    buyRate
  );
};

const calculateNegativeValue = (
  rating: number = 5,
  qualityScore: number = 5,
  valueScore: number = 5,
  sellRate: number = 5
) => {
  return (
    Math.max(0, 5 - rating) +
    Math.max(0, 5 - qualityScore) +
    Math.max(0, 5 - valueScore) +
    sellRate
  );
};

const promptTemplates = [
  {
    id: "fundamental",
    name: "個股基本面分析",
    template: "請針對個股 {symbol} ({companyName}) 進行詳細的基本面分析，包含營收、毛利率、本益比（P/E Ratio）、負債比以及近期的財報表現，並給出未來的投資建議與風險評估。"
  },
  {
    id: "technical",
    name: "個股技術面分析",
    template: "請分析個股 {symbol} ({companyName}) 的技術面走勢。包含近期的 K 線型態、主要均線支撐與壓力位、RSI、MACD、以及量價關係，並預測短期的股價趨勢。"
  },
  {
    id: "chips",
    name: "籌碼面與主力動向",
    template: "請深入研究個股 {symbol} ({companyName}) 的籌碼面。分析主力資金流向、大戶持股比例變化、外資與投信的買賣超狀況，以及融資融券的餘額變化，評估市場主力的意圖。"
  },
  {
    id: "industry",
    name: "產業地位與競爭優勢",
    template: "請評估個股 {symbol} ({companyName}) 在其所屬產業中的市場地位與核心競爭力。分析其面臨的競爭對手、產業護城河、未來成長動能以及長期發展潛力。"
  },
  {
    id: "news",
    name: "最新新聞與事件分析",
    template: "請檢索並分析關於個股 {symbol} ({companyName}) 的最新重大新聞、產品發佈、財報公布或高層變動事件，說明 these events 對股價的中長期影響。"
  },
  {
    id: "fed",
    name: "FED 政策對該股影響",
    template: "請結合最新 FED 利率決策（如降息/升息預期、縮表政策），分析對個股 {symbol} ({companyName}) 的估值、資金成本及股價可能帶來的影響。"
  },
  {
    id: "custom",
    name: "自訂分析指令",
    template: "請針對個股 {symbol} ({companyName}) 進行深度多維度交叉分析。"
  }
];

export default function Dashboard() {
  const {
    tabs,
    loading,
    addTab,
    updateTabStatus,
    updateTabHidden,
    updateTabOrder,
    updateTab,
    deleteTab,
  } = useStockTabs();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [totalCapital, setTotalCapital] = useState<number>(() => {
    const saved = safeLocalStorage.getItem(`total-capital-${user?.uid || "guest"}`);
    return saved ? parseFloat(saved) : 1000000;
  });

  const [virtualCapital, setVirtualCapital] = useState<number>(() => {
    const saved = safeLocalStorage.getItem(`virtual-capital-${user?.uid || "guest"}`);
    return saved ? parseFloat(saved) : 1000000;
  });

  const [bankAccountBalance, setBankAccountBalance] = useState<number>(() => {
    const saved = safeLocalStorage.getItem(`bank-account-balance-${user?.uid || "guest"}`);
    return saved ? parseFloat(saved) : 1000000;
  });
  const [isBankBalanceRevealed, setIsBankBalanceRevealed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "userSettings", user.uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (typeof data.totalCapital === "number") {
            setTotalCapital(data.totalCapital);
            safeLocalStorage.setItem(`total-capital-${user.uid}`, data.totalCapital.toString());
          }
          if (typeof data.virtualCapital === "number") {
            setVirtualCapital(data.virtualCapital);
            safeLocalStorage.setItem(`virtual-capital-${user.uid}`, data.virtualCapital.toString());
          }
          if (typeof data.bankAccountBalance === "number") {
            setBankAccountBalance(data.bankAccountBalance);
            safeLocalStorage.setItem(`bank-account-balance-${user.uid}`, data.bankAccountBalance.toString());
          }
        }
      } catch (error) {
        console.error("Failed to fetch userSettings:", error);
        handleFirestoreError(error, OperationType.GET, `userSettings/${user.uid}`, user);
      }
    };
    fetchSettings();
  }, [user]);

  const handleUpdateBankBalance = async (newVal: number) => {
    setBankAccountBalance(newVal);
    const userKey = user ? user.uid : "guest";
    safeLocalStorage.setItem(`bank-account-balance-${userKey}`, newVal.toString());
    if (user) {
      try {
        await setDoc(
          doc(db, "userSettings", user.uid),
          { bankAccountBalance: newVal, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (error) {
        console.error("Failed to save bankAccountBalance userSettings:", error);
        handleFirestoreError(error, OperationType.WRITE, `userSettings/${user.uid}`, user);
      }
    }
  };

  const handleUpdateTotalCapital = async (newVal: number) => {
    setTotalCapital(newVal);
    const userKey = user ? user.uid : "guest";
    safeLocalStorage.setItem(`total-capital-${userKey}`, newVal.toString());
    if (user) {
      try {
        await setDoc(
          doc(db, "userSettings", user.uid),
          { totalCapital: newVal, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (error) {
        console.error("Failed to save userSettings:", error);
        handleFirestoreError(error, OperationType.WRITE, `userSettings/${user.uid}`, user);
      }
    }
  };

  const handleUpdateVirtualCapital = async (newVal: number) => {
    setVirtualCapital(newVal);
    const userKey = user ? user.uid : "guest";
    safeLocalStorage.setItem(`virtual-capital-${userKey}`, newVal.toString());
    if (user) {
      try {
        await setDoc(
          doc(db, "userSettings", user.uid),
          { virtualCapital: newVal, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (error) {
        console.error("Failed to save virtual userSettings:", error);
        handleFirestoreError(error, OperationType.WRITE, `userSettings/${user.uid}`, user);
      }
    }
  };

  const [activeTabOrders, setActiveTabOrders] = useState<Record<string, any[]>>(
    () => {
      try {
        const cached = user ? safeSessionStorage.getItem(`cached_tab_orders_v3_${user.uid}`) : null;
        return cached ? JSON.parse(cached) : {};
      } catch {
        return {};
      }
    },
  );
  
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(() => {
    try {
      const userKey = user ? user.uid : "guest";
      const saved = safeLocalStorage.getItem(`selected-card-ids-${userKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load selected card ids from storage:", e);
    }
    return new Set<string>();
  });

  // Sync selected cards when user authenticates or changes
  useEffect(() => {
    const userKey = user ? user.uid : "guest";
    try {
      const saved = safeLocalStorage.getItem(`selected-card-ids-${userKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSelectedCardIds(new Set(parsed));
          return;
        }
      } else if (user) {
        // Migrate guest selection if user has no saved selection yet
        const guestSaved = safeLocalStorage.getItem("selected-card-ids-guest");
        if (guestSaved) {
          const parsed = JSON.parse(guestSaved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSelectedCardIds(new Set(parsed));
            safeLocalStorage.setItem(`selected-card-ids-${user.uid}`, guestSaved);
          }
        }
      }
    } catch (e) {
      console.error("Failed to reload selected card ids on user change:", e);
    }
  }, [user?.uid]);

  const [isCinemaModeActive, setIsCinemaModeActive] = useState<boolean>(false);
  const [activeCinemaCardId, setActiveCinemaCardId] = useState<string | null>(null);

  // HTML Upload & Preview States
  const [isUploadHtmlOpen, setIsUploadHtmlOpen] = useState(false);
  const [isPreviewHtmlOpen, setIsPreviewHtmlOpen] = useState(false);
  const [htmlUploadSymbol, setHtmlUploadSymbol] = useState("");
  const [htmlUploadDate, setHtmlUploadDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [htmlFileToUpload, setHtmlFileToUpload] = useState<File | null>(null);
  const [htmlFileContent, setHtmlFileContent] = useState<string>("");
  const [htmlFileToUpload2, setHtmlFileToUpload2] = useState<File | null>(null);
  const [htmlFileContent2, setHtmlFileContent2] = useState<string>("");
  const [isUploadingHtml, setIsUploadingHtml] = useState(false);
  const [htmlFilesList, setHtmlFilesList] = useState<any[]>([]);
  const [selectedPreviewFileId, setSelectedPreviewFileId] = useState<number | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [htmlContext, setHtmlContext] = useState<"dynamic" | "market_filter" | "stock_micro" | "fed" | "plus_70">("dynamic");

  // AI Analysis Panel States & Helpers
  const [isAiAnalysisOpen, setIsAiAnalysisOpen] = useState(false);
  const [isVisualLinesBoardOpen, setIsVisualLinesBoardOpen] = useState(false);
  const [miniVisualLinesStock, setMiniVisualLinesStock] = useState<{
    stockName: string;
    currentPrice?: number;
    holdingStatus?: string;
    tradeType?: string;
  } | null>(null);
  const [aiMobileActiveTab, setAiMobileActiveTab] = useState<"controls" | "preview">("controls");
  const [aiSelectedSymbol, setAiSelectedSymbol] = useState("");
  const [aiSelectedPromptId, setAiSelectedPromptId] = useState("fundamental");
  const [aiPromptText, setAiPromptText] = useState("");
  const [aiHtmlFiles, setAiHtmlFiles] = useState<any[]>([]);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const [selectedPreviewLinkTitle, setSelectedPreviewLinkTitle] = useState<string | null>(null);
  const [aiLeftTab, setAiLeftTab] = useState<"upload" | "preview">("upload");
  const [aiUploadFile, setAiUploadFile] = useState<File | null>(null);
  const [aiUploadContent, setAiUploadContent] = useState<string>("");
  const [isAiUploading, setIsAiUploading] = useState(false);

  // Dynamic Prompt templates loaded from local storage or defaulting to default templates
  const [dynamicPrompts, setDynamicPrompts] = useState<{ id: string; name: string; template: string; note?: string }[]>(() => {
    const saved = safeLocalStorage.getItem("custom_prompt_templates");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading prompt templates from localStorage:", e);
      }
    }
    return promptTemplates;
  });

  const [isPromptManagerOpen, setIsPromptManagerOpen] = useState(false);
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptTemplate, setNewPromptTemplate] = useState("");
  const [newPromptNote, setNewPromptNote] = useState("");
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingPromptName, setEditingPromptName] = useState("");
  const [editingPromptTemplate, setEditingPromptTemplate] = useState("");
  const [editingPromptNote, setEditingPromptNote] = useState("");
  const [confirmDeletePromptId, setConfirmDeletePromptId] = useState<string | null>(null);
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState<number | null>(null);

  const handleSavePrompts = (updated: typeof dynamicPrompts) => {
    setDynamicPrompts(updated);
    safeLocalStorage.setItem("custom_prompt_templates", JSON.stringify(updated));
  };

  const uniqueActiveStocks = useMemo(() => {
    const seen = new Set<string>();
    const list: { symbol: string; companyName?: string }[] = [];
    tabs
      .filter((t: any) => t.status === "ACTIVE")
      .forEach((tab) => {
        if (tab.symbol && !seen.has(tab.symbol)) {
          seen.add(tab.symbol);
          list.push({ symbol: tab.symbol, companyName: tab.companyName });
        }
      });
    return list;
  }, [tabs]);

  const aiActiveTab = useMemo(() => {
    if (!aiSelectedSymbol || !tabs) return null;
    return tabs.find((t: any) => t.symbol === aiSelectedSymbol && t.status === "ACTIVE");
  }, [aiSelectedSymbol, tabs]);

  useEffect(() => {
    if (isAiAnalysisOpen && !aiSelectedSymbol && uniqueActiveStocks.length > 0) {
      setAiSelectedSymbol(uniqueActiveStocks[0].symbol);
    }
  }, [isAiAnalysisOpen, uniqueActiveStocks, aiSelectedSymbol]);

  useEffect(() => {
    if (aiSelectedSymbol) {
      const fetchAiHtmlFiles = async (symbol: string) => {
        if (!user || !symbol) return;
        try {
          const url = `/api/html-files?userId=${user.uid}&symbol=${encodeURIComponent(symbol.trim().toUpperCase())}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            setAiHtmlFiles(data);
          }
        } catch (error) {
          console.error("Failed to fetch AI HTML files:", error);
        }
      };
      
      fetchAiHtmlFiles(aiSelectedSymbol);
      
      const templateObj = dynamicPrompts.find(t => t.id === aiSelectedPromptId);
      if (templateObj) {
        const stockObj = uniqueActiveStocks.find(s => s.symbol === aiSelectedSymbol);
        const companyName = stockObj?.companyName || "";
        const interpolated = templateObj.template
          .replace(/{symbol}/g, aiSelectedSymbol)
          .replace(/{companyName}/g, companyName);
        setAiPromptText(interpolated);
      }
    }
  }, [aiSelectedSymbol, aiSelectedPromptId, uniqueActiveStocks, user, dynamicPrompts]);

  useEffect(() => {
    if (!isAiAnalysisOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsAiAnalysisOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAiAnalysisOpen]);

  const handleAiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAiUploadFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAiUploadContent(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleAiUploadSubmit = async () => {
    if (!user) {
      toast.error("請先登入");
      return;
    }
    if (!aiSelectedSymbol) {
      toast.error("請先選擇分析個股");
      return;
    }
    if (!aiUploadContent) {
      toast.error("請選擇要上傳的 HTML 檔案");
      return;
    }

    setIsAiUploading(true);
    const dateFormatted = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // e.g. 20260716
    const cleanSymbol = aiSelectedSymbol.trim().toUpperCase();
    const filename = aiUploadFile ? aiUploadFile.name : `${cleanSymbol}_${dateFormatted}.html`;

    try {
      const response = await fetch("/api/html-files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
          symbol: cleanSymbol,
          filename: filename,
          htmlContent: aiUploadContent,
        }),
      });

      if (response.ok) {
        toast.success("HTML 檔案上傳成功！");
        setAiUploadFile(null);
        setAiUploadContent("");
        
        // Refresh the file list
        const url = `/api/html-files?userId=${user.uid}&symbol=${encodeURIComponent(cleanSymbol)}`;
        const listRes = await fetch(url);
        if (listRes.ok) {
          const data = await listRes.json();
          setAiHtmlFiles(data);
          if (data.length > 0) {
            const latestFile = data[0];
            setSelectedPreviewUrl(`/api/html-files/${latestFile.id}/content`);
            setSelectedPreviewLinkTitle(latestFile.fileName);
            setAiMobileActiveTab("preview");
          }
        }
        setAiLeftTab("preview");
        setAiMobileActiveTab("preview");
        playClickSound();
      } else {
        const err = await response.json();
        throw new Error(err.error || "上傳失敗");
      }
    } catch (error: any) {
      console.error("Failed to upload HTML file:", error);
      toast.error(error.message || "上傳失敗，請稍後再試");
    } finally {
      setIsAiUploading(false);
    }
  };

  const handleAiDeleteHtmlFile = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/html-files/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("檔案已成功刪除");
        setAiHtmlFiles(prev => prev.filter(f => f.id !== id));
        if (selectedPreviewUrl === `/api/html-files/${id}/content`) {
          setSelectedPreviewUrl(null);
          setSelectedPreviewLinkTitle(null);
        }
        setConfirmDeleteFileId(null);
      } else {
        toast.error("刪除失敗");
      }
    } catch (error) {
      console.error("Failed to delete AI html file:", error);
      toast.error("刪除失敗，發生錯誤");
    }
  };

  const handlePasteOnDeepseek = async () => {
    if (!aiPromptText.trim()) {
      toast.error("請輸入或選擇 Prompt 指令內容");
      return;
    }
    try {
      await navigator.clipboard.writeText(aiPromptText);
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        toast.success("已複製指令，即將開啓 Deepseek App！");
        const start = Date.now();
        window.location.href = "deepseek://";
        setTimeout(() => {
          if (Date.now() - start < 1500) {
            window.open("https://chat.deepseek.com", "_blank");
          }
        }, 1200);
      } else {
        toast.success("已複製指令，即將開啓 Deepseek 網頁！");
        try {
          window.open("https://chat.deepseek.com", "_blank");
        } catch (err) {
          console.warn("Failed to open Deepseek window automatically", err);
        }
      }
    } catch (error: any) {
      console.error("Deepseek copy error:", error);
      toast.error("複製失敗，請手動複製。");
    }
  };

  const scrolledStockCardRef = useRef<string | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsCinemaModeActive(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);



  const [activeTabTrades, setActiveTabTrades] = useState<Record<string, any[]>>(
    () => {
      try {
        const cached = user ? safeSessionStorage.getItem(`cached_tab_trades_v3_${user.uid}`) : null;
        return cached ? JSON.parse(cached) : {};
      } catch {
        return {};
      }
    },
  );
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 640 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [activeViewTab, setActiveViewTab] = useState<
    "active" | "real" | "completed" | "socrates" | "alerts" | "notes"
  >("active");

  const [completedMainTab, setCompletedMainTab] = useState<"all" | "real" | "simulated">("all");
  const [completedResultFilter, setCompletedResultFilter] = useState<"all" | "win" | "lose">("all");
  const [completedSearchQuery, setCompletedSearchQuery] = useState<string>("");

  // Lenis Smooth Scroll Engine Instance
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollToElement = useCallback((target: string | HTMLElement, offset = -20) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, {
        offset,
        duration: 1.0,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
    } else {
      const el = typeof target === "string" ? document.querySelector(target) : target;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleViewTabChange = useCallback((newTab: "active" | "real" | "completed" | "notes") => {
    playClickSound();
    setActiveViewTab(newTab);
    setTimeout(() => {
      if (newTab === "active" || newTab === "real") {
        scrollToElement("#active-cards-section", -20);
      } else if (newTab === "completed") {
        scrollToElement("#completed-cards-section", -20);
      } else if (newTab === "notes") {
        scrollToElement("#notes-cards-section", -20);
      }
    }, 80);
  }, [scrollToElement]);
  const [activeHoldingSubTab, setActiveHoldingSubTab] = useState<
    "觀察中" | "候選名單" | "買進操作" | "賣出操作" | "平倉操作" | "乖離名單"
  >((safeSessionStorage.getItem('preferredHoldingSubTab') as any) || "候選名單");

  const [activeCardDefinitionFilter, setActiveCardDefinitionFilter] = useState<
    "all" | "highlight" | "operation" | "deviation" | "group"
  >("all");

  useEffect(() => {
    safeSessionStorage.setItem('preferredHoldingSubTab', activeHoldingSubTab);
    setActiveCardDefinitionFilter("all");
  }, [activeHoldingSubTab]);

  useEffect(() => {
    const state = location.state as { autoFlipTabId?: string; returnStockId?: string } | null;
    const targetStockId = state?.autoFlipTabId || state?.returnStockId || safeSessionStorage.getItem('lastViewedStockId');

    if (!targetStockId || loading || !tabs || tabs.length === 0) return;
    if (scrolledStockCardRef.current === targetStockId) return;

    const targetTab = tabs.find((t) => t.id === targetStockId || t.symbol === targetStockId);

    if (targetTab) {
      scrolledStockCardRef.current = targetStockId;

      // Clear consumed target flags immediately so it won't loop
      safeSessionStorage.removeItem('lastViewedStockId');
      if (state?.autoFlipTabId || state?.returnStockId) {
        window.history.replaceState({}, document.title);
      }

      // If hidden, unhide it so it renders
      if (targetTab.isHidden) {
        updateTabHidden(targetTab.id, false);
      }

      // 1. Switch activeViewTab based on stock status / tradeType
      if (targetTab.status === "COMPLETED") {
        setActiveViewTab("completed");
      } else if (targetTab.tradeType === "real") {
        setActiveViewTab("real");
      } else {
        setActiveViewTab("active");
      }

      // 2. Switch holding subtab
      const targetSubTab = getDisplayHoldingStatus(targetTab.holdingStatus);
      setActiveHoldingSubTab(targetSubTab);

      // 3. Reset card definition filter so card is not filtered out
      setActiveCardDefinitionFilter("all");

      // 4. Poll and scroll into view once DOM element is rendered
      let attempts = 0;
      const attemptScroll = () => {
        const el = document.getElementById(`stock-card-${targetTab.id}`) || document.getElementById(`notes-row-${targetTab.id}`);
        if (el) {
          // Vertical scroll to section/card
          scrollToElement(el, -120);

          // Horizontal scroll in carousel container
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

          // Visual highlight animation ring
          el.classList.add("ring-4", "ring-emerald-500", "ring-offset-2", "scale-[1.03]", "transition-all", "duration-300");
          setTimeout(() => {
            el.classList.remove("ring-4", "ring-emerald-500", "ring-offset-2", "scale-[1.03]");
          }, 2000);
        } else if (attempts < 30) {
          attempts++;
          setTimeout(attemptScroll, 100);
        }
      };

      setTimeout(attemptScroll, 100);
    }
  }, [location.state, tabs, loading, scrollToElement, updateTabHidden]);

  // Global listener for jump_to_stock_card CustomEvent
  useEffect(() => {
    const handleJumpToCardEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ tabId?: string; symbol?: string }>;
      const { tabId, symbol } = customEvent.detail || {};
      const targetTab = tabs.find((t) => (tabId ? t.id === tabId : t.symbol === symbol));
      if (!targetTab) return;

      if (targetTab.status === "COMPLETED") {
        setActiveViewTab("completed");
      } else if (targetTab.tradeType === "real") {
        setActiveViewTab("real");
        setActiveHoldingSubTab(getDisplayHoldingStatus(targetTab.holdingStatus));
      } else {
        setActiveViewTab("active");
        setActiveHoldingSubTab(getDisplayHoldingStatus(targetTab.holdingStatus));
      }
      setActiveCardTabId(targetTab.id);
      setActiveCardDefinitionFilter("all");

      let attempts = 0;
      const attemptScroll = () => {
        const el = document.getElementById(`stock-card-${targetTab.id}`) || document.getElementById(`notes-row-${targetTab.id}`);
        if (el) {
          scrollToElement(el, -120);
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          el.classList.add("ring-4", "ring-amber-400", "ring-offset-2", "scale-[1.03]", "transition-all", "duration-300");
          setTimeout(() => {
            el.classList.remove("ring-4", "ring-amber-400", "ring-offset-2", "scale-[1.03]");
          }, 2500);
        } else if (attempts < 25) {
          attempts++;
          setTimeout(attemptScroll, 80);
        }
      };
      setTimeout(attemptScroll, 120);
    };

    window.addEventListener("jump_to_stock_card", handleJumpToCardEvent);
    return () => {
      window.removeEventListener("jump_to_stock_card", handleJumpToCardEvent);
    };
  }, [tabs, scrollToElement]);

  const [activeManageTab, setActiveManageTab] = useState<
    "觀察中" | "候選名單" | "買進操作" | "賣出操作" | "平倉操作" | "乖離名單" | "持股監控"
  >("觀察中");
  const [groupingTabId, setGroupingTabId] = useState<string | null>(null);
  const [activeTabStrategies, setActiveTabStrategies] = useState<
    Record<string, any>
  >(() => {
    try {
      const cached = user ? safeSessionStorage.getItem(`cached_tab_strategies_v3_${user.uid}`) : null;
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    // Purge legacy global cached subcollection items
    safeSessionStorage.removeItem("cached_tab_orders_v2");
    safeSessionStorage.removeItem("cached_tab_trades_v2");
    safeSessionStorage.removeItem("cached_tab_strategies_v2");

    if (!user) {
      setActiveTabOrders({});
      setActiveTabTrades({});
      setActiveTabStrategies({});
      fetchedTabIdsRef.current.clear();
      return;
    }

    try {
      const orders = safeSessionStorage.getItem(`cached_tab_orders_v3_${user.uid}`);
      if (orders) setActiveTabOrders(JSON.parse(orders));
      const trades = safeSessionStorage.getItem(`cached_tab_trades_v3_${user.uid}`);
      if (trades) setActiveTabTrades(JSON.parse(trades));
      const strategies = safeSessionStorage.getItem(`cached_tab_strategies_v3_${user.uid}`);
      if (strategies) setActiveTabStrategies(JSON.parse(strategies));
    } catch (e) {
      // ignore
    }
  }, [user?.uid]);

  const activeTabStatsMap = useMemo(() => {
    const map: Record<string, { averagePrice?: number; totalQuantity?: number }> = {};
    Object.entries(activeTabTrades).forEach(([tabId, trades]) => {
      const tab = tabs.find((t) => t.id === tabId);
      const st = calculateStats(trades as any, tab?.currentPrice);
      map[tabId] = { averagePrice: st.averagePrice, totalQuantity: st.totalQuantity };
    });
    return map;
  }, [activeTabTrades, tabs]);

  // 自動檢查所有非已完成且籌碼管理有持有數量的個股，自動計算系統一與系統二組別 1~4 的預計購入股價 ($) 並同步儲存
  const syncAveragingRowsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user || tabs.length === 0) return;

    tabs.forEach((tab) => {
      if (tab.status === "COMPLETED") return;
      const trades = activeTabTrades[tab.id];
      if (!trades || trades.length === 0) return;

      const st = calculateStats(trades as any, tab.currentPrice);
      if (st.totalQuantity <= 0 || st.averagePrice <= 0) return;

      const check = shouldUpdateAveragingRows(tab, st);
      if (check.needsUpdate) {
        const updateKey = `${tab.id}_${st.averagePrice.toFixed(2)}`;
        if (syncAveragingRowsRef.current.has(updateKey)) return;
        syncAveragingRowsRef.current.add(updateKey);

        updateTab(tab.id, {
          averagingRows: check.sys1,
          averagingRowsSys2: check.sys2,
        }).catch((err) => {
          console.error("Auto update averaging down rows error for tab", tab.symbol, err);
        });
      }
    });
  }, [tabs, activeTabTrades, user?.uid, updateTab]);
  const [strategyHighlights, setStrategyHighlights] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [socratesData, setSocratesData] = useState<
    Record<string, { strong?: any[]; weak?: any[] }>
  >({});
  const [socratesCurrentDate, setSocratesCurrentDate] = useState(new Date());
  const [selectedSocratesDate, setSelectedSocratesDate] = useState<Date | null>(
    null,
  );
  const [socratesSubTab, setSocratesSubTab] = useState<"strong" | "weak" | "featured">(
    "strong",
  );
  const [socratesSortConfig, setSocratesSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [isSocratesCalendarOpen, setIsSocratesCalendarOpen] = useState(false);
  const [socratesSortWeights, setSocratesSortWeights] = useState({
    crashSimilarity: 5,
    buyScore: 7,
    sellScore: 2,
    qualityScore: 7,
    valueScore: 7,
  });
  const [isSocratesSortWeightsOpen, setIsSocratesSortWeightsOpen] =
    useState(false);

  const [socratesHighlightedRows, setSocratesHighlightedRows] = useState<
    Record<string, boolean>
  >({});

  const socratesLoadedUserRef = useRef<string | null>(null);

  // Synchronize socrates highlighted rows and sort weights with safeLocalStorage keyed by user
  useEffect(() => {
    const userKey = user ? user.uid : "guest";
    
    // Load highlighted rows
    const savedHighlights = safeLocalStorage.getItem(`socrates-highlighted-rows-${userKey}`);
    if (savedHighlights) {
      try {
        setSocratesHighlightedRows(JSON.parse(savedHighlights));
      } catch (e) {
        console.error("Failed to parse saved Socrates highlights", e);
        setSocratesHighlightedRows({});
      }
    } else {
      setSocratesHighlightedRows({});
    }

    // Load sort weights
    const savedWeights = safeLocalStorage.getItem(`socrates-sort-weights-${userKey}`);
    if (savedWeights) {
      try {
        setSocratesSortWeights(JSON.parse(savedWeights));
      } catch (e) {
        console.error("Failed to parse saved Socrates sort weights", e);
      }
    }

    socratesLoadedUserRef.current = userKey;
  }, [user]);

  // Premium Audio feedback on tab/state changes
  const isInitialViewTabMount = useRef(true);
  useEffect(() => {
    if (isInitialViewTabMount.current) {
      isInitialViewTabMount.current = false;
    } else {
      playClickSound();
    }
  }, [activeViewTab]);

  const isInitialHoldingSubTabMount = useRef(true);
  useEffect(() => {
    if (isInitialHoldingSubTabMount.current) {
      isInitialHoldingSubTabMount.current = false;
    } else {
      playClickSound();
    }
  }, [activeHoldingSubTab]);

  const isInitialManageTabMount = useRef(true);
  useEffect(() => {
    if (isInitialManageTabMount.current) {
      isInitialManageTabMount.current = false;
    } else {
      playClickSound();
    }
  }, [activeManageTab]);

  const isInitialCardFilterMount = useRef(true);
  useEffect(() => {
    if (isInitialCardFilterMount.current) {
      isInitialCardFilterMount.current = false;
    } else {
      playClickSound();
    }
  }, [activeCardDefinitionFilter]);

  const lastFlippedCards = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (Object.keys(lastFlippedCards.current).length > 0) {
      let changed = false;
      const allKeys = new Set([...Object.keys(flippedCards), ...Object.keys(lastFlippedCards.current)]);
      for (const k of allKeys) {
        const wasBack = lastFlippedCards.current[k] !== false;
        const isBack = flippedCards[k] !== false;
        if (wasBack !== isBack) {
          changed = true;
          break;
        }
      }
      if (changed) {
        playSwipeSound();
      }
    }
    lastFlippedCards.current = { ...flippedCards };
  }, [flippedCards]);

  // Save highlights when modified
  useEffect(() => {
    const userKey = user ? user.uid : "guest";
    if (socratesLoadedUserRef.current === userKey) {
      safeLocalStorage.setItem(`socrates-highlighted-rows-${userKey}`, JSON.stringify(socratesHighlightedRows));
    }
  }, [socratesHighlightedRows, user]);

  // Save sort weights when modified
  useEffect(() => {
    const userKey = user ? user.uid : "guest";
    if (socratesLoadedUserRef.current === userKey) {
      safeLocalStorage.setItem(`socrates-sort-weights-${userKey}`, JSON.stringify(socratesSortWeights));
    }
  }, [socratesSortWeights, user]);

  const copySocratesRowToClipboard = async (item: any) => {
    const headers = [
      "代碼", "名稱", "產業", "型態", "現價", "支撐", "AI分析", "Buy", "Sell", "風險", "Qual", "Val", "Pos Val", "Neg Val", "訊號解讀"
    ];
    const values = [
      item.symbol,
      item.name || "-",
      item.sector || "-",
      item.technicalPattern || "-",
      item.price ? `$${item.price}` : "-",
      item.supportPrice ? `$${item.supportPrice}` : "-",
      item.rating !== undefined ? item.rating : "-",
      item.buyScore !== undefined ? item.buyScore : "-",
      item.sellScore !== undefined ? item.sellScore : "-",
      item.crashSimilarity !== undefined ? item.crashSimilarity : "-",
      item.qualityScore !== undefined ? item.qualityScore : "-",
      item.valueScore !== undefined ? item.valueScore : "-",
      item.positiveValue !== undefined ? item.positiveValue : "-",
      item.negativeValue !== undefined ? item.negativeValue : "-",
      item.ecmStatus || "-"
    ];
    
    const tsvText = values.join("\t");
    const humanReadableText = headers.map((h, i) => `${h}: ${values[i]}`).join(", ");
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(tsvText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = tsvText;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      toast.success(`已複製 ${item.symbol} 數據：${humanReadableText}`, {
        duration: 3500
      });
    } catch (err) {
      toast.error("複製失敗");
    }
  };

  const [notesExpandedCategories, setNotesExpandedCategories] = useState<
    Record<string, boolean>
  >({});

  const toggleNotesCategory = (cat: string) => {
    setNotesExpandedCategories((prev) => ({
      ...prev,
      [cat]: prev[cat] === false,
    }));
  };

  const handleUpdateOperationNote = async (tabId: string, noteText: string) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        operationNote: noteText, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { operationNote: noteText, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新操作備註失敗");
    }
  };

  const handleUpdateOperationFocus = async (tabId: string, focusText: string) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        operationFocus: focusText, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { operationFocus: focusText, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新操作重點失敗");
    }
  };

  const handleUpdateTPChecked = async (tabId: string, checked: boolean) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        tpChecked: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { tpChecked: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新止盈狀態失敗");
    }
  };

  const handleUpdateSLChecked = async (tabId: string, checked: boolean) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        slChecked: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { slChecked: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新止損狀態失敗");
    }
  };

  const handleUpdateAddChecked = async (tabId: string, checked: boolean) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        addChecked: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { addChecked: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新加碼狀態失敗");
    }
  };

  const handleUpdateCloseChecked = async (tabId: string, checked: boolean) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        closeChecked: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { closeChecked: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新平倉狀態失敗");
    }
  };

  const handleUpdateObserveChecked = async (tabId: string, checked: boolean) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        observeChecked: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { observeChecked: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新觀察狀態失敗");
    }
  };

  const handleUpdateNotesHighlighted = async (tabId: string, checked: boolean) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        notesHighlighted: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { notesHighlighted: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新選取狀態失敗");
    }
  };

  const handleUpdateStrategyField = async (tabId: string, field: string, checked: any) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        [field]: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { [field]: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新設定失敗");
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingPrices, setIsImportingPrices] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingCompleted, setIsExportingCompleted] = useState(false);
  const [isImportingCompleted, setIsImportingCompleted] = useState(false);
  const completedJsonFileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingNotes, setIsExportingNotes] = useState(false);
  const [isImportingNotes, setIsImportingNotes] = useState(false);
  const notesJsonFileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingFeatured, setIsExportingFeatured] = useState(false);
  const [isImportingFeatured, setIsImportingFeatured] = useState(false);
  const featuredJsonFileInputRef = useRef<HTMLInputElement>(null);

  // Carousel State & Refs
  const carouselRef = useRef<HTMLDivElement>(null);
  const renderCardRef = useRef<((tab: any, idx: number) => React.ReactNode) | null>(null);

  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
    hasDraggedBeyondThreshold: false,
    lastX: 0,
    vx: 0,
    startIdx: 0,
  });

  const cardDragTrackerRef = useRef<{
    startY: number;
    startX: number;
    cardId: string | null;
    hasTriggeredFlip: boolean;
    startTime: number;
  }>({
    startY: 0,
    startX: 0,
    cardId: null,
    hasTriggeredFlip: false,
    startTime: 0,
  });

  const animFrameId = useRef<number | null>(null);
  const visibleTabsRef = useRef<any[]>([]);

  const DRAG_THRESHOLD = 5;

  const onDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const ele = carouselRef.current;
    if (!ele) return;

    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }

    const pageX =
      "touches" in e && e.touches && e.touches.length > 0
        ? e.touches[0].pageX
        : (e as React.MouseEvent).pageX;

    dragRef.current.isDragging = true;
    dragRef.current.hasDraggedBeyondThreshold = false;
    dragRef.current.startX = pageX - ele.offsetLeft;
    dragRef.current.scrollLeft = ele.scrollLeft;
    dragRef.current.lastX = pageX;
    dragRef.current.vx = 0;

    // Record index of current item in view at drag start
    const containerInner = ele.children[0] as HTMLElement;
    if (containerInner && containerInner.children.length > 0) {
      const items = Array.from(containerInner.children) as HTMLElement[];
      const offsets = items.map((item) => item.offsetLeft);
      const currentScroll = ele.scrollLeft;
      
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < offsets.length; i++) {
        const diff = Math.abs(offsets[i] - currentScroll);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      dragRef.current.startIdx = closestIdx;
    } else {
      dragRef.current.startIdx = 0;
    }

    // Disable snap behavior during drag for smooth swiping
    ele.style.scrollSnapType = "none";
    ele.style.cursor = "grabbing";
    document.body.style.userSelect = "none"; // Prevent text selection
  };

  const onDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragRef.current.isDragging) return;

    const ele = carouselRef.current;
    if (!ele) return;

    const pageX =
      "touches" in e && e.touches && e.touches.length > 0
        ? e.touches[0].pageX
        : (e as MouseEvent).pageX;

    // Prevent horizontal carousel scroll if user is doing a vertical gesture to flip a card
    if (cardDragTrackerRef.current.cardId) {
      const tracker = cardDragTrackerRef.current;
      const pageY =
        "touches" in e && e.touches && e.touches.length > 0
          ? e.touches[0].pageY
          : (e as MouseEvent).pageY;
      const dy = Math.abs(tracker.startY - pageY);
      const dx = Math.abs(tracker.startX - pageX);
      if (dy > dx) {
        if (dy > 2) {
          // Confirmed vertical card flip gesture, cancel carousel dragging immediately
          dragRef.current.isDragging = false;
          ele.style.cursor = "grab";
          document.body.style.userSelect = "";
        }
        return;
      }
    }

    const x = pageX - ele.offsetLeft;
    const dx = x - dragRef.current.startX;

    dragRef.current.vx = pageX - dragRef.current.lastX;
    dragRef.current.lastX = pageX;

    if (Math.abs(dx) > DRAG_THRESHOLD) {
      dragRef.current.hasDraggedBeyondThreshold = true;
    }

    let targetScroll = dragRef.current.scrollLeft - dx;

    // Constrain active dragging scroll distance to adjacent card boundary to prevent sliding too far
    const containerInner = ele.children[0] as HTMLElement;
    if (containerInner && containerInner.children.length > 0) {
      const items = Array.from(containerInner.children) as HTMLElement[];
      const offsets = items.map((item) => item.offsetLeft);
      const startIdx = dragRef.current.startIdx;
      
      const minIdx = Math.max(0, startIdx - 1);
      const maxIdx = Math.min(items.length - 1, startIdx + 1);
      
      const minScroll = offsets[minIdx];
      const maxScroll = offsets[maxIdx];
      
      // Apply smooth resistance damping beyond boundaries
      if (targetScroll < minScroll) {
        const overscroll = minScroll - targetScroll;
        targetScroll = minScroll - overscroll * 0.22;
      } else if (targetScroll > maxScroll) {
        const overscroll = targetScroll - maxScroll;
        targetScroll = maxScroll + overscroll * 0.22;
      }

      // Limit the drag movement to at most half of the current card's width relative to drag start scroll position
      const cardWidth = items[startIdx]?.offsetWidth || 300;
      const maxDragDistance = cardWidth / 2;
      const dragStartScroll = dragRef.current.scrollLeft;
      if (targetScroll < dragStartScroll - maxDragDistance) {
        targetScroll = dragStartScroll - maxDragDistance;
      } else if (targetScroll > dragStartScroll + maxDragDistance) {
        targetScroll = dragStartScroll + maxDragDistance;
      }
    }

    ele.scrollLeft = targetScroll;
  }, []);

  const onDragEnd = useCallback(() => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;

    const ele = carouselRef.current;
    if (ele) {
      ele.style.cursor = "grab";

      // Programmatic horizontal paging/snapping based on mobile vs desktop
      const containerInner = ele.children[0] as HTMLElement;
      if (containerInner && containerInner.children.length > 0) {
        const items = Array.from(containerInner.children) as HTMLElement[];
        const offsets = items.map((item) => item.offsetLeft);
        
        const startIdx = dragRef.current.startIdx;
        let targetIdx = startIdx;
        const vx = dragRef.current.vx;
        const dx = dragRef.current.lastX - (dragRef.current.startX + ele.offsetLeft); // cumulative horizontal offset
        
        // Custom threshold for a responsive swipe action
        const velocityThreshold = 1.2;
        const distanceThreshold = 40;

        if (vx < -velocityThreshold || dx < -distanceThreshold) {
          // Swiped/dragged left -> next card
          targetIdx = Math.min(items.length - 1, startIdx + 1);
        } else if (vx > velocityThreshold || dx > distanceThreshold) {
          // Swiped/dragged right -> previous card
          targetIdx = Math.max(0, startIdx - 1);
        }

        const targetScrollLeft = Math.max(0, Math.min(ele.scrollWidth - ele.clientWidth, offsets[targetIdx]));

        // Smooth animations with ease-out cubic feel
        let startScroll = ele.scrollLeft;
        const distance = targetScrollLeft - startScroll;
        const duration = 240; // ms transition phase
        let startTime: number | null = null;

        const animateScroll = (time: number) => {
          if (!startTime) startTime = time;
          const progress = time - startTime;
          const t = Math.min(progress / duration, 1);
          // High-fidelity ease out cubic
          const ease = 1 - Math.pow(1 - t, 3);
          
          ele.scrollLeft = startScroll + distance * ease;

          if (t < 1) {
            animFrameId.current = requestAnimationFrame(animateScroll);
          } else {
            animFrameId.current = null;
          }
        };

        if (animFrameId.current) {
          cancelAnimationFrame(animFrameId.current);
        }
        animFrameId.current = requestAnimationFrame(animateScroll);
      }

      if (dragRef.current.hasDraggedBeyondThreshold) {
        setTimeout(() => {
          dragRef.current.hasDraggedBeyondThreshold = false;
        }, 50);
      }
    }
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onDragMove, { passive: false });
    window.addEventListener("mouseup", onDragEnd);
    window.addEventListener("touchmove", onDragMove, { passive: false });
    window.addEventListener("touchend", onDragEnd);
    return () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
      window.removeEventListener("touchmove", onDragMove);
      window.removeEventListener("touchend", onDragEnd);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [onDragMove, onDragEnd]);

  // New stock state
  const [newSymbol, setNewSymbol] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newTradeType, setNewTradeType] = useState<"simulated" | "real">(
    "simulated",
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpDialogTab, setHelpDialogTab] = useState<"shortcuts" | "priceImport">("shortcuts");
  const [isManageHiddenOpen, setIsManageHiddenOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [manageTradeType, setManageTradeType] = useState<"simulated" | "real">("simulated");
  const [isEditingCapital, setIsEditingCapital] = useState(false);
  const [editCapitalVal, setEditCapitalVal] = useState("");
  const [isEditingVirtualCapital, setIsEditingVirtualCapital] = useState(false);
  const [editVirtualCapitalVal, setEditVirtualCapitalVal] = useState("");
  const [isEditingBankBalance, setIsEditingBankBalance] = useState(false);
  const [editBankBalanceVal, setEditBankBalanceVal] = useState("");
  const [isDesktopMetricsOpen, setIsDesktopMetricsOpen] = useState(false);
  const [isMobileCinemaSidebarOpen, setIsMobileCinemaSidebarOpen] = useState(false);

  useEffect(() => {
    if (isManageHiddenOpen) {
      setManageTradeType(activeViewTab === "real" ? "real" : "simulated");
    }
  }, [isManageHiddenOpen, activeViewTab]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSymbol.trim()) {
      addTab(newSymbol.trim(), newCompany.trim(), newTradeType);
      playAddStockSound();
      setNewSymbol("");
      setNewCompany("");
      setNewTradeType("simulated");
      setIsAddOpen(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setSocratesData({});
      return;
    }

    const fetchSocratesData = async () => {
      const path = `users/${user.uid}/socratesData`;
      try {
        const socratesDoc = await getDocs(query(collection(db, path)));
        const data: Record<string, any> = {};
        socratesDoc.forEach((doc) => {
          data[doc.id] = doc.data();
        });

        // Handle migration from localStorage if Firestore is empty but local has data
        const saved = safeLocalStorage.getItem("socrates-data");
        if (Object.keys(data).length === 0 && saved) {
          try {
            const parsed = JSON.parse(saved);
            Object.keys(parsed).forEach(async (dateKey) => {
              if (Array.isArray(parsed[dateKey])) {
                parsed[dateKey] = { strong: parsed[dateKey] };
              }
              const itemPath = `${path}/${dateKey}`;
              try {
                await setDoc(doc(db, itemPath), parsed[dateKey]);
              } catch (e) {
                handleFirestoreError(e, OperationType.WRITE, itemPath, user);
              }
            });
            setSocratesData(parsed);
            safeLocalStorage.removeItem("socrates-data");
            return;
          } catch (e) {
            console.error("Migration failed", e);
          }
        }

        setSocratesData(data);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path, user);
      }
    };

    fetchSocratesData();
  }, [user]);

  const handleSocratesUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    dateKey: string,
    type: "strong" | "weak",
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        if (!Array.isArray(json)) {
          throw new Error("Socrates data should be a JSON array");
        }

        const processedJson = json.map((item) => {
          const newItem = { ...item };

          // Flexible key matching to handle spaces, underscores, and various names
          Object.entries(item).forEach(([key, value]) => {
            const normalizedKey = key.toUpperCase().replace(/[\s_\.\-]+/g, "");
            if (
              normalizedKey.includes("QUALITY") &&
              newItem.qualityScore === undefined
            ) {
              newItem.qualityScore = value;
            }
            if (
              normalizedKey.includes("VALUE") &&
              newItem.valueScore === undefined
            ) {
              newItem.valueScore = value;
            }
            if (
              (normalizedKey.includes("CRASH") ||
                normalizedKey.includes("崩盤")) &&
              newItem.crashSimilarity === undefined
            ) {
              newItem.crashSimilarity = value;
            }
            if (
              (normalizedKey === "BUY" ||
                normalizedKey === "BUYSCORE" ||
                normalizedKey === "BUYRATE") &&
              newItem.buyScore === undefined
            ) {
              newItem.buyScore = value;
            }
            if (
              (normalizedKey === "SELL" ||
                normalizedKey === "SELLSCORE" ||
                normalizedKey === "SELLRATE") &&
              newItem.sellScore === undefined
            ) {
              newItem.sellScore = value;
            }
            if (
              (normalizedKey === "SYM" ||
                normalizedKey === "SYMBOL" ||
                normalizedKey === "TICKER" ||
                normalizedKey === "代碼") &&
              newItem.symbol === undefined
            ) {
              newItem.symbol = value;
            }
            if (
              (normalizedKey === "NAME" ||
                normalizedKey === "COMPANYNAME" ||
                normalizedKey === "名稱") &&
              newItem.name === undefined
            ) {
              newItem.name = value;
            }
            if (
              (normalizedKey.includes("AISCORE") ||
                normalizedKey.includes("AI分數") ||
                normalizedKey.includes("AI評分") ||
                normalizedKey === "RATING") &&
              newItem.rating === undefined
            ) {
              newItem.rating = value;
            }
            if (
              (normalizedKey.includes("CURRENTPRICE") ||
                normalizedKey === "PRICE" ||
                normalizedKey === "現價") &&
              newItem.price === undefined
            ) {
              newItem.price = value;
            }
            if (
              (normalizedKey === "SUPPORTPRICE" ||
                normalizedKey === "支撐" ||
                normalizedKey === "支撐價" ||
                normalizedKey === "支撐價格") &&
              newItem.supportPrice === undefined
            ) {
              newItem.supportPrice = value;
            }
            if (
              (normalizedKey.includes("ECM") ||
                normalizedKey.includes("訊號") ||
                normalizedKey.includes("週期狀態") ||
                normalizedKey.includes("週期") ||
                normalizedKey.includes("簡評")) &&
              newItem.ecmStatus === undefined
            ) {
              newItem.ecmStatus = value;
            }
            if (
              (normalizedKey.includes("POSITIVE") ||
                normalizedKey.includes("P+")) &&
              newItem.positiveValue === undefined
            ) {
              newItem.positiveValue = value;
            }
            if (
              (normalizedKey.includes("NEGATIVE") ||
                normalizedKey.includes("N-")) &&
              newItem.negativeValue === undefined
            ) {
              newItem.negativeValue = value;
            }
            if (
              (normalizedKey === "SECTOR" ||
                normalizedKey === "板塊" ||
                normalizedKey === "產業") &&
              newItem.sector === undefined
            ) {
              newItem.sector = value;
            }
            if (
              (normalizedKey === "TECHNICALPATTERN" ||
                normalizedKey.includes("技術型態") ||
                normalizedKey.includes("備註") ||
                normalizedKey.includes("PATTERN")) &&
              newItem.technicalPattern === undefined
            ) {
              newItem.technicalPattern = value;
            }
          });
          
          if (newItem.positiveValue === undefined) {
            newItem.positiveValue = calculatePositiveValue(
              Number(newItem.rating ?? 5), 
              Number(newItem.qualityScore || 5), 
              Number(newItem.valueScore || 5), 
              Number(newItem.buyScore || 5)
            );
          }
          if (newItem.negativeValue === undefined) {
            newItem.negativeValue = calculateNegativeValue(
              Number(newItem.rating ?? 5), 
              Number(newItem.qualityScore || 5), 
              Number(newItem.valueScore || 5), 
              Number(newItem.sellScore || 5)
            );
          }

          return newItem;
        });

        const currentDayData = socratesData[dateKey] || {};
        const updatedDayData = {
          ...currentDayData,
          [type]: processedJson,
        };

        const path = `users/${user.uid}/socratesData/${dateKey}`;
        try {
          // Update Firestore
          await setDoc(doc(db, path), updatedDayData);

          // Update local state
          setSocratesData((prev) => ({
            ...prev,
            [dateKey]: updatedDayData,
          }));

          toast.success(
            `成功匯入 ${dateKey} ${type === "strong" ? "看漲名單" : "看跌名單"}（共 ${json.length} 筆）`,
          );
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path, user);
          toast.error("匯入失敗，請檢查權限或網路連接");
        }
      } catch (error: any) {
        toast.error(`匯入失敗: ${error.message}`);
      }
      // Reset input
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleExportFeaturedJson = () => {
    if (!selectedSocratesDate) {
      toast.error("請先選擇日期");
      return;
    }
    setIsExportingFeatured(true);
    try {
      const dateKey = `${selectedSocratesDate.getFullYear()}-${String(selectedSocratesDate.getMonth() + 1).padStart(2, "0")}-${String(selectedSocratesDate.getDate()).padStart(2, "0")}`;
      const strong = socratesData[dateKey]?.strong || [];
      const weak = socratesData[dateKey]?.weak || [];
      const featuredStrong = strong.filter(item => !!socratesHighlightedRows[item.symbol]);
      const featuredWeak = weak.filter(item => !!socratesHighlightedRows[item.symbol]);
  
      if (featuredStrong.length === 0 && featuredWeak.length === 0) {
        toast.error("目前沒有任何精選名單可供匯出");
        setIsExportingFeatured(false);
        return;
      }
  
      const exportData = {
        date: dateKey,
        strong: featuredStrong,
        weak: featuredWeak,
      };
  
      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `socrates-featured-${dateKey}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  
      toast.success("成功匯出精選名單");
    } catch (error) {
       toast.error("匯出失敗");
    } finally {
      setIsExportingFeatured(false);
    }
  };

  const handleImportFeaturedJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsImportingFeatured(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);

        if (!json.strong && !json.weak) {
          throw new Error("無效的精選名單格式");
        }

        const dateKeyToUse = selectedSocratesDate
          ? `${selectedSocratesDate.getFullYear()}-${String(selectedSocratesDate.getMonth() + 1).padStart(2, "0")}-${String(selectedSocratesDate.getDate()).padStart(2, "0")}`
          : json.date;

        if (!dateKeyToUse) {
           throw new Error("無法確定匯入的日期");
        }

        const currentDayData = socratesData[dateKeyToUse] || { strong: [], weak: [] };
        
        // Merge the lists to prevent duplicates in currentDayData
        const newStrong = [...(currentDayData.strong || [])];
        const newWeak = [...(currentDayData.weak || [])];
        const highlightsToMerge: Record<string, boolean> = { ...socratesHighlightedRows };

        (json.strong || []).forEach((item: any) => {
          if (!newStrong.find(i => i.symbol === item.symbol)) {
            newStrong.push(item);
          }
          highlightsToMerge[item.symbol] = true;
        });

        (json.weak || []).forEach((item: any) => {
          if (!newWeak.find(i => i.symbol === item.symbol)) {
            newWeak.push(item);
          }
          highlightsToMerge[item.symbol] = true;
        });

        const updatedDayData = {
          ...currentDayData,
          strong: newStrong,
          weak: newWeak,
        };

        const path = `users/${user.uid}/socratesData/${dateKeyToUse}`;
        await setDoc(doc(db, path), updatedDayData);

        setSocratesData((prev) => ({
          ...prev,
          [dateKeyToUse]: updatedDayData,
        }));

        setSocratesHighlightedRows(highlightsToMerge);

        toast.success("成功匯入精選名單");
      } catch (error: any) {
        console.error(error);
        toast.error(`匯入失敗: ${error.message}`);
      } finally {
        setIsImportingFeatured(false);
        if (featuredJsonFileInputRef.current) {
          featuredJsonFileInputRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  };

  const deleteSocratesData = async (
    dateKey: string,
    type: "strong" | "weak",
  ) => {
    if (!user) return;

    const currentDayData = socratesData[dateKey] || {};
    const updatedDayData = { ...currentDayData };
    delete updatedDayData[type];

    const path = `users/${user.uid}/socratesData/${dateKey}`;
    try {
      if (Object.keys(updatedDayData).length === 0) {
        // Remove document if no data left for this date
        await deleteDoc(doc(db, path));
        setSocratesData((prev) => {
          const newData = { ...prev };
          delete newData[dateKey];
          return newData;
        });
      } else {
        // Update document
        await setDoc(doc(db, path), updatedDayData);
        setSocratesData((prev) => ({
          ...prev,
          [dateKey]: updatedDayData,
        }));
      }

      toast.success(
        `已刪除 ${dateKey} ${type === "strong" ? "看漲名單" : "看跌名單"}資料`,
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path, user);
      toast.error("刪除失敗，請檢查權限或網路連接");
    }
  };

  const handleSocratesSort = (key: string) => {
    setSocratesSortConfig((prev) => {
      if (prev && prev.key === key && prev.direction === "desc") {
        return { key, direction: "asc" };
      }
      return { key, direction: "desc" };
    });
  };

  const getSortedSocratesData = (data: any[]) => {
    if (socratesSortConfig?.key === "customScore") {
      return [...data].sort((a, b) => {
        const getCrashScore = (val: any) => {
          if (val === "高") return 3;
          if (val === "中") return 2;
          if (val === "低") return 1;
          return Number(val) || 0;
        };
        const scoreA =
          Number(a.buyScore || 0) * socratesSortWeights.buyScore +
          Number(a.sellScore || 0) * socratesSortWeights.sellScore +
          Number(a.qualityScore || 0) * socratesSortWeights.qualityScore +
          Number(a.valueScore || 0) * socratesSortWeights.valueScore +
          getCrashScore(a.crashSimilarity) *
            socratesSortWeights.crashSimilarity;

        const scoreB =
          Number(b.buyScore || 0) * socratesSortWeights.buyScore +
          Number(b.sellScore || 0) * socratesSortWeights.sellScore +
          Number(b.qualityScore || 0) * socratesSortWeights.qualityScore +
          Number(b.valueScore || 0) * socratesSortWeights.valueScore +
          getCrashScore(b.crashSimilarity) *
            socratesSortWeights.crashSimilarity;

        return socratesSortConfig.direction === "asc"
          ? scoreA - scoreB
          : scoreB - scoreA;
      });
    }

    if (!socratesSortConfig) return data;
    return [...data].sort((a, b) => {
      if (a[socratesSortConfig.key] === undefined) return 1;
      if (b[socratesSortConfig.key] === undefined) return -1;

      let valA = a[socratesSortConfig.key];
      let valB = b[socratesSortConfig.key];

      // Attempt numerical comparison if both values are valid numbers or numeric strings
      if (
        valA !== null &&
        valB !== null &&
        valA !== "" &&
        valB !== "" &&
        !isNaN(Number(valA)) &&
        !isNaN(Number(valB))
      ) {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        // String comparison fallback
        valA = String(valA);
        valB = String(valB);
      }

      if (valA < valB) return socratesSortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return socratesSortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  const fetchedTabIdsRef = useRef<Set<string>>(new Set());
  const prevTabIdsStrRef = useRef<string>("");

  useEffect(() => {
    // Quick count of pending orders and fetch recent trades across all active tabs
    const fetchTabData = async () => {
      if (!user) return;

      const activeTabs = tabs.filter((t) => t.status === "ACTIVE" && (!t.userId || t.userId === user.uid));
      const currentTabIdsStr = activeTabs.map(t => t.id).sort().join(",");

      // If the set of active tabs changed, clear our fetched cache to reload fresh
      if (currentTabIdsStr !== prevTabIdsStrRef.current) {
        fetchedTabIdsRef.current.clear();
        prevTabIdsStrRef.current = currentTabIdsStr;
      }

      // 1. Separate priority and other tabs
      const priorityTabs = activeTabs.filter((t) => {
        return getDisplayHoldingStatus(t.holdingStatus) === activeHoldingSubTab;
      });
      const otherTabs = activeTabs.filter(
        (t) => getDisplayHoldingStatus(t.holdingStatus) !== activeHoldingSubTab
      );

      // Determine which ones actually need to be fetched (not in cache)
      const priorityToFetch = priorityTabs.filter(t => !fetchedTabIdsRef.current.has(t.id));
      const otherToFetch = otherTabs.filter(t => !fetchedTabIdsRef.current.has(t.id));

      const fetchSingleTab = async (tab: any) => {
        if (!user || (tab.userId && tab.userId !== user.uid)) {
          return { id: tab.id, orders: [], trades: [], strategy: null };
        }
        let orders: any[] = [];
        let trades: any[] = [];
        let strategy: any = null;

        try {
          // Fetch pending orders
          const qOrders = query(
            collection(db, `stockTabs/${tab.id}/plannedOrders`),
            where("status", "==", "PENDING"),
          );
          const snapshotOrders = await getDocs(qOrders);
          orders = snapshotOrders.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.GET, `stockTabs/${tab.id}/plannedOrders`, user);
          } catch (e) {
            // handleFirestoreError throws formatted JSON error
          }
        }

        try {
          // Fetch trades
          const qTrades = query(collection(db, `stockTabs/${tab.id}/trades`));
          const snapshotTrades = await getDocs(qTrades);
          trades = snapshotTrades.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.GET, `stockTabs/${tab.id}/trades`, user);
          } catch (e) {
            // handleFirestoreError throws formatted JSON error
          }
        }

        try {
          // Fetch strategy directly via point doc get (much faster than collection list)
          const docStrategy = await getDoc(doc(db, "stockTabs", tab.id, "strategy", "main"));
          strategy = docStrategy.exists() ? docStrategy.data() : null;
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.GET, `stockTabs/${tab.id}/strategy/main`, user);
          } catch (e) {
            // handleFirestoreError throws formatted JSON error
          }
        }

        return { id: tab.id, orders, trades, strategy };
      };

      // Helper to update state with loaded results maps
      const mergeResults = (results: any[]) => {
        setActiveTabOrders(prev => {
          const next = { ...prev };
          results.forEach(res => {
            next[res.id] = res.orders;
          });
          try {
            safeSessionStorage.setItem(`cached_tab_orders_v3_${user.uid}`, JSON.stringify(next));
          } catch (e) {}
          return next;
        });

        setActiveTabTrades(prev => {
          const next = { ...prev };
          results.forEach(res => {
            next[res.id] = res.trades;
          });
          try {
            safeSessionStorage.setItem(`cached_tab_trades_v3_${user.uid}`, JSON.stringify(next));
          } catch (e) {}
          return next;
        });

        setActiveTabStrategies(prev => {
          const next = { ...prev };
          results.forEach(res => {
            if (res.strategy) {
              next[res.id] = res.strategy;
            }
          });
          try {
            safeSessionStorage.setItem(`cached_tab_strategies_v3_${user.uid}`, JSON.stringify(next));
          } catch (e) {}
          return next;
        });

        results.forEach(res => {
          fetchedTabIdsRef.current.add(res.id);
        });
      };

      // 2. Fetch priority tabs concurrently for speed!
      if (priorityToFetch.length > 0) {
        try {
          const priorityResults = await Promise.all(priorityToFetch.map(fetchSingleTab));
          mergeResults(priorityResults);
        } catch (err) {
          console.error("Error loading prioritised tab data:", err);
        }
      }

      // 3. Fetch remaining (other) tabs progressively in small background chunks
      if (otherToFetch.length > 0) {
        const scheduleBackgroundChunks = (items: any[], chunkSize = 3) => {
          let index = 0;
          const processNextChunk = async () => {
            if (index >= items.length) return;
            const chunk = items.slice(index, index + chunkSize);
            index += chunkSize;
            try {
              const chunkResults = await Promise.all(chunk.map(fetchSingleTab));
              mergeResults(chunkResults);
            } catch (err) {
              console.error("Error loading background tab chunk:", err);
            }
            if (index < items.length) {
              setTimeout(processNextChunk, 200);
            }
          };
          setTimeout(processNextChunk, 100);
        };

        scheduleBackgroundChunks(otherToFetch);
      }
    };

    if (tabs.length > 0) {
      fetchTabData();
    }
  }, [tabs, user, activeHoldingSubTab]);

  // Alert detection logic
  useEffect(() => {
    const activeTabs = tabs.filter((t) => t.status === "ACTIVE");
    const detectedAlerts: any[] = [];

    activeTabs.forEach((tab) => {
      const currentPrice = tab.currentPrice;
      if (!currentPrice || !activeTabStrategies[tab.id]) return;

      const strategy = activeTabStrategies[tab.id];
      const stockAlerts: { category: string; price: number; label: string }[] =
        [];
      const threshold = 0.02; // 2% 提醒區間

      const checkAlert = (price: number, category: string, label: string) => {
        if (!price || price <= 0) return;
        const diff = Math.abs(currentPrice - price) / price;
        if (diff <= threshold) {
          stockAlerts.push({ category, price, label });
        }
      };

      // 止盈設定
      (strategy.tpTargets || []).forEach((tp: any, i: number) =>
        checkAlert(tp.price, "止盈設定", `止盈目標 ${i + 1}`),
      );

      // 止損設定
      (strategy.slTargets || []).forEach((sl: any, i: number) => {
        if (sl.price) {
          checkAlert(sl.price, "止損設定", `止損目標 ${i + 1}`);
        } else if (sl.percentage) {
          const stats = activeTabTrades[tab.id]
            ? calculateStats(activeTabTrades[tab.id])
            : { averagePrice: 0 };
          const avgPrice = stats.averagePrice || 0;
          if (avgPrice > 0) {
            const isShort = strategy.entries?.[0]?.type === "SELL";
            const changePct =
              sl.percentage > 0 ? -sl.percentage : sl.percentage;
            const calculatedPrice = isShort
              ? avgPrice * (1 - changePct / 100)
              : avgPrice * (1 + changePct / 100);
            checkAlert(
              calculatedPrice,
              "止損設定",
              `止損 % (${sl.percentage}%)`,
            );
          }
        }
      });

      // 分批進出場規劃
      (strategy.entries || []).forEach((entry: any, i: number) => {
        if (entry.priceStr) {
          if (entry.priceStr.includes("-")) {
            const [p1, p2] = entry.priceStr
              .split("-")
              .map((p: string) => parseFloat(p.trim()));
            if (!isNaN(p1))
              checkAlert(p1, "分批進出場", `規劃 P${i + 1} (區間低)`);
            if (!isNaN(p2))
              checkAlert(p2, "分批進出場", `規劃 P${i + 1} (區間高)`);
          } else {
            const p = parseFloat(entry.priceStr);
            if (!isNaN(p)) checkAlert(p, "分批進出場", `規劃價格 P${i + 1}`);
          }
        }
      });

      // 關鍵價格門檻
      (strategy.resistanceZones || []).forEach((zone: any, i: number) =>
        checkAlert(zone.price, "關鍵價格", `壓力區 ${i + 1}`),
      );
      (strategy.supportZones || []).forEach((zone: any, i: number) =>
        checkAlert(zone.price, "關鍵價格", `支撐區 ${i + 1}`),
      );

      if (stockAlerts.length > 0) {
        detectedAlerts.push({
          tab,
          stockAlerts,
        });
      }
    });

    setAlerts(detectedAlerts);
  }, [tabs, activeTabStrategies, activeTabTrades]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [selectedActionTab, setSelectedActionTab] = useState<any>(null);
  const [actionActiveTab, setActionActiveTab] = useState<"general" | "status">("general");
  const [visualizerFocusTabId, setVisualizerFocusTabId] = useState<string | null>(null);
  const [visualizerFocusText, setVisualizerFocusText] = useState("");
  const [manualHighlight, setManualHighlight] = useState<Record<string, boolean>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const handleSearchSelect = useCallback(
    (tabId: string) => {
      setIsSearchOpen(false);
      setActiveViewTab("active");

      const selectedTab = tabs.find((t) => t.id === tabId);
      if (selectedTab) {
        setActiveHoldingSubTab(
          getDisplayHoldingStatus(selectedTab.holdingStatus),
        );
      }

      // Slight delay to ensure tab is switched
      setTimeout(() => {
        const element = document.getElementById(`stock-card-${tabId}`);
        if (element && carouselRef.current) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          // Flash effect or scale up feedback
          element.style.transform = "scale(1.05)";
          setTimeout(() => {
            element.style.transform = "";
          }, 1000);
        }
      }, 100);
    },
    [tabs],
  );

  const handleToggleTabHighlight = useCallback(
    async (tabId: string, currentStatus: boolean | undefined) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, "stockTabs", tabId), {
          isFavoriteHighlight: !currentStatus,
          updatedAt: serverTimestamp(),
        });
        setIsActionDialogOpen(false);
        toast.success(!currentStatus ? "已加入重點關注" : "已取消重點關注");
      } catch (err) {
        console.error("Error updating tab highlight", err);
        toast.error("更新失敗");
      }
    },
    [user],
  );

  const handleImportLatestPrices = useCallback(async () => {
    if (!user) {
      toast.error("請先登入");
      return;
    }

    const currentActiveTabs = tabs.filter((t) => t.status !== "COMPLETED");
    const targetTabs = currentActiveTabs.length > 0 ? currentActiveTabs : tabs;

    if (targetTabs.length === 0) {
      toast.info("尚無股票資料可更新");
      return;
    }

    setIsImportingPrices(true);
    toast.loading("正在抓取最新現價...", { id: "importPrices" });

    try {
      const results = await Promise.allSettled(
        targetTabs.map(async (tab) => {
          if (!tab.symbol || !tab.symbol.trim()) return null;

          const targetUrl = `/api/stock/${encodeURIComponent(tab.symbol.trim())}`;
          const response = await fetch(targetUrl);
          if (!response.ok) return null;

          const data = await response.json();
          const fetchedPrice =
            typeof data?.price === "number" && data.price > 0
              ? data.price
              : data?.chart?.result?.[0]?.meta?.regularMarketPrice;

          if (fetchedPrice && typeof fetchedPrice === "number" && fetchedPrice > 0) {
            await updateDoc(doc(db, "stockTabs", tab.id), {
              currentPrice: fetchedPrice,
            });
            return { id: tab.id, symbol: tab.symbol, price: fetchedPrice };
          }
          return null;
        })
      );

      const successfulUpdates = results
        .filter((r): r is PromiseFulfilledResult<{ id: string; symbol: string; price: number } | null> => r.status === "fulfilled" && !!r.value)
        .map((r) => r.value!);

      if (successfulUpdates.length > 0) {
        playPriceImportSound();
        toast.success(`成功更新 ${successfulUpdates.length} 筆股票最新現價！`, {
          id: "importPrices",
        });
      } else {
        toast.error("無法取得任何最新股票報價，請確認股票代號是否正確", { id: "importPrices" });
      }
    } catch (error) {
      console.error("Price import error:", error);
      toast.error("抓取現價時發生錯誤", { id: "importPrices" });
    } finally {
      setIsImportingPrices(false);
    }
  }, [user, tabs]);

  const handleToggleOrderHighlight = useCallback(
    async (
      tabId: string,
      orderId: string,
      currentStatus: boolean | undefined,
    ) => {
      if (!user) return;
      const path = `stockTabs/${tabId}/plannedOrders/${orderId}`;
      try {
        await updateDoc(doc(db, path), {
          isManualHighlight: !currentStatus,
        });
        // Local state update
        setActiveTabOrders((prev) => {
          const orders = prev[tabId] || [];
          const updatedOrders = orders.map((o) =>
            o.id === orderId ? { ...o, isManualHighlight: !currentStatus } : o,
          );
          return { ...prev, [tabId]: updatedOrders };
        });
      } catch (err) {
        console.error("Error updating highlight", err);
        toast.error("更新失敗");
      }
    },
    [user],
  );

  const handleFlipAllCards = useCallback(() => {
    playSwipeSound();
    setFlippedCards((prev) => {
      const visibleIds = visibleTabsRef.current.map((t) => t.id);
      if (visibleIds.length === 0) return prev;

      // If any visible card is showing the front face (value is false), flip all to back (true)
      // otherwise, flip all to front (false)
      const anyShowingFront = visibleIds.some((id) => prev[id] === false);
      const targetState = anyShowingFront ? true : false;
      const nextState = { ...prev };
      visibleIds.forEach((id) => {
        nextState[id] = targetState;
      });
      return nextState;
    });
  }, []);



  const handleExportNotesJson = () => {
    if (!user) {
      toast.error("請先登入");
      return;
    }
    const activeList = tabs.filter((t) => t.status === "ACTIVE");
    if (activeList.length === 0) {
      toast.error("目前沒有持有中的個股可供匯出備註與計畫");
      return;
    }

    try {
      setIsExportingNotes(true);
      toast.loading("準備匯出個股操作備註與計畫...", { id: "export-notes" });

      const exportedNotes = activeList.map((tab) => {
        const strat = activeTabStrategies[tab.id] || {};
        return {
          symbol: tab.symbol,
          companyName: tab.companyName || "",
          notesHighlighted: strat.notesHighlighted || false,
          tpChecked: strat.tpChecked || false,
          slChecked: strat.slChecked || false,
          addChecked: strat.addChecked || false,
          closeChecked: strat.closeChecked || false,
          observeChecked: strat.observeChecked || false,
          operationFocus: strat.operationFocus || "",
          operationNote: strat.operationNote || "",
          entries: strat.entries || [],
          tpTargets: strat.tpTargets || [],
          slTargets: strat.slTargets || [],
          slConditions: strat.slConditions || "",
          strategyNotes: strat.strategyNotes || "",
          resistanceZones: strat.resistanceZones || [],
          supportZones: strat.supportZones || []
        };
      });

      const exportData = {
        backupDate: new Date().toISOString(),
        userId: user.uid,
        notes: exportedNotes
      };

      const backupJson = JSON.stringify(exportData, null, 2);
      const filename = `StockNotesBackup_${new Date().toISOString().split("T")[0]}_${Date.now()}.json`;

      const blob = new Blob([backupJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("個股操作備註與計畫匯出成功！已下載至本機", { id: "export-notes" });
    } catch (error: any) {
      console.error("Export errors:", error);
      toast.error(`匯出失敗: ${error?.message || "未知錯誤"}`, { id: "export-notes" });
    } finally {
      setIsExportingNotes(false);
    }
  };

  const handleImportNotesJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) {
      toast.error("請確認已登入且頁面正常載入");
      return;
    }

    try {
      setIsImportingNotes(true);
      toast.loading("正在解析個股操作備註備份檔案...", { id: "import-notes" });

      let backupData: any;
      try {
        const text = await file.text();
        backupData = JSON.parse(text);
      } catch (parseError: any) {
        console.error("JSON Parse Error:", parseError);
        throw new Error("檔案格式錯誤，無法解析 JSON");
      }

      let notesList: any[] = [];
      if (Array.isArray(backupData)) {
        notesList = backupData;
      } else if (backupData && Array.isArray(backupData.notes)) {
        notesList = backupData.notes;
      } else if (backupData && Array.isArray(backupData.stockTabs)) {
        // Also support full backup format if uploaded
        notesList = backupData.stockTabs.map((tab: any) => ({
          symbol: tab.symbol,
          ...(tab.strategy || {})
        }));
      } else {
        throw new Error("無效的備份檔案格式：找不到備註/notes 資料");
      }

      if (notesList.length === 0) {
        throw new Error("備份檔案中沒有任何個股備註資料");
      }

      toast.loading(`正在將備註與計畫匯入至 ${notesList.length} 筆資料中...`, {
        id: "import-notes",
      });

      const activeList = tabs.filter((t) => t.status === "ACTIVE");
      const updatedStrategies = { ...activeTabStrategies };
      let successCount = 0;

      for (const item of notesList) {
        if (!item || typeof item.symbol !== "string") continue;

        const matchedTab = activeList.find(
          (t) => t.symbol.toUpperCase() === item.symbol.toUpperCase()
        );

        if (matchedTab) {
          const tabId = matchedTab.id;
          const strategyRef = doc(db, `stockTabs/${tabId}/strategy`, "main");

          const strategyUpdate: any = {
            notesHighlighted: item.notesHighlighted !== undefined ? !!item.notesHighlighted : false,
            tpChecked: item.tpChecked !== undefined ? !!item.tpChecked : false,
            slChecked: item.slChecked !== undefined ? !!item.slChecked : false,
            addChecked: item.addChecked !== undefined ? !!item.addChecked : false,
            closeChecked: item.closeChecked !== undefined ? !!item.closeChecked : false,
            observeChecked: item.observeChecked !== undefined ? !!item.observeChecked : false,
            operationFocus: typeof item.operationFocus === "string" ? item.operationFocus : "",
            operationNote: typeof item.operationNote === "string" ? item.operationNote : "",
            entries: Array.isArray(item.entries) ? item.entries : [],
            tpTargets: Array.isArray(item.tpTargets) ? item.tpTargets : [],
            slTargets: Array.isArray(item.slTargets) ? item.slTargets : [],
            slConditions: typeof item.slConditions === "string" ? item.slConditions : "",
            strategyNotes: typeof item.strategyNotes === "string" ? item.strategyNotes : "",
            resistanceZones: Array.isArray(item.resistanceZones) ? item.resistanceZones : [],
            supportZones: Array.isArray(item.supportZones) ? item.supportZones : [],
            updatedAt: serverTimestamp()
          };

          await setDoc(strategyRef, strategyUpdate, { merge: true });

          updatedStrategies[tabId] = {
            ...(updatedStrategies[tabId] || {}),
            ...strategyUpdate,
            updatedAt: new Date()
          };

          successCount++;
        }
      }

      setActiveTabStrategies(updatedStrategies);
      toast.success(`成功為 ${successCount} 檔個股匯入備註與策略計畫！`, { id: "import-notes" });
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(`匯入失敗: ${error?.message || "未知錯誤"}`, { id: "import-notes" });
    } finally {
      setIsImportingNotes(false);
      if (notesJsonFileInputRef.current) {
        notesJsonFileInputRef.current.value = "";
      }
    }
  };

  const handleExportCompletedTabsJson = async () => {
    if (!user) {
      toast.error("請先登入");
      return;
    }
    const completedList = tabs.filter((t) => t.status === "COMPLETED");
    if (completedList.length === 0) {
      toast.error("目前沒有已完成的交易紀錄可供匯出");
      return;
    }

    try {
      setIsExportingCompleted(true);
      toast.loading("準備匯出已完成交易紀錄中...", { id: "export-completed" });

      const exportData: any = {
        backupDate: new Date().toISOString(),
        userId: user.uid,
        completedTabs: [],
      };

      for (const tab of completedList) {
        const tabData = {
          symbol: tab.symbol,
          companyName: tab.companyName || "",
          status: tab.status,
          isHidden: tab.isHidden || false,
          groupId: tab.groupId || "",
          sortOrder: tab.sortOrder !== undefined ? tab.sortOrder : 999999,
          tradeDirection: tab.tradeDirection || "看漲",
          holdingStatus: tab.holdingStatus || "平倉操作",
          finalPnL: tab.finalPnL || 0,
          currentPrice: tab.currentPrice || 0,
          tags: tab.tags || [],
          tradeType: tab.tradeType || "simulated",
          buyRate: tab.buyRate || 5,
          sellRate: tab.sellRate || 5,
          rating: tab.rating || 5,
          qualityScore: tab.qualityScore || 5,
          valueScore: tab.valueScore || 5,
          crashSimilarity: tab.crashSimilarity || 5,
          volatility: tab.volatility || "中等",
          shortTermImpact: tab.shortTermImpact || "觀察",
          longTermOutlook: tab.longTermOutlook || "觀察",
          isFavoriteHighlight: tab.isFavoriteHighlight || false,
          isOperationConfirmed: tab.isOperationConfirmed || false,
          isDeviationConfirmed: tab.isDeviationConfirmed || false,
          createdAt: getTimestampDate(tab.createdAt)?.toISOString() || new Date().toISOString(),
          updatedAt: getTimestampDate(tab.updatedAt)?.toISOString() || new Date().toISOString(),
          trades: [] as any[],
          plannedOrders: [] as any[],
          strategy: null as any,
          dailyReports: [] as any[],
        };

        // Fetch Trades
        const tradesSnapshot = await getDocs(
          collection(db, `stockTabs/${tab.id}/trades`),
        );
        tabData.trades = tradesSnapshot.docs.map((d) => {
          const t = d.data();
          return {
            type: t.type,
            purpose: t.purpose || "加碼",
            operator: t.operator || "人",
            price: t.price,
            quantity: t.quantity,
            tradeDate: getTimestampDate(t.tradeDate)?.toISOString() || new Date().toISOString(),
            fees: t.fees || 0,
            notes: t.notes || "",
            createdAt: getTimestampDate(t.createdAt)?.toISOString() || new Date().toISOString(),
          };
        });

        // Fetch Planned Orders
        const ordersSnapshot = await getDocs(
          collection(db, `stockTabs/${tab.id}/plannedOrders`),
        );
        tabData.plannedOrders = ordersSnapshot.docs.map((d) => {
          const o = d.data();
          return {
            direction: o.direction,
            purpose: o.purpose || "加碼",
            price: o.price,
            quantity: o.quantity,
            conditions: o.conditions || "",
            notes: o.notes || "",
            status: o.status || "PENDING",
            category: o.category || "分批進出場規劃",
            plannedDate: o.plannedDate ? (getTimestampDate(o.plannedDate)?.toISOString() || null) : null,
            createdAt: getTimestampDate(o.createdAt)?.toISOString() || new Date().toISOString(),
          };
        });

        // Fetch Strategy
        const strategySnapshot = await getDocs(
          collection(db, `stockTabs/${tab.id}/strategy`),
        );
        const mainStrategy = strategySnapshot.docs.find((d) => d.id === "main");
        if (mainStrategy) {
          const s = mainStrategy.data();
          tabData.strategy = {
            entries: s.entries || [],
            tpTargets: s.tpTargets || [],
            slTargets: s.slTargets || [],
            slConditions: s.slConditions || "",
            strategyNotes: s.strategyNotes || "",
            operationNote: s.operationNote || "",
            resistanceZones: s.resistanceZones || [],
            supportZones: s.supportZones || [],
            updatedAt: getTimestampDate(s.updatedAt)?.toISOString() || new Date().toISOString(),
          };
        }

        // Fetch Daily Reports
        const reportsSnapshot = await getDocs(
          collection(db, `stockTabs/${tab.id}/dailyReports`),
        );
        tabData.dailyReports = reportsSnapshot.docs.map((d) => {
          const r = d.data();
          return {
            date: r.date,
            summary: r.summary || "",
            score: r.score || 5,
            notes: r.notes || "",
            createdAt: getTimestampDate(r.createdAt)?.toISOString() || new Date().toISOString(),
          };
        });

        exportData.completedTabs.push(tabData);
      }

      const backupJson = JSON.stringify(exportData, null, 2);
      const filename = `CompletedTradingBackup_${new Date().toISOString().split("T")[0]}_${Date.now()}.json`;

      const blob = new Blob([backupJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("已完成交易紀錄匯出成功！已下載至本機", { id: "export-completed" });
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(`匯出失敗: ${error?.message || "未知錯誤"}`, { id: "export-completed" });
    } finally {
      setIsExportingCompleted(false);
    }
  };

  const handleImportCompletedTabsJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Helper to recursively convert ISO strings to Firestore Timestamps
    const processData = (obj: any): any => {
      if (!obj || typeof obj !== "object" || obj instanceof Timestamp)
        return obj;

      if (Array.isArray(obj)) {
        return obj.map((item) => processData(item));
      }

      if (
        obj.type === "firestore/timestamp/1.0" &&
        typeof obj.seconds === "number" &&
        typeof obj.nanoseconds === "number"
      ) {
        return new Timestamp(obj.seconds, obj.nanoseconds);
      }

      const newObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (
          typeof value === "string" &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
        ) {
          newObj[key] = Timestamp.fromDate(new Date(value));
        } else {
          newObj[key] = processData(value);
        }
      }
      return newObj;
    };

    try {
      setIsImportingCompleted(true);
      toast.loading("正在解析已完成交易紀錄備份檔案...", { id: "import-completed" });

      let backupData: any;
      try {
        const text = await file.text();
        backupData = JSON.parse(text);
      } catch (parseError: any) {
        console.error("JSON Parse Error:", parseError);
        throw new Error("檔案格式錯誤，無法解析 JSON");
      }

      const rawTabs = backupData.completedTabs || backupData.stockTabs;

      if (!rawTabs || !Array.isArray(rawTabs)) {
        throw new Error("無效的備份檔案內容：找不到交易紀錄/stockTabs 資料");
      }

      toast.loading(`正在匯入 ${rawTabs.length} 筆已完成交易資料...`, {
        id: "import-completed",
      });

      let count = 0;
      for (const rawTabData of rawTabs) {
        try {
          const tabData = processData(rawTabData);
          const { trades, plannedOrders, strategy, dailyReports, id, ...rest } =
            tabData;

          if (!rest.symbol) {
            console.warn("Skipping tab without symbol:", tabData);
            continue;
          }

          // Force status to COMPLETED
          rest.status = "COMPLETED";

          // Generate a brand new document reference to avoid overwrites
          const newTabRef = doc(collection(db, "stockTabs"));
          const newId = newTabRef.id;

          await setDoc(newTabRef, {
            ...rest,
            userId: user.uid,
            createdAt: rest.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Restore Trades
          if (Array.isArray(trades)) {
            for (const trade of trades) {
              const { id: tradeId, ...tradeRest } = trade;
              const newTradeRef = doc(collection(db, `stockTabs/${newId}/trades`));
              await setDoc(newTradeRef, {
                ...tradeRest,
                createdAt: tradeRest.createdAt || serverTimestamp(),
              });
            }
          }

          // Restore Planned Orders
          if (Array.isArray(plannedOrders)) {
            for (const order of plannedOrders) {
              const { id: orderId, ...orderRest } = order;
              const newOrderRef = doc(collection(db, `stockTabs/${newId}/plannedOrders`));
              await setDoc(newOrderRef, {
                ...orderRest,
                createdAt: orderRest.createdAt || serverTimestamp(),
              });
            }
          }

          // Restore Strategy
          if (strategy) {
            const { id: strategyId, ...strategyRest } = strategy;
            await setDoc(
              doc(db, `stockTabs/${newId}/strategy`, "main"),
              {
                ...strategyRest,
                updatedAt: serverTimestamp(),
              }
            );
          }

          // Restore Daily Reports
          if (Array.isArray(dailyReports)) {
            for (const report of dailyReports) {
              const { id: reportId, ...reportRest } = report;
              const newReportRef = doc(collection(db, `stockTabs/${newId}/dailyReports`));
              await setDoc(newReportRef, {
                ...reportRest,
                createdAt: reportRest.createdAt || serverTimestamp(),
              });
            }
          }

          count++;
        } catch (tabError: any) {
          console.error("Failed to restore completed tab:", tabError);
        }
      }

      toast.success(`成功匯入 ${count} 筆已完成交易紀錄！`, { id: "import-completed" });
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(`匯入失敗: ${error?.message || "未知錯誤"}`, { id: "import-completed" });
    } finally {
      setIsImportingCompleted(false);
      if (completedJsonFileInputRef.current) {
        completedJsonFileInputRef.current.value = "";
      }
    }
  };

  const handleExportLocal = async () => {
    if (!user) {
      toast.error("請先登入");
      return;
    }
    try {
      setIsExporting(true);
      toast.loading("準備備份資料中...", { id: "export" });

      const exportData: any = {
        backupDate: new Date().toISOString(),
        userId: user.uid,
        stockTabs: [],
      };

      const q = query(
        collection(db, "stockTabs"),
        where("userId", "==", user.uid),
      );
      const tabsSnapshot = await getDocs(q);

      for (const docSnap of tabsSnapshot.docs) {
        const tabData = {
          id: docSnap.id,
          ...(docSnap.data() as any),
          trades: [],
          plannedOrders: [],
          strategy: null,
          dailyReports: [],
        };

        // Fetch Trades
        const tradesSnapshot = await getDocs(
          collection(db, `stockTabs/${docSnap.id}/trades`),
        );
        tabData.trades = tradesSnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Fetch Planned Orders
        const ordersSnapshot = await getDocs(
          collection(db, `stockTabs/${docSnap.id}/plannedOrders`),
        );
        tabData.plannedOrders = ordersSnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Fetch Strategy
        const strategySnapshot = await getDocs(
          collection(db, `stockTabs/${docSnap.id}/strategy`),
        );
        const mainStrategy = strategySnapshot.docs.find((d) => d.id === "main");
        if (mainStrategy) {
          tabData.strategy = { id: mainStrategy.id, ...mainStrategy.data() };
        }

        // Fetch Daily Reports
        const reportsSnapshot = await getDocs(
          collection(db, `stockTabs/${docSnap.id}/dailyReports`),
        );
        tabData.dailyReports = reportsSnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        exportData.stockTabs.push(tabData);
      }

      // 3. Fetch Socrates Data
      const socratesSnapshot = await getDocs(
        query(collection(db, `users/${user.uid}/socratesData`)),
      );
      exportData.socratesData = socratesSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const backupJson = JSON.stringify(exportData, null, 2);
      const filename = `TradingBackup_${new Date().toISOString().split("T")[0]}_${Date.now()}.json`;

      const blob = new Blob([backupJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("備份成功！已下載至本機", { id: "export" });
    } catch (error: any) {
      console.error("Export error:", error);
      const msg = error?.message || "未知錯誤";
      toast.error(`匯出失敗: ${msg}`, { id: "export" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (
      !window.confirm(
        "如果您繼續，將會清空目前的資料並由備份檔取代。此動作無法還原，確定要執行嗎？",
      )
    ) {
      e.target.value = "";
      return;
    }

    // Helper to recursively convert ISO strings to Firestore Timestamps
    const processData = (obj: any): any => {
      if (!obj || typeof obj !== "object" || obj instanceof Timestamp)
        return obj;

      if (Array.isArray(obj)) {
        return obj.map((item) => processData(item));
      }

      // Handle Firestore Timestamp JSON representation
      if (
        obj.type === "firestore/timestamp/1.0" &&
        typeof obj.seconds === "number" &&
        typeof obj.nanoseconds === "number"
      ) {
        return new Timestamp(obj.seconds, obj.nanoseconds);
      }

      const newObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Handle common date fields in ISO format
        if (
          typeof value === "string" &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
        ) {
          newObj[key] = Timestamp.fromDate(new Date(value));
        } else {
          newObj[key] = processData(value);
        }
      }
      return newObj;
    };

    try {
      setIsImporting(true);
      console.log("Import process started...");
      toast.loading("正在解析備份檔案...", { id: "import" });

      let backupData: any;
      try {
        const text = await file.text();
        backupData = JSON.parse(text);
      } catch (parseError: any) {
        console.error("JSON Parse Error:", parseError);
        throw new Error("備份檔案格式錯誤，無法解析 JSON");
      }

      if (
        !backupData ||
        !backupData.stockTabs ||
        !Array.isArray(backupData.stockTabs)
      ) {
        throw new Error("無效的備份檔案內容：找不到 stockTabs 資料");
      }

      console.log(`Found ${backupData.stockTabs.length} tabs to restore.`);
      toast.loading("正在清理舊資料...", { id: "import" });

      // 1. Find all user tabs
      const q = query(
        collection(db, "stockTabs"),
        where("userId", "==", user.uid),
      );
      const oldTabs = await getDocs(q);

      console.log(`Deleting ${oldTabs.size} existing tabs...`);
      // Clean up subcollections for each old tab
      for (const oldTab of oldTabs.docs) {
        const docId = oldTab.id;
        try {
          const subCollections = [
            "trades",
            "plannedOrders",
            "strategy",
            "dailyReports",
          ];
          for (const sub of subCollections) {
            const snap = await getDocs(
              collection(db, `stockTabs/${docId}/${sub}`),
            );
            for (const d of snap.docs) await deleteDoc(d.ref);
          }
          await deleteDoc(oldTab.ref);
        } catch (delError: any) {
          console.warn(`Failed to clean up tab ${docId}:`, delError);
        }
      }

      // Cleanup Socrates Data
      console.log("Cleaning up Socrates data...");
      const socratesSnap = await getDocs(
        query(collection(db, `users/${user.uid}/socratesData`)),
      );
      for (const d of socratesSnap.docs) await deleteDoc(d.ref);

      toast.loading(`正在還原 ${backupData.stockTabs.length} 筆個股資料...`, {
        id: "import",
      });

      // 2. Import new tabs
      let count = 0;
      for (const rawTabData of backupData.stockTabs) {
        try {
          const tabData = processData(rawTabData);
          const { trades, plannedOrders, strategy, dailyReports, id, ...rest } =
            tabData;

          if (!rest.symbol) {
            console.warn("Skipping tab without symbol:", tabData);
            continue;
          }

          console.log(
            `Restoring tab [${++count}/${backupData.stockTabs.length}]: ${rest.symbol} (${id})`,
          );

          // Restore tab
          await setDoc(doc(db, "stockTabs", id), {
            ...rest,
            userId: user.uid,
            updatedAt: serverTimestamp(),
          });

          // Restore Trades
          if (Array.isArray(trades)) {
            for (const trade of trades) {
              const { id: tradeId, ...tradeRest } = trade;
              await setDoc(
                doc(db, `stockTabs/${id}/trades`, tradeId),
                tradeRest,
              );
            }
          }

          // Restore Planned Orders
          if (Array.isArray(plannedOrders)) {
            for (const order of plannedOrders) {
              const { id: orderId, ...orderRest } = order;
              await setDoc(
                doc(db, `stockTabs/${id}/plannedOrders`, orderId),
                orderRest,
              );
            }
          }

          // Restore Strategy
          if (strategy) {
            const { id: strategyId, ...strategyRest } = strategy;
            await setDoc(
              doc(db, `stockTabs/${id}/strategy`, strategyId),
              strategyRest,
            );
          }

          // Restore Daily Reports
          if (Array.isArray(dailyReports)) {
            for (const report of dailyReports) {
              const { id: reportId, ...reportRest } = report;
              await setDoc(
                doc(db, `stockTabs/${id}/dailyReports`, reportId),
                reportRest,
              );
            }
          }
        } catch (tabError: any) {
          console.error(
            `Failed to restore tab ${rawTabData.symbol || "unknown"}:`,
            tabError,
          );
          throw new Error(
            `還原個股 ${rawTabData.symbol || "未知"} 時發生權限或格式錯誤: ${tabError.message}`,
          );
        }
      }

      // 3. Import Socrates Data
      if (Array.isArray(backupData.socratesData)) {
        console.log(
          `Restoring ${backupData.socratesData.length} Socrates records...`,
        );
        for (const rawSoc of backupData.socratesData) {
          const soc = processData(rawSoc);
          const { id: dateKey, ...socData } = soc;
          await setDoc(
            doc(db, `users/${user.uid}/socratesData`, dateKey),
            socData,
          );
        }
      }

      console.log("Restoration completed successfully.");
      toast.success("資料還原成功！系統將在 1.5 秒後重新整理", {
        id: "import",
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error("Import process failed:", error);
      toast.error(`還原失敗: ${error.message}`, { id: "import" });
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = "";
    }
  };

  const activeTabs = useMemo(() => tabs.filter((t) => t.status === "ACTIVE"), [tabs]);

  const totalRealHoldingCost = useMemo(() => {
    return activeTabs
      .filter((tab) => tab.tradeType === "real")
      .reduce((sum, tab) => {
        const trades = activeTabTrades[tab.id] || [];
        const stats = calculateStats(trades, tab.currentPrice);
        return sum + (stats.totalQuantity * stats.averagePrice);
      }, 0);
  }, [activeTabs, activeTabTrades]);

  const totalVirtualHoldingCost = useMemo(() => {
    return activeTabs
      .filter((tab) => tab.tradeType === "simulated")
      .reduce((sum, tab) => {
        const trades = activeTabTrades[tab.id] || [];
        const stats = calculateStats(trades, tab.currentPrice);
        return sum + (stats.totalQuantity * stats.averagePrice);
      }, 0);
  }, [activeTabs, activeTabTrades]);

  const simulatedUnrealizedPnL = useMemo(() => {
    return activeTabs
      .filter((tab) => tab.tradeType === "simulated")
      .reduce((acc, tab) => {
        const trades = activeTabTrades[tab.id] || [];
        const stats = calculateStats(trades, tab.currentPrice);
        return acc + (stats.unrealizedPnL || 0);
      }, 0);
  }, [activeTabs, activeTabTrades]);

  const remainingBalance = totalCapital - totalRealHoldingCost;

  const visibleActiveTabs = useMemo(() => activeTabs.filter((t) => !t.isHidden), [activeTabs]);
  const hiddenActiveTabs = useMemo(() => activeTabs.filter((t) => t.isHidden), [activeTabs]);

  const filledCategories = useMemo(() => {
    const allCats = ["觀察中", "候選名單", "買進操作", "賣出操作", "平倉操作", "乖離名單"] as const;
    return allCats.filter(cat => 
      visibleActiveTabs.some(t => getDisplayHoldingStatus(t.holdingStatus) === cat)
    );
  }, [visibleActiveTabs]);

  const effectiveActiveTabs = useMemo(() => {
    if (activeViewTab === "real") {
      return activeTabs.filter((t) => t.tradeType === "real");
    }
    if (activeViewTab === "active") {
      return activeTabs.filter((t) => t.tradeType === "simulated");
    }
    return activeTabs;
  }, [activeTabs, activeViewTab]);

  const effectiveVisibleActiveTabs = useMemo(() => {
    if (activeViewTab === "real") {
      return visibleActiveTabs.filter((t) => t.tradeType === "real");
    }
    if (activeViewTab === "active") {
      return visibleActiveTabs.filter((t) => t.tradeType === "simulated");
    }
    return visibleActiveTabs;
  }, [visibleActiveTabs, activeViewTab]);

  const effectiveHiddenActiveTabs = useMemo(() => {
    if (activeViewTab === "real") {
      return hiddenActiveTabs.filter((t) => t.tradeType === "real");
    }
    if (activeViewTab === "active") {
      return hiddenActiveTabs.filter((t) => t.tradeType === "simulated");
    }
    return hiddenActiveTabs;
  }, [hiddenActiveTabs, activeViewTab]);

  const visibleSubTabs = useMemo(() => {
    const list = [
      "觀察中",
      "候選名單",
      "買進操作",
      "賣出操作",
      "平倉操作",
      "乖離名單",
    ] as const;
    return list.filter((tab) => {
      const tabCount = effectiveVisibleActiveTabs.filter(
        (t) => getDisplayHoldingStatus(t.holdingStatus) === tab,
      ).length;
      return tabCount > 0;
    });
  }, [effectiveVisibleActiveTabs]);

  // Adjust active sub tab if the current one has no cards & other active sub tabs are available
  useEffect(() => {
    const hasCardsInCurrentSubTab = effectiveVisibleActiveTabs.some(
      (t) => getDisplayHoldingStatus(t.holdingStatus) === activeHoldingSubTab
    );
    if (!hasCardsInCurrentSubTab && visibleSubTabs.length > 0 && !visibleSubTabs.includes(activeHoldingSubTab)) {
      const state = location.state as { autoFlipTabId?: string; returnStockId?: string } | null;
      const hasPendingFocus = state?.autoFlipTabId || state?.returnStockId || safeSessionStorage.getItem('lastViewedStockId');
      if (!hasPendingFocus) {
        setActiveHoldingSubTab(visibleSubTabs[0]);
      }
    }
  }, [visibleSubTabs, activeHoldingSubTab, effectiveVisibleActiveTabs, location.state]);

  const handleExportMd = useCallback(async () => {
    toast.info("正在準備持股交易數據...");
    const tradesMap = { ...activeTabTrades };

    try {
      const activeTabs = tabs.filter((t) => t.status === "ACTIVE" && (!t.userId || t.userId === user.uid));
      const missingTabs = activeTabs.filter((tab) => !tradesMap[tab.id]);

      if (missingTabs.length > 0) {
        await Promise.all(
          missingTabs.map(async (tab) => {
            try {
              const qTrades = query(collection(db, `stockTabs/${tab.id}/trades`));
              const snapshotTrades = await getDocs(qTrades);
              const trades = snapshotTrades.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }));
              tradesMap[tab.id] = trades;
            } catch (err) {
              try {
                handleFirestoreError(err, OperationType.GET, `stockTabs/${tab.id}/trades`, user);
              } catch (e) {
                // handleFirestoreError throws formatted JSON error
              }
              tradesMap[tab.id] = [];
            }
          })
        );
      }

      const symbolMap: Record<string, { totalQuantity: number; totalCost: number }> = {};
      
      // Initialize with 0 for all active cards' symbols (satisfies "若無交易則顯示為0")
      activeTabs.forEach((tab) => {
        symbolMap[tab.symbol] = { totalQuantity: 0, totalCost: 0 };
      });

      // Sum up holding quantity and calculate weighted cost for each active card
      activeTabs.forEach((tab) => {
        const trades = tradesMap[tab.id] || [];
        const stats = calculateStats(trades, tab.currentPrice);
        const qty = stats.totalQuantity || 0;
        const avgPrice = stats.averagePrice || 0;
        
        symbolMap[tab.symbol].totalQuantity += qty;
        symbolMap[tab.symbol].totalCost += qty * avgPrice;
      });

      const lines: string[] = [
        "| 個股名稱 | 持有股數 | 平均成本 |",
        "|------|------|------|"
      ];
      const sortedSymbols = Object.keys(symbolMap).sort();
      sortedSymbols.forEach((sym) => {
        const item = symbolMap[sym];
        const avgCost = item.totalQuantity > 0 ? (item.totalCost / item.totalQuantity) : 0;
        const formattedAvgCost = avgCost % 1 === 0 ? avgCost : Number(avgCost.toFixed(2));
        lines.push(`| ${sym}  | ${item.totalQuantity}   | ${formattedAvgCost}   |`);
      });

      const mdContent = lines.join("\n");
      const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `holding_stocks_report_${format(new Date(), "yyyyMMdd_HHmmss")}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      playSuccessSound();
      toast.success("成功匯出持股資料 md 檔案！");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("匯出持股資料失敗");
    }
  }, [tabs, activeTabTrades, playSuccessSound]);

  // further categorize visible tabs based on holdingStatus for rendering
  const currentSubTabVisibleTabs = effectiveVisibleActiveTabs.filter(
    (t) => getDisplayHoldingStatus(t.holdingStatus) === activeHoldingSubTab,
  );

  // Automatically reset card definition filter if it has no items in the active sub tab
  useEffect(() => {
    if (activeCardDefinitionFilter !== "all" && currentSubTabVisibleTabs) {
      const counts: Record<string, number> = {
        highlight: currentSubTabVisibleTabs.filter(t => !!t.isFavoriteHighlight).length,
        operation: currentSubTabVisibleTabs.filter(t => !!t.isOperationConfirmed).length,
        deviation: currentSubTabVisibleTabs.filter(t => !!t.isDeviationConfirmed).length,
        group: currentSubTabVisibleTabs.filter(t => !!t.groupId).length,
      };
      if (counts[activeCardDefinitionFilter] === 0) {
        setActiveCardDefinitionFilter("all");
      }
    }
  }, [currentSubTabVisibleTabs, activeCardDefinitionFilter]);

  const filteredSubTabVisibleTabs = useMemo(() => {
    switch (activeCardDefinitionFilter) {
      case "highlight":
        return currentSubTabVisibleTabs.filter(t => !!t.isFavoriteHighlight);
      case "operation":
        return currentSubTabVisibleTabs.filter(t => !!t.isOperationConfirmed);
      case "deviation":
        return currentSubTabVisibleTabs.filter(t => !!t.isDeviationConfirmed);
      case "group":
        return currentSubTabVisibleTabs.filter(t => !!t.groupId);
      default:
        return currentSubTabVisibleTabs;
    }
  }, [currentSubTabVisibleTabs, activeCardDefinitionFilter]);

  visibleTabsRef.current = filteredSubTabVisibleTabs;

  const renderGroups = useMemo(() => {
    const groups: { isGroup: boolean; id: string; tabs: any[] }[] = [];
    const processedGroupIds = new Set<string>();
    
    filteredSubTabVisibleTabs.forEach((tab) => {
      const shouldGroup = tab.groupId && !isMobile;
      if (shouldGroup) {
        if (!processedGroupIds.has(tab.groupId!)) {
          processedGroupIds.add(tab.groupId!);
          const allGroupTabs = effectiveVisibleActiveTabs.filter(t => t.groupId === tab.groupId);
          groups.push({
            isGroup: true,
            id: tab.groupId!,
            tabs: allGroupTabs
          });
        }
      } else {
        groups.push({
          isGroup: false,
          id: tab.id,
          tabs: [tab]
        });
      }
    });
    return groups;
  }, [filteredSubTabVisibleTabs, effectiveVisibleActiveTabs, isMobile]);

  const orderedFilteredSubTabVisibleTabs = useMemo(() => {
    return renderGroups.flatMap((g) => g.tabs);
  }, [renderGroups]);

  const handleToggleCardSelected = useCallback((tabId: string) => {
    playClickSound();
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) {
        next.delete(tabId);
      } else {
        next.add(tabId);
      }
      const userKey = user ? user.uid : "guest";
      try {
        safeLocalStorage.setItem(
          `selected-card-ids-${userKey}`,
          JSON.stringify(Array.from(next))
        );
      } catch (e) {
        console.error("Failed to persist selected card IDs:", e);
      }
      return next;
    });
  }, [user]);

  const handleSelectAll = useCallback(() => {
    playClickSound();
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      const currentVisibleIds = filteredSubTabVisibleTabs.map((t) => t.id);
      const allCurrentSelected =
        currentVisibleIds.length > 0 &&
        currentVisibleIds.every((id) => next.has(id));

      if (allCurrentSelected) {
        // If current sub-tab is already all selected, select all cards in all sub-tabs
        effectiveVisibleActiveTabs.forEach((t) => next.add(t.id));
        toast.success(`已全選所有子分頁共 ${effectiveVisibleActiveTabs.length} 檔個股`);
      } else {
        currentVisibleIds.forEach((id) => next.add(id));
        toast.success(`已全選目前子分頁 ${currentVisibleIds.length} 檔個股`);
      }
      const userKey = user ? user.uid : "guest";
      try {
        safeLocalStorage.setItem(
          `selected-card-ids-${userKey}`,
          JSON.stringify(Array.from(next))
        );
      } catch (e) {
        console.error("Failed to persist selected card IDs:", e);
      }
      return next;
    });
  }, [filteredSubTabVisibleTabs, effectiveVisibleActiveTabs, user]);

  const handleDeselectAll = useCallback(() => {
    playClickSound();
    setSelectedCardIds(new Set());
    const userKey = user ? user.uid : "guest";
    try {
      safeLocalStorage.setItem(
        `selected-card-ids-${userKey}`,
        JSON.stringify([])
      );
    } catch (e) {
      console.error("Failed to clear persisted selected card IDs:", e);
    }
    toast.info("已取消全選所有個股");
  }, [user]);

  const fetchUploadedHtmlFiles = async (symbolFilter?: string) => {
    if (!user) return;
    try {
      let url = `/api/html-files?userId=${user.uid}`;
      if (symbolFilter) {
        url += `&symbol=${encodeURIComponent(symbolFilter.trim().toUpperCase())}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setHtmlFilesList(data);
      }
    } catch (error) {
      console.error("Failed to fetch HTML files:", error);
    }
  };

  // Compute active stock symbol as a stable primitive dependency string to prevent resetting preview state on unstable array rerenders
  const activeCinemaSymbol = useMemo(() => {
    const activeTab = orderedFilteredSubTabVisibleTabs.find(t => t.id === activeCinemaCardId);
    return activeTab?.symbol || "";
  }, [orderedFilteredSubTabVisibleTabs, activeCinemaCardId]);

  // Automatically update and filter HTML files when the active stock card changes in Cinema Focus mode
  useEffect(() => {
    if (isPreviewHtmlOpen && htmlContext === "dynamic" && activeCinemaSymbol) {
      fetchUploadedHtmlFiles(activeCinemaSymbol);
      // Reset selected file to avoid showing the preview of the previous card's HTML file
      setSelectedPreviewFileId(null);
    }
  }, [isPreviewHtmlOpen, activeCinemaSymbol, htmlContext]);

  const handleHtmlFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldIndex: 1 | 2) => {
    const file = e.target.files?.[0];
    if (file) {
      if (fieldIndex === 1) {
        setHtmlFileToUpload(file);
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setHtmlFileContent(event.target.result as string);
          }
        };
        reader.readAsText(file);
      } else {
        setHtmlFileToUpload2(file);
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setHtmlFileContent2(event.target.result as string);
          }
        };
        reader.readAsText(file);
      }
    }
  };

  const handleUploadHtmlSubmit = async () => {
    if (!user) {
      toast.error("請先登入");
      return;
    }
    if (!htmlUploadSymbol.trim()) {
      toast.error("請輸入或選擇個股名稱");
      return;
    }
    if (!htmlFileContent && !htmlFileContent2) {
      toast.error("請選擇要上傳的 HTML 檔案");
      return;
    }

    setIsUploadingHtml(true);
    const dateFormatted = htmlUploadDate.replace(/-/g, ""); // e.g. 20260708
    const cleanSymbol = htmlUploadSymbol.trim().toUpperCase();

    try {
      const uploadPromises = [];

      if (htmlFileContent) {
        const finalFilename1 = htmlFileContent2
          ? `${cleanSymbol}_${dateFormatted}_1.html`
          : `${cleanSymbol}_${dateFormatted}.html`;

        uploadPromises.push(
          fetch("/api/html-files", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: user.uid,
              symbol: cleanSymbol,
              filename: finalFilename1,
              htmlContent: htmlFileContent,
            }),
          })
        );
      }

      if (htmlFileContent2) {
        const finalFilename2 = `${cleanSymbol}_${dateFormatted}_2.html`;

        uploadPromises.push(
          fetch("/api/html-files", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: user.uid,
              symbol: cleanSymbol,
              filename: finalFilename2,
              htmlContent: htmlFileContent2,
            }),
          })
        );
      }

      const responses = await Promise.all(uploadPromises);
      let allOk = true;
      for (const res of responses) {
        if (!res.ok) {
          allOk = false;
        }
      }

      if (allOk) {
        setIsUploadHtmlOpen(false);
        setHtmlFileToUpload(null);
        setHtmlFileContent("");
        setHtmlFileToUpload2(null);
        setHtmlFileContent2("");
        if (htmlContext === "dynamic") {
          const activeTab = orderedFilteredSubTabVisibleTabs.find(t => t.id === activeCinemaCardId);
          fetchUploadedHtmlFiles(activeTab?.symbol);
        } else if (htmlContext === "market_filter") {
          fetchUploadedHtmlFiles("MARKET_FILTER");
        } else if (htmlContext === "stock_micro") {
          fetchUploadedHtmlFiles("STOCK_MICRO");
        } else if (htmlContext === "fed") {
          fetchUploadedHtmlFiles("FED");
        } else if (htmlContext === "plus_70") {
          fetchUploadedHtmlFiles("+70");
        }
        toast.success("HTML 檔案上傳成功");
      } else {
        toast.error("檔案上傳失敗");
      }
    } catch (error) {
      console.error("Error uploading HTML file:", error);
      toast.error("上傳出錯，請稍後再試");
    } finally {
      setIsUploadingHtml(false);
    }
  };

  const handleDeleteHtmlFile = async (id: number) => {
    try {
      const response = await fetch(`/api/html-files/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setHtmlFilesList(prev => prev.filter(f => f.id !== id));
        if (selectedPreviewFileId === id) {
          setSelectedPreviewFileId(null);
        }
        if (deletingFileId === id) {
          setDeletingFileId(null);
        }
        toast.success("檔案已成功刪除");
      } else {
        toast.error("刪除失敗");
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
      toast.error("刪除失敗，發生錯誤");
    }
  };

  useEffect(() => {
    if (!isCinemaModeActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "x" || e.key === "X") {
        setIsCinemaModeActive(false);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const currentIndex = orderedFilteredSubTabVisibleTabs.findIndex(t => t.id === activeCinemaCardId);
        if (currentIndex !== -1 && orderedFilteredSubTabVisibleTabs.length > 1) {
          const nextIndex = (currentIndex + 1) % orderedFilteredSubTabVisibleTabs.length;
          setActiveCinemaCardId(orderedFilteredSubTabVisibleTabs[nextIndex].id);
          playSwipeSound();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const currentIndex = orderedFilteredSubTabVisibleTabs.findIndex(t => t.id === activeCinemaCardId);
        if (currentIndex !== -1 && orderedFilteredSubTabVisibleTabs.length > 1) {
          const prevIndex = (currentIndex - 1 + orderedFilteredSubTabVisibleTabs.length) % orderedFilteredSubTabVisibleTabs.length;
          setActiveCinemaCardId(orderedFilteredSubTabVisibleTabs[prevIndex].id);
          playSwipeSound();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isCinemaModeActive, orderedFilteredSubTabVisibleTabs, activeCinemaCardId]);

  // Sync activeCinemaCardId when orderedFilteredSubTabVisibleTabs changes in Cinema Focus Mode
  useEffect(() => {
    if (!isCinemaModeActive) return;
    if (orderedFilteredSubTabVisibleTabs.length > 0) {
      const exists = orderedFilteredSubTabVisibleTabs.some(t => t.id === activeCinemaCardId);
      if (!exists) {
        setActiveCinemaCardId(orderedFilteredSubTabVisibleTabs[0].id);
      }
    } else {
      setActiveCinemaCardId(null);
    }
  }, [isCinemaModeActive, orderedFilteredSubTabVisibleTabs, activeCinemaCardId]);

  // Active Card Tab & Sliding Indicator state for desktop carousel
  const [activeCardTabId, setActiveCardTabId] = useState<string | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (orderedFilteredSubTabVisibleTabs.length > 0) {
      const exists = orderedFilteredSubTabVisibleTabs.some(t => t.id === activeCardTabId);
      if (!exists) {
        setActiveCardTabId(orderedFilteredSubTabVisibleTabs[0].id);
      }
    } else {
      setActiveCardTabId(null);
    }
  }, [orderedFilteredSubTabVisibleTabs, activeCardTabId]);

  const lastActiveCardTabId = useRef<string | null>(null);
  useEffect(() => {
    if (activeCardTabId && lastActiveCardTabId.current && activeCardTabId !== lastActiveCardTabId.current) {
      playSwipeSound();
    }
    lastActiveCardTabId.current = activeCardTabId;
  }, [activeCardTabId]);

  const handleTabIndicatorClick = useCallback((tabId: string) => {
    setActiveCardTabId(tabId);
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
    }
    programmaticScrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 800);

    const cardElement = document.getElementById(`stock-card-${tabId}`);
    if (cardElement && carouselRef.current) {
      cardElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, []);

  const lastHKeyPressTimeRef = useRef<number>(0);

  // Keyboard shortcuts handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA" || activeEl?.getAttribute("contenteditable") === "true";
        
      if (isInput) return;

      // 0. Double-tap 'h' / 'H' (or Shift + H) -> 進入/切換預覽模式 / 全螢幕模式
      const isPureH = (e.key === "h" || e.key === "H") && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      if (isPureH) {
        const now = Date.now();
        if (now - lastHKeyPressTimeRef.current <= 500) {
          e.preventDefault();
          lastHKeyPressTimeRef.current = 0;
          if (!document.fullscreenElement) {
            if (document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().then(() => {
                toast.success("已進入全螢幕 / 預覽模式", { id: "fullscreen-mode", duration: 1500 });
              }).catch((err) => {
                console.error(
                  `Error attempting to enable full-screen mode: ${err.message}`,
                );
                toast.success("已切換預覽模式", { id: "fullscreen-mode", duration: 1500 });
              });
            } else {
              toast.success("已切換預覽模式", { id: "fullscreen-mode", duration: 1500 });
            }
          } else {
            if (document.exitFullscreen) {
              document.exitFullscreen().then(() => {
                toast.info("已退出全螢幕 / 預覽模式", { id: "fullscreen-mode", duration: 1500 });
              }).catch(() => {});
            }
          }
          return;
        } else {
          lastHKeyPressTimeRef.current = now;
        }
      }

      // 1. Shift + B -> 回到交易總覽頁面
      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "B" || e.key === "b")
      ) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (isAiAnalysisOpen) setIsAiAnalysisOpen(false);
        if (isVisualLinesBoardOpen) setIsVisualLinesBoardOpen(false);
        if (isCinemaModeActive) {
          setIsCinemaModeActive(false);
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
        }
        playClickSound();
        return;
      }

      // 2. Shift + I -> 匯入最新價格
      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "I" || e.key === "i")
      ) {
        e.preventDefault();
        handleImportLatestPrices();
        return;
      }

      // 3. Shift + H -> 全螢幕
      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "H" || e.key === "h")
      ) {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.error(
              `Error attempting to enable full-screen mode: ${err.message}`,
            );
          });
        } else {
          document.exitFullscreen();
        }
        return;
      }

      // 4. Shift + F -> 搜尋股票
      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "F" || e.key === "f")
      ) {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // 5. Shift + M -> 電影觀賞模式
      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "M" || e.key === "m")
      ) {
        e.preventDefault();
        if (isCinemaModeActive) {
          setIsCinemaModeActive(false);
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
        } else {
          if (orderedFilteredSubTabVisibleTabs.length > 0) {
            const isCurrentActiveVisible = orderedFilteredSubTabVisibleTabs.some(t => t.id === activeCardTabId);
            const targetId = isCurrentActiveVisible ? (activeCardTabId || orderedFilteredSubTabVisibleTabs[0].id) : orderedFilteredSubTabVisibleTabs[0].id;
            setActiveCinemaCardId(targetId);
            setIsCinemaModeActive(true);
            
            if (document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().catch((err) => {
                console.warn("Fullscreen request rejected:", err);
              });
            }
            playClickSound();
          } else {
            toast.error("目前無可見的股票卡片可供放大");
          }
        }
        return;
      }

      // 6. Shift + D -> AI分析回傳
      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "D" || e.key === "d")
      ) {
        e.preventDefault();
        setIsAiAnalysisOpen((prev) => !prev);
        playClickSound();
        return;
      }

      // 7. Shift + A -> 新增股票
      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "A" || e.key === "a")
      ) {
        e.preventDefault();
        setIsAddOpen(true);
        return;
      }

      // 8. Alt + Z -> 全部翻頁
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "Z" || e.key === "z")
      ) {
        e.preventDefault();
        handleFlipAllCards();
        return;
      }

      // 9. Alt + Q -> 顯示數據統計
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "Q" || e.key === "q" || e.code === "KeyQ")
      ) {
        e.preventDefault();
        setIsDesktopMetricsOpen((prev) => !prev);
        playClickSound();
        return;
      }

      // 10. Alt + W -> 進入動態視覺圖示標籤頁面
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "W" || e.key === "w" || e.code === "KeyW")
      ) {
        e.preventDefault();
        setIsVisualLinesBoardOpen((prev) => !prev);
        playClickSound();
        return;
      }

      // 10. Ctrl + Shift + 1/2/3/4 -> 真實交易 Sub Tabs (觀察中 / 候選名單 / 買進操作 / 賣出操作)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey) {
        let selectedRealTab: "觀察中" | "候選名單" | "買進操作" | "賣出操作" | null = null;
        if (e.code === "Digit1" || e.key === "!" || e.key === "1") selectedRealTab = "觀察中";
        else if (e.code === "Digit2" || e.key === "@" || e.key === "2") selectedRealTab = "候選名單";
        else if (e.code === "Digit3" || e.key === "#" || e.key === "3") selectedRealTab = "買進操作";
        else if (e.code === "Digit4" || e.key === "$" || e.key === "4") selectedRealTab = "賣出操作";

        if (selectedRealTab) {
          e.preventDefault();
          setActiveViewTab("real");
          setActiveHoldingSubTab(selectedRealTab);
          playClickSound();
          setTimeout(() => {
            scrollToElement("#active-cards-section", -20);
          }, 50);
          return;
        }
      }

      // 11. Alt + 1/2/3/4/5 -> 虛擬交易 (持有中) Sub Tabs
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        let selectedTab:
          | "觀察中"
          | "候選名單"
          | "買進操作"
          | "賣出操作"
          | "平倉操作"
          | "乖離名單"
          | null = null;
        if (e.code === "Digit1" || e.key === "1") selectedTab = "觀察中"; // 虛擬交易
        else if (e.code === "Digit2" || e.key === "2") selectedTab = "候選名單";
        else if (e.code === "Digit3" || e.key === "3") selectedTab = "買進操作";
        else if (e.code === "Digit4" || e.key === "4") selectedTab = "賣出操作";
        else if (e.code === "Digit5" || e.key === "5") selectedTab = "乖離名單";

        if (selectedTab) {
          e.preventDefault();
          setActiveViewTab("active");
          setActiveHoldingSubTab(selectedTab);
          playClickSound();
          setTimeout(() => {
            scrollToElement("#active-cards-section", -20);
          }, 50);
          return;
        }
      }

      // 12. Shift + 1/2/3/4 -> Main Navigation Tabs
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.code === "Digit1" || e.key === "!" || e.key === "1") {
          e.preventDefault();
          handleViewTabChange("active"); // 持有中tab
        } else if (e.code === "Digit2" || e.key === "@" || e.key === "2") {
          e.preventDefault();
          handleViewTabChange("real"); // 真實交易 tab
        } else if (e.code === "Digit3" || e.key === "#" || e.key === "3") {
          e.preventDefault();
          handleViewTabChange("completed");
        } else if (e.code === "Digit4" || e.key === "$" || e.key === "4") {
          e.preventDefault();
          handleViewTabChange("notes");
        }
      }

      // 13. Alt + 左右方向鍵 -> 橫向滾動卡片
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        if (isCinemaModeActive) {
          const currentIndex = orderedFilteredSubTabVisibleTabs.findIndex(t => t.id === activeCinemaCardId);
          if (currentIndex !== -1 && orderedFilteredSubTabVisibleTabs.length > 1) {
            const newIndex = e.key === "ArrowRight"
              ? (currentIndex + 1) % orderedFilteredSubTabVisibleTabs.length
              : (currentIndex - 1 + orderedFilteredSubTabVisibleTabs.length) % orderedFilteredSubTabVisibleTabs.length;
            setActiveCinemaCardId(orderedFilteredSubTabVisibleTabs[newIndex].id);
            playSwipeSound();
          }
        } else {
          if (orderedFilteredSubTabVisibleTabs.length > 0) {
            const currentIndex = orderedFilteredSubTabVisibleTabs.findIndex(t => t.id === activeCardTabId);
            if (currentIndex !== -1) {
              const targetIdx = e.key === "ArrowRight"
                ? Math.min(currentIndex + 1, orderedFilteredSubTabVisibleTabs.length - 1)
                : Math.max(currentIndex - 1, 0);
              const targetTab = orderedFilteredSubTabVisibleTabs[targetIdx];
              if (targetTab) {
                handleTabIndicatorClick(targetTab.id);
                playSwipeSound();
              }
            } else if (carouselRef.current) {
              carouselRef.current.scrollBy({
                left: e.key === "ArrowLeft" ? -380 : 380,
                behavior: "smooth",
              });
              playSwipeSound();
            }
          } else if (carouselRef.current) {
            carouselRef.current.scrollBy({
              left: e.key === "ArrowLeft" ? -380 : 380,
              behavior: "smooth",
            });
            playSwipeSound();
          }
        }
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleImportLatestPrices,
    handleFlipAllCards,
    orderedFilteredSubTabVisibleTabs,
    activeCardTabId,
    activeCinemaCardId,
    setActiveCinemaCardId,
    setIsCinemaModeActive,
    isCinemaModeActive,
    handleViewTabChange,
    scrollToElement,
    isAiAnalysisOpen,
    handleTabIndicatorClick
  ]);

  useEffect(() => {
    const updateIndicator = () => {
      const activeId = activeCardTabId || (orderedFilteredSubTabVisibleTabs.length > 0 ? orderedFilteredSubTabVisibleTabs[0].id : null);
      if (activeId) {
        const el = tabRefs.current[activeId];
        if (el) {
          setIndicatorStyle({
            left: el.offsetLeft,
            width: el.offsetWidth,
          });

          // Smoothly scroll the tabs bar container to keep the active tab visible
          const container = el.parentElement;
          if (container) {
            const containerScrollLeft = container.scrollLeft;
            const containerWidth = container.clientWidth;
            const elLeft = el.offsetLeft;
            const elWidth = el.offsetWidth;
            
            if (elLeft < containerScrollLeft) {
              container.scrollTo({ left: elLeft - 24, behavior: "smooth" });
            } else if (elLeft + elWidth > containerScrollLeft + containerWidth) {
              container.scrollTo({ left: elLeft + elWidth - containerWidth + 24, behavior: "smooth" });
            }
          }
        }
      }
    };

    const animId = requestAnimationFrame(updateIndicator);
    window.addEventListener("resize", updateIndicator);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeCardTabId, orderedFilteredSubTabVisibleTabs]);

  const handleCarouselScroll = () => {
    if (isProgrammaticScrollRef.current) return;
    const carousel = carouselRef.current;
    if (!carousel || orderedFilteredSubTabVisibleTabs.length === 0) return;
    
    const containerRect = carousel.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    
    let closestTabId = null;
    let minDistance = Infinity;
    
    orderedFilteredSubTabVisibleTabs.forEach((tab) => {
      const el = document.getElementById(`stock-card-${tab.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const distance = Math.abs(cardCenter - containerCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestTabId = tab.id;
        }
      }
    });
    
    if (closestTabId && closestTabId !== activeCardTabId) {
      setActiveCardTabId(closestTabId);
    }
  };

  const completedTabs = useMemo(() => tabs.filter((t) => t.status === "COMPLETED"), [tabs]);

  const handleSmartSuggestion = async (tab: any) => {
    if (!tab) return;

    setIsGeneratingSuggestion(true);
    toast.loading("AI 正在動態分析並更新策略...", {
      id: "ai-smart-suggestion",
    });

    try {
      // Fetch the strategy
      const strategyDocRef = doc(db, `stockTabs/${tab.id}/strategy`, 'main');
      const strategySnap = await getDoc(strategyDocRef);
      const strategyData = strategySnap.exists() ? strategySnap.data() : { entries: [], tpTargets: [], slTargets: [], slConditions: "", resistanceZones: [], supportZones: [] };

      const response = await fetch("/api/generate-operation-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: tab.symbol,
          currentPrice: tab.currentPrice,
          rating: tab.rating,
          qualityScore: tab.qualityScore,
          valueScore: tab.valueScore,
          crashSimilarity: tab.crashSimilarity,
          buyRate: tab.buyRate,
          sellRate: tab.sellRate,
          volatility: tab.volatility,
          strategyData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "伺服器請求失敗");
      }

      const result = await response.json();
      const resultText = result.text;

      // Update the strategy with the new operationNote
      function stripUndefined(obj: any): any {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) {
          return obj.map(stripUndefined);
        }
        if (typeof obj === 'object') {
          if (obj.constructor && obj.constructor.name !== 'Object') return obj;
          const newObj: any = {};
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
              newObj[key] = stripUndefined(obj[key]);
            }
          }
          return newObj;
        }
        return obj;
      }

      const updatedStrategy = { ...strategyData, operationNote: resultText, updatedAt: serverTimestamp() };
      const sanitizedData = stripUndefined(updatedStrategy);

      await setDoc(doc(db, `stockTabs/${tab.id}/strategy`, 'main'), sanitizedData, { merge: true });

      toast.success("AI 已產生並更新策略建議", { id: "ai-smart-suggestion" });
      setIsActionDialogOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "AI 產生失敗，請稍後再試", { id: "ai-smart-suggestion" });
    } finally {
      setIsGeneratingSuggestion(false);
    }
  };

  const toggleTabGroup = async (tab: any) => {
    if (tab.groupId) {
      try {
        await updateTab(tab.id, { groupId: "" });
        toast.success("已解除區塊連動");
      } catch (e) {
        toast.error("解除連動失敗");
      }
    } else {
      setGroupingTabId(tab.id);
    }
  };

  const handleGroupWith = async (sourceTabId: string, targetTab: any) => {
    const sourceTab = tabs.find(t => t.id === sourceTabId);
    if (!sourceTab) return;
    
    const existingGroup = targetTab.groupId;
    const newGroupId = existingGroup || sourceTab.symbol + '-' + Date.now();
    
    try {
      if (!existingGroup) {
         await updateTab(targetTab.id, { groupId: newGroupId });
      }
      await updateTab(sourceTabId, { groupId: newGroupId });
      toast.success("已成功連動區塊");
      setGroupingTabId(null);
    } catch (e) {
      toast.error("連動失敗");
    }
  };

  const realCompletedTabs = useMemo(() => completedTabs.filter((t) => t.tradeType === "real"), [completedTabs]);
  const simulatedCompletedTabs = useMemo(() => completedTabs.filter((t) => t.tradeType === "simulated"), [completedTabs]);

  const totalCompletedPnL = realCompletedTabs.reduce(
    (acc, tab) => acc + (tab.finalPnL || 0),
    0,
  );
  const simulatedCompletedPnL = simulatedCompletedTabs.reduce(
    (acc, tab) => acc + (tab.finalPnL || 0),
    0,
  );

  const realWinningTrades = realCompletedTabs.filter(
    (t) => (t.finalPnL || 0) >= 0,
  );
  const realLosingTrades = realCompletedTabs.filter(
    (t) => (t.finalPnL || 0) < 0,
  );
  const realWinRate =
    realCompletedTabs.length > 0
      ? ((realWinningTrades.length / realCompletedTabs.length) * 100).toFixed(1)
      : 0;

  const simulatedWinningTrades = simulatedCompletedTabs.filter(
    (t) => (t.finalPnL || 0) >= 0,
  );
  const simulatedLosingTrades = simulatedCompletedTabs.filter(
    (t) => (t.finalPnL || 0) < 0,
  );
  const simulatedWinRate =
    simulatedCompletedTabs.length > 0
      ? (
          (simulatedWinningTrades.length / simulatedCompletedTabs.length) *
          100
        ).toFixed(1)
      : 0;

  // Filtered Completed Tabs calculation based on completedMainTab, completedResultFilter & completedSearchQuery
  const baseCompletedTabs = useMemo(() => {
    if (completedMainTab === "real") return realCompletedTabs;
    if (completedMainTab === "simulated") return simulatedCompletedTabs;
    return completedTabs;
  }, [completedMainTab, completedTabs, realCompletedTabs, simulatedCompletedTabs]);

  const displayCompletedTabs = useMemo(() => {
    return baseCompletedTabs.filter((tab) => {
      const pnl = tab.finalPnL || 0;
      if (completedResultFilter === "win" && pnl < 0) return false;
      if (completedResultFilter === "lose" && pnl >= 0) return false;

      if (completedSearchQuery.trim()) {
        const q = completedSearchQuery.trim().toLowerCase();
        const symbolMatch = (tab.symbol || "").toLowerCase().includes(q);
        const companyMatch = (tab.companyName || "").toLowerCase().includes(q);
        if (!symbolMatch && !companyMatch) return false;
      }

      return true;
    });
  }, [baseCompletedTabs, completedResultFilter, completedSearchQuery]);

  if (loading) {
    return (
      <div className="w-full max-w-[1680px] mx-auto px-2 sm:px-4 py-3 sm:py-6 space-y-4 sm:space-y-6 select-none pointer-events-none">
        {/* Top Control Bar Skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3.5 sm:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 animate-pulse"></div>
            <div className="space-y-1.5">
              <div className="h-5 w-28 bg-zinc-800 rounded-md animate-pulse"></div>
              <div className="h-3.5 w-44 bg-zinc-800/60 rounded-md animate-pulse"></div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="h-9 w-24 bg-zinc-800/80 rounded-xl animate-pulse"></div>
            <div className="h-9 w-24 bg-zinc-800/80 rounded-xl animate-pulse"></div>
            <div className="h-9 w-28 bg-emerald-950/40 border border-emerald-800/30 rounded-xl animate-pulse"></div>
          </div>
        </div>

        {/* Subtabs Skeleton */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 no-scrollbar">
          {["觀察中", "候選名單", "買進操作", "賣出操作", "平倉操作", "乖離名單", "持股監控"].map((name, i) => (
            <div
              key={name}
              className={`h-8 px-4 rounded-xl shrink-0 flex items-center justify-center text-[11px] font-bold ${
                i === 0
                  ? "bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                  : "bg-zinc-900/40 text-zinc-600 border border-zinc-800/30"
              } animate-pulse`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Stock Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="h-[380px] sm:h-[440px] bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-4 animate-pulse shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="h-5 w-20 bg-zinc-800 rounded-md"></div>
                  <div className="h-3.5 w-32 bg-zinc-800/50 rounded-md"></div>
                </div>
                <div className="h-6 w-16 bg-emerald-900/30 border border-emerald-700/30 rounded-full"></div>
              </div>
              <div className="flex-1 bg-zinc-950/60 rounded-xl border border-zinc-800/40 flex items-center justify-center p-4">
                <div className="w-full h-full flex items-end justify-between gap-1.5 px-2 opacity-30">
                  <div className="w-1/6 bg-emerald-500/40 rounded-t h-[40%]"></div>
                  <div className="w-1/6 bg-emerald-500/40 rounded-t h-[65%]"></div>
                  <div className="w-1/6 bg-emerald-500/40 rounded-t h-[50%]"></div>
                  <div className="w-1/6 bg-emerald-500/40 rounded-t h-[80%]"></div>
                  <div className="w-1/6 bg-emerald-500/40 rounded-t h-[95%]"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-zinc-800/60 rounded-md"></div>
                <div className="h-3.5 w-2/3 bg-zinc-800/40 rounded-md"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const moveTabUp = async (index: number, list: any[] = effectiveActiveTabs) => {
    if (index <= 0) return;
    const currentTab = list[index];
    const prevTab = list[index - 1];
    const newTabs = [...activeTabs];
    const globalIdxCurrent = newTabs.findIndex(t => t.id === currentTab.id);
    const globalIdxPrev = newTabs.findIndex(t => t.id === prevTab.id);
    if (globalIdxCurrent !== -1 && globalIdxPrev !== -1) {
      const temp = newTabs[globalIdxCurrent];
      newTabs[globalIdxCurrent] = newTabs[globalIdxPrev];
      newTabs[globalIdxPrev] = temp;
      const updates = newTabs.map((tab, idx) => ({ id: tab.id, sortOrder: idx }));
      await updateTabOrder(updates);
    }
  };

  const moveTabDown = async (index: number, list: any[] = effectiveActiveTabs) => {
    if (index >= list.length - 1) return;
    const currentTab = list[index];
    const nextTab = list[index + 1];
    const newTabs = [...activeTabs];
    const globalIdxCurrent = newTabs.findIndex(t => t.id === currentTab.id);
    const globalIdxNext = newTabs.findIndex(t => t.id === nextTab.id);
    if (globalIdxCurrent !== -1 && globalIdxNext !== -1) {
      const temp = newTabs[globalIdxCurrent];
      newTabs[globalIdxCurrent] = newTabs[globalIdxNext];
      newTabs[globalIdxNext] = temp;
      const updates = newTabs.map((tab, idx) => ({ id: tab.id, sortOrder: idx }));
      await updateTabOrder(updates);
    }
  };

  const displayCompletedPnL = displayCompletedTabs.reduce(
    (acc, tab) => acc + (tab.finalPnL || 0),
    0,
  );
  const displayWinCount = displayCompletedTabs.filter((t) => (t.finalPnL || 0) >= 0).length;
  const displayLoseCount = displayCompletedTabs.filter((t) => (t.finalPnL || 0) < 0).length;
  const displayWinRate = displayCompletedTabs.length > 0
    ? ((displayWinCount / displayCompletedTabs.length) * 100).toFixed(1)
    : "0.0";

  // Neo-brutalist card variants
  const cardVariants = {
    rest: {
      scale: 1,
      y: 0,
      opacity: 0.9,
      filter: "brightness(1) drop-shadow(0 4px 6px rgba(0,0,0,0.1))",
    },
    hover: {
      scale: 1.02,
      y: -4,
      opacity: 1,
      filter: "brightness(1.1) drop-shadow(0 20px 25px rgba(0,0,0,0.3))",
      transition: { type: "spring", stiffness: 400, damping: 25 },
    },
  };

  return (
    <div className="w-full pb-12 mt-0 transition-all duration-300">
      {/* 1. Full-width Green Ribbon Header (Desktop: sm and above) */}
      <ScrollIn className="hidden sm:block">
        <div className="-mx-2 sm:-mx-4 md:-mx-6 bg-[#085041] text-white pt-[16px] pb-[18px] px-4 sm:px-6 md:px-8 flex flex-col gap-4 text-left border-none rounded-none shadow-none relative z-10 select-none">
          <div className="w-full max-w-[1600px] mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 xl:gap-6">
            {/* Left section: Portfolio Overview badge & Title */}
            <div className="flex flex-col text-left shrink-0">
              <div className="flex justify-between items-center w-full lg:w-auto gap-3">
                <span className="px-2.5 py-1 text-[10px] tracking-[0.07em] font-bold text-[#9FE1CB] bg-white/10 rounded-full uppercase whitespace-nowrap">
                  PORTFOLIO OVERVIEW
                </span>
                <button
                  onClick={logout}
                  className="block lg:hidden text-white/60 hover:text-white transition-colors p-1"
                  title="登出"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center gap-1.5 mt-1.5">
                <h1 className="text-[20px] sm:text-[22px] md:text-[24px] font-bold text-white leading-none whitespace-nowrap">
                  交易總覽
                </h1>
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className="text-white/40 hover:text-white/70 transition-colors p-1"
                  title="快捷鍵一覽"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Middle section: Indicators */}
            <div className="flex-1 bg-black/15 backdrop-blur-md px-4 sm:px-5 py-2.5 rounded-2xl w-full">
              <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-x-4 gap-y-3">
                {/* Metric 0: Bank Account Water Level */}
                <div className="flex flex-col text-left shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-[#9FE1CB] font-medium opacity-90 whitespace-nowrap">銀行帳戶水位</span>
                    <button
                      onClick={() => setIsBankBalanceRevealed((prev) => !prev)}
                      className="text-white/40 hover:text-white/80 transition-colors p-0.5"
                      title={isBankBalanceRevealed ? "隱藏水位" : "雙擊或點擊顯示水位"}
                    >
                      {isBankBalanceRevealed ? (
                        <Eye className="w-3 h-3 text-[#9FE1CB]" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-white/50" />
                      )}
                    </button>
                  </div>
                  {isEditingBankBalance ? (
                    <div className="flex items-center gap-0.5 mt-1">
                      <span className="text-[14px] sm:text-[15px] font-semibold text-white">$</span>
                      <input
                        type="number"
                        autoFocus
                        value={editBankBalanceVal}
                        onBlur={() => {
                          const val = editBankBalanceVal === "" ? 0 : parseFloat(editBankBalanceVal);
                          handleUpdateBankBalance(val);
                          setIsEditingBankBalance(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = editBankBalanceVal === "" ? 0 : parseFloat(editBankBalanceVal);
                            handleUpdateBankBalance(val);
                            setIsEditingBankBalance(false);
                          } else if (e.key === "Escape") {
                            setIsEditingBankBalance(false);
                          }
                        }}
                        onChange={(e) => setEditBankBalanceVal(e.target.value)}
                        className="bg-transparent text-white font-semibold text-[14px] sm:text-[15px] focus:outline-none w-24 border-none p-0 focus:ring-0 leading-none h-5"
                        style={{ caretColor: 'white' }}
                      />
                    </div>
                  ) : isBankBalanceRevealed ? (
                    <div 
                      onDoubleClick={() => setIsBankBalanceRevealed(false)}
                      onClick={() => {
                        setEditBankBalanceVal(bankAccountBalance.toString());
                        setIsEditingBankBalance(true);
                      }}
                      className="text-[14px] sm:text-[15px] font-semibold text-white cursor-pointer select-none leading-none mt-1 flex items-baseline gap-1 group/bank whitespace-nowrap"
                      title="點擊修改水位，雙擊馬賽克遮罩"
                    >
                      <span>${bankAccountBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-white/40 group-hover/bank:text-white/70 transition-colors font-normal whitespace-nowrap">(修改)</span>
                    </div>
                  ) : (
                    <div
                      onDoubleClick={() => setIsBankBalanceRevealed(true)}
                      className="text-[14px] sm:text-[15px] font-semibold text-white cursor-pointer select-none leading-none mt-1 flex items-center gap-1 group/bank-mosaic whitespace-nowrap"
                      title="雙擊解鎖顯示水位"
                    >
                      <span className="tracking-widest font-mono filter blur-[3.5px] select-none text-emerald-100 bg-white/10 px-1.5 py-0.5 rounded transition-all group-hover/bank-mosaic:blur-[2px] whitespace-nowrap">
                        $8,888,888.88
                      </span>
                      <span className="text-[10px] text-white/40 group-hover/bank-mosaic:text-white/70 transition-colors font-normal whitespace-nowrap">(雙擊)</span>
                    </div>
                  )}
                </div>

                {/* Vertical divider */}
                <div className="hidden lg:block h-6 w-[1px] bg-white/15 shrink-0" />

                {/* Metric 1: Total Capital */}
                <div className="flex flex-col text-left shrink-0">
                  <span className="text-[11px] text-[#9FE1CB] font-medium opacity-90 whitespace-nowrap">目前的總資金</span>
                  {isEditingCapital ? (
                    <div className="flex items-center gap-0.5 mt-1">
                      <span className="text-[14px] sm:text-[15px] font-semibold text-white">$</span>
                      <input
                        type="number"
                        autoFocus
                        value={editCapitalVal}
                        onBlur={() => {
                          const val = editCapitalVal === "" ? 0 : parseFloat(editCapitalVal);
                          handleUpdateTotalCapital(val);
                          setIsEditingCapital(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = editCapitalVal === "" ? 0 : parseFloat(editCapitalVal);
                            handleUpdateTotalCapital(val);
                            setIsEditingCapital(false);
                          }
                        }}
                        onChange={(e) => setEditCapitalVal(e.target.value)}
                        className="bg-transparent text-white font-semibold text-[14px] sm:text-[15px] focus:outline-none w-20 border-none p-0 focus:ring-0 leading-none h-5"
                        style={{ caretColor: 'white' }}
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => {
                        setEditCapitalVal(totalCapital.toString());
                        setIsEditingCapital(true);
                      }}
                      className="text-[14px] sm:text-[15px] font-semibold text-white cursor-pointer select-none leading-none mt-1 flex items-baseline gap-1 group/cap whitespace-nowrap"
                      title="點擊修改總資金"
                    >
                      <span>${totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-white/40 group-hover/cap:text-white/70 transition-colors font-normal whitespace-nowrap">(修改)</span>
                    </div>
                  )}
                </div>

                {/* Vertical divider */}
                <div className="hidden lg:block h-6 w-[1px] bg-white/15 shrink-0" />

                {/* Metric 1.5: Virtual Total Capital */}
                <div className="flex flex-col text-left shrink-0">
                  <span className="text-[11px] text-[#9FE1CB] font-medium opacity-90 whitespace-nowrap">模擬交易總資金</span>
                  {isEditingVirtualCapital ? (
                    <div className="flex items-center gap-0.5 mt-1">
                      <span className="text-[14px] sm:text-[15px] font-semibold text-white">$</span>
                      <input
                        type="number"
                        autoFocus
                        value={editVirtualCapitalVal}
                        onBlur={() => {
                          const val = editVirtualCapitalVal === "" ? 0 : parseFloat(editVirtualCapitalVal);
                          handleUpdateVirtualCapital(val);
                          setIsEditingVirtualCapital(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = editVirtualCapitalVal === "" ? 0 : parseFloat(editVirtualCapitalVal);
                            handleUpdateVirtualCapital(val);
                            setIsEditingVirtualCapital(false);
                          }
                        }}
                        onChange={(e) => setEditVirtualCapitalVal(e.target.value)}
                        className="bg-transparent text-white font-semibold text-[14px] sm:text-[15px] focus:outline-none w-20 border-none p-0 focus:ring-0 leading-none h-5"
                        style={{ caretColor: 'white' }}
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => {
                        setEditVirtualCapitalVal(virtualCapital.toString());
                        setIsEditingVirtualCapital(true);
                      }}
                      className="text-[14px] sm:text-[15px] font-semibold text-white cursor-pointer select-none leading-none mt-1 flex items-baseline gap-1 group/vcap whitespace-nowrap"
                      title="點擊修改模擬總資金"
                    >
                      <span>${virtualCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-white/40 group-hover/vcap:text-white/70 transition-colors font-normal whitespace-nowrap">(修改)</span>
                    </div>
                  )}
                </div>

                {/* Vertical divider */}
                <div className="hidden lg:block h-6 w-[1px] bg-white/15 shrink-0" />

                {/* Metric 2: Remaining Balance */}
                <div className="flex flex-col text-left shrink-0">
                  <span className="text-[11px] text-[#9FE1CB] font-medium opacity-90 whitespace-nowrap">剩餘額度</span>
                  <span className="text-[14px] sm:text-[15px] font-semibold font-mono text-white mt-1 leading-none whitespace-nowrap">
                    ${remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Vertical divider */}
                <div className="hidden lg:block h-6 w-[1px] bg-white/15 shrink-0" />

                {/* Metric 3: Real Cost */}
                <div className="flex flex-col text-left shrink-0">
                  <span className="text-[11px] text-[#9FE1CB] font-medium opacity-90 whitespace-nowrap">真實交易總持有成本</span>
                  <span className="text-[14px] sm:text-[15px] font-semibold font-mono text-white mt-1 leading-none whitespace-nowrap">
                    ${totalRealHoldingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Vertical divider */}
                <div className="hidden lg:block h-6 w-[1px] bg-white/15 shrink-0" />

                {/* Metric 3.5: Virtual Cost */}
                <div className="flex flex-col text-left shrink-0">
                  <span className="text-[11px] text-[#9FE1CB] font-medium opacity-90 whitespace-nowrap">模擬交易總持有成本</span>
                  <span className="text-[14px] sm:text-[15px] font-semibold font-mono text-white mt-1 leading-none whitespace-nowrap">
                    ${totalVirtualHoldingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Right section: Actions & Logout */}
            <div className="flex items-center gap-2.5 shrink-0 w-full lg:w-auto justify-end sm:justify-start">
              <button
                onClick={() => setIsAddOpen(true)}
                className="whitespace-nowrap px-3.5 py-2 bg-transparent hover:bg-white/10 text-white border border-white/20 rounded-xl text-[13px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <span>＋ 新增股票</span>
              </button>

              <button
                onClick={handleImportLatestPrices}
                disabled={isImportingPrices || !user}
                className="whitespace-nowrap px-3.5 py-2 bg-transparent hover:bg-white/10 text-white border border-white/20 rounded-xl text-[13px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <span>↻ 匯入最新現價</span>
              </button>

              <button
                onClick={logout}
                className="hidden lg:block text-white/60 hover:text-white transition-colors p-2 rounded-lg shrink-0"
                title="登出"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </ScrollIn>

      {/* 2. Mobile-only Compact Investment Portfolio Card Section */}
      <ScrollIn className="block sm:hidden my-4 px-3">
        <div className="w-full max-w-[380px] mx-auto bg-transparent rounded-[32px] select-none">
          {/* Header section (rich deep green background: bg-[#084D38]) */}
          <div className="bg-[#084D38] p-6 pb-6 text-left flex flex-col gap-3 relative rounded-t-[32px]">
            {/* Top row: small pill badge "PORTFOLIO OVERVIEW" | logout icon on the right */}
            <div className="flex items-center justify-between w-full">
              <span className="px-3 py-1.5 text-[10px] tracking-[0.06em] font-medium text-[#9FE1CB] bg-white/10 rounded-full uppercase leading-none">
                PORTFOLIO OVERVIEW
              </span>
              <button
                onClick={logout}
                className="text-white/80 hover:text-white transition-colors p-1"
                title="登出"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Below badge: title "交易總覽" */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[22px] font-bold text-white tracking-tight leading-none">
                交易總覽
              </span>
              <button
                onClick={() => setIsHelpOpen(true)}
                className="text-white/40 hover:text-white/70 transition-colors p-1"
                title="快捷鍵一覽"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Bank Account Water Level (Between 交易總覽 and 目前的總資金) */}
            <div className="flex flex-col gap-0.5 border-t border-white/15 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#9FE1CB] font-bold tracking-wider uppercase opacity-80 flex items-center gap-1.5">
                  銀行帳戶水位
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsBankBalanceRevealed((prev) => !prev);
                    }}
                    className="text-white/40 hover:text-white/80 transition-colors p-0.5"
                    title={isBankBalanceRevealed ? "隱藏水位" : "顯示水位"}
                  >
                    {isBankBalanceRevealed ? (
                      <Eye className="w-3 h-3 text-[#9FE1CB]" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-white/50" />
                    )}
                  </button>
                </span>
                <span className="text-[9px] text-white/40 font-normal">
                  {isBankBalanceRevealed ? "(雙擊隱藏)" : "(雙擊顯示)"}
                </span>
              </div>
              <div className="text-[22px] font-semibold text-white tracking-tight leading-none font-sans mt-0.5">
                {isEditingBankBalance ? (
                  <div className="flex items-center gap-0.5">
                    <span className="text-[18px] font-medium text-white">$</span>
                    <input
                      type="number"
                      autoFocus
                      value={editBankBalanceVal}
                      onBlur={() => {
                        const val = editBankBalanceVal === "" ? 0 : parseFloat(editBankBalanceVal);
                        handleUpdateBankBalance(val);
                        setIsEditingBankBalance(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = editBankBalanceVal === "" ? 0 : parseFloat(editBankBalanceVal);
                          handleUpdateBankBalance(val);
                          setIsEditingBankBalance(false);
                        } else if (e.key === "Escape") {
                          setIsEditingBankBalance(false);
                        }
                      }}
                      onChange={(e) => setEditBankBalanceVal(e.target.value)}
                      className="bg-transparent text-white font-semibold text-[22px] focus:outline-none w-full border-none p-0 focus:ring-0 leading-none h-7"
                      style={{ caretColor: 'white' }}
                    />
                  </div>
                ) : isBankBalanceRevealed ? (
                  <div 
                    onDoubleClick={() => setIsBankBalanceRevealed(false)}
                    onClick={() => {
                      setEditBankBalanceVal(bankAccountBalance.toString());
                      setIsEditingBankBalance(true);
                    }}
                    className="cursor-pointer flex items-baseline gap-1.5 group/bank"
                    title="點擊修改水位，雙擊馬賽克遮罩"
                  >
                    <span>${bankAccountBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[11px] text-white/50 group-hover/bank:text-white/80 transition-colors font-normal">(修改)</span>
                  </div>
                ) : (
                  <div
                    onDoubleClick={() => setIsBankBalanceRevealed(true)}
                    className="cursor-pointer flex items-center gap-1.5 group/bank-mosaic"
                    title="雙擊解鎖顯示水位"
                  >
                    <span className="tracking-widest font-mono filter blur-[3.5px] select-none text-emerald-100 bg-white/10 px-2 py-0.5 rounded transition-all group-hover/bank-mosaic:blur-[2px]">
                      $8,888,888.88
                    </span>
                    <span className="text-[10px] text-white/40 group-hover/bank-mosaic:text-white/80 transition-colors font-normal">(雙擊)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Below title: hero number (totalCapital) */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-[#9FE1CB] font-bold tracking-wider uppercase opacity-80">目前的總資金</span>
              <div className="text-[28px] font-semibold text-white tracking-tight leading-none font-sans">
                {isEditingCapital ? (
                  <div className="flex items-center gap-0.5">
                    <span className="text-[22px] font-medium text-white">$</span>
                    <input
                      type="number"
                      autoFocus
                      value={editCapitalVal}
                      onBlur={() => {
                        const val = editCapitalVal === "" ? 0 : parseFloat(editCapitalVal);
                        handleUpdateTotalCapital(val);
                        setIsEditingCapital(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = editCapitalVal === "" ? 0 : parseFloat(editCapitalVal);
                          handleUpdateTotalCapital(val);
                          setIsEditingCapital(false);
                        }
                      }}
                      onChange={(e) => setEditCapitalVal(e.target.value)}
                      className="bg-transparent text-white font-semibold text-[28px] focus:outline-none w-full border-none p-0 focus:ring-0 leading-none h-8"
                      style={{ caretColor: 'white' }}
                    />
                  </div>
                ) : (
                  <div 
                    onClick={() => {
                      setEditCapitalVal(totalCapital.toString());
                      setIsEditingCapital(true);
                    }}
                    className="cursor-pointer flex items-baseline gap-1.5 group/cap"
                    title="點擊修改總資金"
                  >
                    <span>${totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[11px] text-white/50 group-hover/cap:text-white/80 transition-colors font-normal">(修改)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Simulated Capital */}
            <div className="flex flex-col gap-0.5 border-t border-white/15 pt-2">
              <span className="text-[10px] text-[#9FE1CB] font-bold tracking-wider uppercase opacity-80">模擬交易總資金</span>
              <div className="text-[22px] font-semibold text-white tracking-tight leading-none font-sans">
                {isEditingVirtualCapital ? (
                  <div className="flex items-center gap-0.5">
                    <span className="text-[18px] font-medium text-white">$</span>
                    <input
                      type="number"
                      autoFocus
                      value={editVirtualCapitalVal}
                      onBlur={() => {
                        const val = editVirtualCapitalVal === "" ? 0 : parseFloat(editVirtualCapitalVal);
                        handleUpdateVirtualCapital(val);
                        setIsEditingVirtualCapital(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = editVirtualCapitalVal === "" ? 0 : parseFloat(editVirtualCapitalVal);
                          handleUpdateVirtualCapital(val);
                          setIsEditingVirtualCapital(false);
                        }
                      }}
                      onChange={(e) => setEditVirtualCapitalVal(e.target.value)}
                      className="bg-transparent text-white font-semibold text-[22px] focus:outline-none w-full border-none p-0 focus:ring-0 leading-none h-7"
                      style={{ caretColor: 'white' }}
                    />
                  </div>
                ) : (
                  <div 
                    onClick={() => {
                      setEditVirtualCapitalVal(virtualCapital.toString());
                      setIsEditingVirtualCapital(true);
                    }}
                    className="cursor-pointer flex items-baseline gap-1.5 group/vcap"
                    title="點擊修改模擬總資金"
                  >
                    <span>${virtualCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[10px] text-white/50 group-hover/vcap:text-white/80 transition-colors font-normal">(修改)</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Body section (white) */}
          <div className="p-6 pt-5 pb-6 flex flex-col gap-4 bg-white text-left rounded-b-[32px]">
            {/* Row 1: label "剩餘額度" + value */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500 font-normal">
                剩餘額度
              </span>
              <span className="text-[15px] font-bold text-[#084D38] font-sans">
                ${remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Thin divider line */}
            <div className="h-[0.5px] bg-zinc-100" />

            {/* Row 2: label "真實交易總持有成本" + value */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500 font-normal">
                真實交易總持有成本
              </span>
              <span className="text-[15px] font-bold text-[#084D38] font-sans">
                ${totalRealHoldingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Thin divider line */}
            <div className="h-[0.5px] bg-zinc-100" />

            {/* Row 2.5: label "模擬交易總持有成本" + value */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500 font-normal">
                模擬交易總持有成本
              </span>
              <span className="text-[15px] font-bold text-[#084D38] font-sans">
                ${totalVirtualHoldingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Thin divider line */}
            <div className="h-[0.5px] bg-zinc-100" />

            {/* Primary button: full-width, background bg-[#084D38], rounded-2xl, font-semibold */}
            <button
              onClick={() => setIsAddOpen(true)}
              className="w-full bg-[#084D38] hover:bg-[#063d2c] text-white rounded-2xl py-3.5 text-sm font-semibold border-none outline-none cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>+ 新增股票</span>
            </button>

            {/* Secondary button: full-width, white bg, border, rounded-2xl, text-zinc-800 */}
            <button
              onClick={handleImportLatestPrices}
              disabled={isImportingPrices || !user}
              className="w-full bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200/80 rounded-2xl py-3 text-sm font-medium outline-none cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span>↻ 匯入最新現價</span>
            </button>
          </div>
        </div>
      </ScrollIn>

      {/* Shared Add Stock Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="glass-panel border-zinc-200/80 shadow-2xl bg-white/95 backdrop-blur-3xl text-zinc-800 outline-none w-[95vw] max-w-[400px] h-auto max-h-[90vh] overflow-y-auto !rounded-3xl p-5 sm:p-6 p-safe">
          <DialogHeader>
            <DialogTitle className="font-bold text-2xl tracking-tight text-zinc-900 mb-2">
              新增股票分頁
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleAddSubmit}
            className="space-y-5 outline-none"
          >
            <div className="space-y-2">
              <Label
                htmlFor="symbol_dashboard"
                className="font-medium text-zinc-700 text-base sm:text-sm"
              >
                股票代號 (Ticker)
              </Label>
              <Input
                id="symbol_dashboard"
                value={newSymbol}
                onChange={(e) =>
                  setNewSymbol(e.target.value.toUpperCase())
                }
                placeholder="例如：AAPL"
                required
                className="bg-zinc-50 border-zinc-200 text-zinc-800 placeholder-zinc-400 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 h-[48px] text-base"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="company_dashboard"
                className="font-medium text-zinc-700 text-base sm:text-sm"
              >
                公司名稱 (選填)
              </Label>
              <Input
                id="company_dashboard"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="例如：Apple Inc."
                className="bg-zinc-50 border-zinc-200 text-zinc-800 placeholder-zinc-400 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 h-[48px] text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium text-zinc-700 text-base sm:text-sm">
                交易模式
              </Label>
              <Select
                value={newTradeType}
                onValueChange={(val: any) => setNewTradeType(val)}
              >
                <SelectTrigger className="w-full bg-zinc-50 border-zinc-200 text-zinc-800 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 h-[48px] text-base">
                  <SelectValue placeholder="選擇交易模式" />
                </SelectTrigger>
                <SelectContent className="bg-white border-zinc-200 text-zinc-800 outline-none rounded-xl shadow-lg">
                  <SelectItem
                    value="simulated"
                    className="font-medium focus:bg-zinc-100 focus:text-zinc-900 cursor-pointer text-zinc-700 px-4 text-base sm:text-sm py-3 sm:py-1"
                  >
                    <div className="flex items-center gap-3">
                      <Gamepad2 className="h-5 w-5 sm:h-4 sm:w-4 text-amber-600" />
                      模擬交易 (Simulated)
                    </div>
                  </SelectItem>
                  <SelectItem
                    value="real"
                    className="font-medium focus:bg-zinc-100 focus:text-zinc-900 cursor-pointer text-zinc-700 px-4 text-base sm:text-sm py-3 sm:py-1"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 sm:h-4 sm:w-4 text-emerald-600" />
                      真實交易 (Real)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4 pb-2">
              <button
                type="submit"
                className="glass-button w-full h-[52px] sm:h-auto justify-center bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 hover:bg-emerald-500/20 py-0 sm:py-6 text-[17px] font-bold transition-all rounded-xl"
              >
                建立交易日誌檔案
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Main content container, aligned nicely with responsive layout */}
      <div className={`space-y-4 sm:space-y-6 mx-auto mt-4 sm:mt-6 px-2 sm:px-4 ${activeViewTab === "notes" || activeViewTab === "completed" ? "w-full max-w-full lg:max-w-[98%] xl:max-w-[1920px]" : "max-w-[1600px]"}`}>

      {/* Desktop Metrics Collapsible Controller */}
      <div className="hidden sm:flex justify-end mt-2 mb-1">
        <button
          onClick={() => setIsDesktopMetricsOpen(!isDesktopMetricsOpen)}
          className="flex items-center gap-1.5 text-xs font-medium text-[#666661] hover:text-[#2C2C2A] transition-colors py-1.5 px-3 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] cursor-pointer"
        >
          <span>{isDesktopMetricsOpen ? "隱藏數據統計" : "顯示數據統計"}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isDesktopMetricsOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isDesktopMetricsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="hidden sm:block overflow-hidden"
          >
            <div className="bg-white/80 backdrop-blur-sm border border-black/5 shadow-xs rounded-2xl p-4 sm:p-5 select-none mb-3">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-y-4 gap-x-0 divide-x-0 lg:divide-x divide-black/[0.06]">
                {[
                  {
                    title: "總持股數",
                    rawValue: activeTabs.length,
                    prefix: "",
                    suffix: "",
                    decimals: 0,
                    pnl: undefined,
                    showPlus: false,
                  },
                  {
                    title: "總實現損益",
                    rawValue: totalCompletedPnL,
                    prefix: "$",
                    suffix: "",
                    decimals: 2,
                    pnl: totalCompletedPnL,
                    showPlus: true,
                  },
                  {
                    title: "模擬實現損益",
                    rawValue: simulatedCompletedPnL,
                    prefix: "$",
                    suffix: "",
                    decimals: 2,
                    pnl: simulatedCompletedPnL,
                    showPlus: true,
                  },
                  {
                    title: "模擬未實現總損益",
                    rawValue: simulatedUnrealizedPnL,
                    prefix: "$",
                    suffix: "",
                    decimals: 2,
                    pnl: simulatedUnrealizedPnL,
                    showPlus: true,
                  },
                  {
                    title: "真實交易勝率",
                    rawValue: realWinRate,
                    prefix: "",
                    suffix: "%",
                    decimals: 0,
                    pnl: undefined,
                    showPlus: false,
                  },
                  {
                    title: "模擬交易勝率",
                    rawValue: simulatedWinRate,
                    prefix: "",
                    suffix: "%",
                    decimals: 0,
                    pnl: undefined,
                    showPlus: false,
                  },
                ].map((metric: any, i) => {
                  const isPnl = metric.pnl !== undefined;
                  const isPositive = metric.rawValue >= 0;
                  const valueColor = isPnl 
                    ? (isPositive ? "text-[#085041]" : "text-rose-700") 
                    : "text-[#2C2C2A]";

                  return (
                    <div 
                      key={i} 
                      className="flex flex-col items-center justify-center text-center py-1.5 px-2 sm:px-3 lg:px-4"
                    >
                      <span className="text-[11px] sm:text-[12px] font-semibold text-[#666661] tracking-wide uppercase whitespace-nowrap">
                        {metric.title}
                      </span>
                      <div className={`text-[19px] sm:text-[21px] lg:text-[23px] font-bold tracking-tight mt-1 font-mono whitespace-nowrap ${valueColor}`}>
                        <AnimatedNumber
                          value={metric.rawValue}
                          prefix={metric.prefix}
                          suffix={metric.suffix}
                          decimals={metric.decimals}
                          showPlus={metric.showPlus}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Metrics Section - Mobile Only (Ultra-Compact & Designed for Mobile Reading proportions) */}
      <div className="block sm:hidden select-none px-4 py-4 mb-3 bg-transparent">
        <div className="grid grid-cols-2 gap-y-3.5 gap-x-0 text-center">
          {/* Row 1, Col 1: 總持股數 */}
          <div className="flex flex-col items-center justify-center border-r border-black/[0.06] py-1">
            <span className="text-[11px] text-[#888780] font-medium tracking-wide">
              總持股數
            </span>
            <div className="text-[19px] font-bold tracking-tight mt-0.5 text-[#2C2C2A] font-mono leading-none">
              <AnimatedNumber value={activeTabs.length} prefix="" suffix="" decimals={0} showPlus={false} />
            </div>
          </div>

          {/* Row 1, Col 2: 總實現損益 */}
          <div className="flex flex-col items-center justify-center py-1">
            <span className="text-[11px] text-[#888780] font-medium tracking-wide">
              總實現損益
            </span>
            <div className={`text-[19px] font-bold tracking-tight mt-0.5 font-mono leading-none ${totalCompletedPnL >= 0 ? "text-[#085041]" : "text-rose-700"}`}>
              <AnimatedNumber value={totalCompletedPnL} prefix="$" suffix="" decimals={2} showPlus={true} />
            </div>
          </div>

          {/* Divider 1 */}
          <div className="col-span-2 h-[0.5px] bg-black/[0.06] mx-2" />

          {/* Row 2, Col 1: 模擬實現損益 */}
          <div className="flex flex-col items-center justify-center border-r border-black/[0.06] py-1">
            <span className="text-[11px] text-[#888780] font-medium tracking-wide">
              模擬實現損益
            </span>
            <div className={`text-[19px] font-bold tracking-tight mt-0.5 font-mono leading-none ${simulatedCompletedPnL >= 0 ? "text-[#085041]" : "text-rose-700"}`}>
              <AnimatedNumber value={simulatedCompletedPnL} prefix="$" suffix="" decimals={2} showPlus={true} />
            </div>
          </div>

          {/* Row 2, Col 2: 模擬未實現總損益 */}
          <div className="flex flex-col items-center justify-center py-1">
            <span className="text-[11px] text-[#888780] font-medium tracking-wide">
              模擬未實現總損益
            </span>
            <div className={`text-[19px] font-bold tracking-tight mt-0.5 font-mono leading-none ${simulatedUnrealizedPnL >= 0 ? "text-[#085041]" : "text-rose-700"}`}>
              <AnimatedNumber value={simulatedUnrealizedPnL} prefix="$" suffix="" decimals={2} showPlus={true} />
            </div>
          </div>

          {/* Divider 2 */}
          <div className="col-span-2 h-[0.5px] bg-black/[0.06] mx-2" />

          {/* Row 3, Col 1: 真實交易勝率 */}
          <div className="flex flex-col items-center justify-center border-r border-black/[0.06] py-1">
            <span className="text-[11px] text-[#888780] font-medium tracking-wide">
              真實交易勝率
            </span>
            <div className="text-[19px] font-bold tracking-tight mt-0.5 text-[#2C2C2A] font-mono leading-none">
              <AnimatedNumber value={Number(realWinRate)} prefix="" suffix="%" decimals={0} showPlus={false} />
            </div>
          </div>

          {/* Row 3, Col 2: 模擬交易勝率 */}
          <div className="flex flex-col items-center justify-center py-1">
            <span className="text-[11px] text-[#888780] font-medium tracking-wide">
              模擬交易勝率
            </span>
            <div className="text-[19px] font-bold tracking-tight mt-0.5 text-[#2C2C2A] font-mono leading-none">
              <AnimatedNumber value={Number(simulatedWinRate)} prefix="" suffix="%" decimals={0} showPlus={false} />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Row (No bottom border, pill styling for selected tab with Lenis smooth scroll and motion layout transition) */}
      <div className="flex flex-row snap-x flex-nowrap w-full gap-2 sm:gap-3 mb-4 sm:mb-6 mt-4 sm:mt-5 overflow-x-auto pt-2 pb-px scrollbar-hide">
        {[
          { id: "active", label: "持有中", icon: Activity, count: visibleActiveTabs.filter((t) => t.tradeType === "simulated").length },
          { id: "real", label: "真實交易", icon: ShieldCheck, count: visibleActiveTabs.filter((t) => t.tradeType === "real").length },
          { id: "completed", label: "已完成", icon: TrendingUp, count: completedTabs.length },
          { id: "notes", label: "操作備註", icon: FileText, count: null },
        ].map((tabItem) => {
          const isActive = activeViewTab === tabItem.id;
          const Icon = tabItem.icon;

          return (
            <button
              key={tabItem.id}
              onClick={() => handleViewTabChange(tabItem.id as any)}
              className={`h-[38px] snap-start flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 font-bold text-sm tracking-wide rounded-full transition-colors duration-300 relative overflow-hidden cursor-pointer select-none border-none outline-none ${
                isActive
                  ? "text-[#085041]"
                  : "bg-transparent text-[#888780] hover:text-[#2C2C2A]"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="mainActiveViewTabBg"
                  className="absolute inset-0 bg-[#085041]/10 rounded-full z-0"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {tabItem.label} {tabItem.count !== null && `(${tabItem.count})`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {/* Search Dialog */}
        <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent className="border border-zinc-200/50 shadow-2xl bg-white/90 backdrop-blur-xl text-zinc-900 max-w-[400px] w-[92%] p-6 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-extrabold text-xl text-zinc-900 flex items-center gap-2">
                <Search className="h-5 w-5 text-emerald-600" />
                快速搜尋個股
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                autoFocus
                placeholder="輸入代號或名稱..."
                className="bg-zinc-50 border-zinc-200 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-zinc-400 font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const filtered = tabs.filter(
                      (t) =>
                        t.status === "ACTIVE" &&
                        (t.symbol
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                          t.companyName
                            ?.toLowerCase()
                            .includes(searchQuery.toLowerCase())),
                    );
                    if (filtered.length > 0) {
                      handleSearchSelect(filtered[0].id);
                    }
                  }
                }}
              />
              <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
                {tabs
                  .filter(
                     (t) =>
                       t.status === "ACTIVE" &&
                       (t.symbol
                         .toLowerCase()
                         .includes(searchQuery.toLowerCase()) ||
                         t.companyName
                           ?.toLowerCase()
                           .includes(searchQuery.toLowerCase())),
                  )
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSearchSelect(t.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-100 hover:border-zinc-200/80 transition-all text-left group active:scale-[0.98] cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center font-extrabold text-[10px] rounded bg-zinc-200/70 text-zinc-650 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                          {t.symbol.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-extrabold text-sm text-zinc-900 group-hover:text-emerald-600 transition-colors">
                            {t.symbol}
                          </p>
                          <p className="text-[10px] font-bold text-zinc-400 truncate max-w-[150px]">
                            {t.companyName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-zinc-750 group-hover:text-emerald-600 transition-colors">
                          ${t.currentPrice?.toLocaleString()}
                        </p>
                      </div>
                    </button>
                  ))}
                {tabs.filter((t) => t.status === "ACTIVE").length === 0 && (
                  <p className="text-center py-8 text-zinc-400 text-sm font-semibold italic">
                    尚無持有中的個股
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Card Action Choice Dialog */}
        <Dialog open={isActionDialogOpen} onOpenChange={(open) => {
          setIsActionDialogOpen(open);
          if (open) {
            setActionActiveTab("general");
          }
        }}>
          <DialogContent className="border border-zinc-200 shadow-2xl bg-white text-zinc-800 w-[92vw] max-w-[380px] p-5 sm:p-6 rounded-2xl">
            <DialogHeader className="mb-3">
              <DialogTitle className="font-black text-xl text-zinc-900 flex items-center justify-center gap-2">
                <span className="bg-zinc-105 text-zinc-800 px-2 py-0.5 rounded text-sm font-black border border-zinc-200">{selectedActionTab?.symbol}</span> 操作
              </DialogTitle>
            </DialogHeader>

            {/* Strategy Tickboxes Row: 選取 | 止盈 | 止損 | 加碼 | 平倉 | 觀察 */}
            {selectedActionTab && (
              <div className="flex items-center justify-between gap-1 bg-zinc-100/90 border border-zinc-200/90 p-1.5 sm:p-2 rounded-2xl mb-4 shadow-xs">
                {/* 選取 */}
                <label className="flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all cursor-pointer group hover:bg-white/80 select-none">
                  <input
                    type="checkbox"
                    checked={!!activeTabStrategies[selectedActionTab.id]?.notesHighlighted}
                    onChange={(e) => handleUpdateNotesHighlighted(selectedActionTab.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 rounded border border-zinc-300 bg-white checked:bg-amber-500 checked:border-amber-500 text-amber-600 focus:ring-0 cursor-pointer accent-amber-500 transition-all shrink-0 mb-1"
                  />
                  <span className={`text-[11px] font-bold select-none transition-colors ${activeTabStrategies[selectedActionTab.id]?.notesHighlighted ? "text-amber-600 font-black" : "text-zinc-500 group-hover:text-zinc-800"}`}>
                    選取
                  </span>
                </label>

                {/* 止盈 */}
                <label className="flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all cursor-pointer group hover:bg-white/80 select-none">
                  <input
                    type="checkbox"
                    checked={!!activeTabStrategies[selectedActionTab.id]?.tpChecked}
                    onChange={(e) => handleUpdateTPChecked(selectedActionTab.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 rounded border border-zinc-300 bg-white checked:bg-emerald-500 checked:border-emerald-500 text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-500 transition-all shrink-0 mb-1"
                  />
                  <span className={`text-[11px] font-bold select-none transition-colors ${activeTabStrategies[selectedActionTab.id]?.tpChecked ? "text-emerald-600 font-black" : "text-zinc-500 group-hover:text-zinc-800"}`}>
                    止盈
                  </span>
                </label>

                {/* 止損 */}
                <label className="flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all cursor-pointer group hover:bg-white/80 select-none">
                  <input
                    type="checkbox"
                    checked={!!activeTabStrategies[selectedActionTab.id]?.slChecked}
                    onChange={(e) => handleUpdateSLChecked(selectedActionTab.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 rounded border border-zinc-300 bg-white checked:bg-rose-500 checked:border-rose-500 text-rose-600 focus:ring-0 cursor-pointer accent-rose-500 transition-all shrink-0 mb-1"
                  />
                  <span className={`text-[11px] font-bold select-none transition-colors ${activeTabStrategies[selectedActionTab.id]?.slChecked ? "text-rose-600 font-black" : "text-zinc-500 group-hover:text-zinc-800"}`}>
                    止損
                  </span>
                </label>

                {/* 加碼 */}
                <label className="flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all cursor-pointer group hover:bg-white/80 select-none">
                  <input
                    type="checkbox"
                    checked={!!activeTabStrategies[selectedActionTab.id]?.addChecked}
                    onChange={(e) => handleUpdateAddChecked(selectedActionTab.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 rounded border border-zinc-300 bg-white checked:bg-sky-500 checked:border-sky-500 text-sky-600 focus:ring-0 cursor-pointer accent-sky-500 transition-all shrink-0 mb-1"
                  />
                  <span className={`text-[11px] font-bold select-none transition-colors ${activeTabStrategies[selectedActionTab.id]?.addChecked ? "text-sky-600 font-black" : "text-zinc-500 group-hover:text-zinc-800"}`}>
                    加碼
                  </span>
                </label>

                {/* 平倉 */}
                <label className="flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all cursor-pointer group hover:bg-white/80 select-none">
                  <input
                    type="checkbox"
                    checked={!!activeTabStrategies[selectedActionTab.id]?.closeChecked}
                    onChange={(e) => handleUpdateCloseChecked(selectedActionTab.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 rounded border border-zinc-300 bg-white checked:bg-violet-500 checked:border-violet-500 text-violet-600 focus:ring-0 cursor-pointer accent-violet-500 transition-all shrink-0 mb-1"
                  />
                  <span className={`text-[11px] font-bold select-none transition-colors ${activeTabStrategies[selectedActionTab.id]?.closeChecked ? "text-violet-600 font-black" : "text-zinc-500 group-hover:text-zinc-800"}`}>
                    平倉
                  </span>
                </label>

                {/* 觀察 */}
                <label className="flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all cursor-pointer group hover:bg-white/80 select-none">
                  <input
                    type="checkbox"
                    checked={!!activeTabStrategies[selectedActionTab.id]?.observeChecked}
                    onChange={(e) => handleUpdateObserveChecked(selectedActionTab.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 rounded border border-zinc-300 bg-white checked:bg-[#929292] checked:border-[#929292] text-[#929292] focus:ring-0 cursor-pointer accent-[#929292] transition-all shrink-0 mb-1"
                  />
                  <span className={`text-[11px] font-bold select-none transition-colors ${activeTabStrategies[selectedActionTab.id]?.observeChecked ? "text-zinc-700 font-black" : "text-zinc-500 group-hover:text-zinc-800"}`}>
                    觀察
                  </span>
                </label>
              </div>
            )}

            {/* Tab Switched Header buttons */}
            <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200/80 mb-4 shadow-inner">
              <button
                type="button"
                onClick={() => setActionActiveTab("general")}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all cursor-pointer text-center ${
                  actionActiveTab === "general"
                    ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/30 font-black"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                基本檢視
              </button>
              <button
                type="button"
                onClick={() => setActionActiveTab("status")}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all cursor-pointer text-center relative ${
                  actionActiveTab === "status"
                    ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/30 font-black"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                狀態設定
                {(selectedActionTab?.isFavoriteHighlight || selectedActionTab?.isOperationConfirmed || selectedActionTab?.isDeviationConfirmed) && (
                  <span className="absolute top-2 right-4 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                )}
              </button>
            </div>

            {/* Tab content with transition */}
            <div className="min-h-[220px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={actionActiveTab}
                  initial={{ opacity: 0, x: actionActiveTab === "general" ? -8 : 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: actionActiveTab === "general" ? 8 : -8 }}
                  transition={{ duration: 0.15 }}
                  className="grid grid-cols-1 gap-3"
                >
                  {actionActiveTab === "general" ? (
                    <>
                      <button
                        onClick={() => {
                          if (selectedActionTab) {
                            navigate(`/stock/${selectedActionTab.id}`);
                            setIsActionDialogOpen(false);
                          }
                        }}
                        onMouseEnter={() => selectedActionTab && prefetchStockPrice(selectedActionTab.symbol)}
                        className="w-full py-4 px-4 bg-zinc-50 hover:bg-zinc-100/70 border border-zinc-200 rounded-xl flex items-center justify-between transition-all group shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ExternalLink className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm text-zinc-800">檢視細節</p>
                            <p className="text-[10px] font-bold text-zinc-500">
                              進入個股詳情頁面
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                      </button>

                      <button
                        onClick={() => {
                          if (selectedActionTab) {
                            updateTab(selectedActionTab.id, {
                              isNew: !selectedActionTab.isNew,
                            });
                            setIsActionDialogOpen(false);
                          }
                        }}
                        className={`w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group cursor-pointer ${
                          selectedActionTab?.isNew
                            ? "bg-emerald-50 border-emerald-250 hover:bg-[#D8F3E5]"
                            : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100/70 shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${selectedActionTab?.isNew ? 'bg-emerald-500/20' : 'bg-zinc-200/80'}`}>
                            <Sparkles className={`w-5 h-5 ${selectedActionTab?.isNew ? 'text-emerald-600' : 'text-zinc-550'}`} />
                          </div>
                          <div className="text-left">
                            <p className={`font-black text-sm ${selectedActionTab?.isNew ? 'text-emerald-700' : 'text-zinc-800'}`}>
                              更新版本
                            </p>
                            <p className={`text-[10px] font-bold ${selectedActionTab?.isNew ? 'text-emerald-700/80' : 'text-zinc-500'}`}>
                              新增或移除卡片頂部的 NEW 標籤與彩色漸層細線
                            </p>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 transition-all group-hover:translate-x-1 ${selectedActionTab?.isNew ? 'text-emerald-600' : 'text-zinc-400 group-hover:text-emerald-500'}`} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (selectedActionTab) {
                            handleToggleTabHighlight(
                              selectedActionTab.id,
                              selectedActionTab.isFavoriteHighlight,
                            );
                          }
                        }}
                        className={`w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group cursor-pointer ${
                          selectedActionTab?.isFavoriteHighlight
                            ? "bg-[#B1C28D]/20 border-[#B1C28D]/50 hover:bg-[#B1C28D]/30"
                            : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100/70 shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                              selectedActionTab?.isFavoriteHighlight
                                ? "bg-[#B1C28D]/30"
                                : "bg-amber-100"
                            }`}
                          >
                            <Star
                              className={`w-5 h-5 ${selectedActionTab?.isFavoriteHighlight ? "text-[#58633F] fill-[#58633F]/50" : "text-amber-600"}`}
                            />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm text-zinc-800">
                              {selectedActionTab?.isFavoriteHighlight
                                ? "取消重點"
                                : "重點關注"}
                            </p>
                            <p className="text-[10px] font-bold text-zinc-505">
                              切換首頁卡片高亮狀態
                            </p>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 transition-all group-hover:translate-x-1 ${
                            selectedActionTab?.isFavoriteHighlight
                              ? "text-[#58633F]"
                              : "text-zinc-400 group-hover:text-amber-500"
                          }`}
                        />
                      </button>

                      <button
                        onClick={() => {
                          if (selectedActionTab) {
                            updateTab(selectedActionTab.id, {
                              isOperationConfirmed:
                                !selectedActionTab.isOperationConfirmed,
                            });
                            setIsActionDialogOpen(false);
                          }
                        }}
                        className={`w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group cursor-pointer ${
                          selectedActionTab?.isOperationConfirmed
                            ? "bg-emerald-50 border-emerald-250 hover:bg-emerald-100/50"
                            : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100/70 shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                              selectedActionTab?.isOperationConfirmed
                                ? "bg-[#5cb884]/20"
                                : "bg-emerald-500/10"
                            }`}
                          >
                            <CheckCircle2
                              className={`w-5 h-5 ${selectedActionTab?.isOperationConfirmed ? "text-emerald-700 font-bold" : "text-emerald-600"}`}
                            />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm text-zinc-800">操作確認</p>
                            <p className="text-[10px] font-bold text-zinc-500">
                              切換首頁卡片顏色
                            </p>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 transition-all group-hover:translate-x-1 ${
                            selectedActionTab?.isOperationConfirmed
                              ? "text-emerald-700"
                              : "text-zinc-400 group-hover:text-emerald-600"
                          }`}
                        />
                      </button>

                      <button
                        onClick={() => {
                          if (selectedActionTab) {
                            updateTab(selectedActionTab.id, {
                              isDeviationConfirmed:
                                !selectedActionTab.isDeviationConfirmed,
                            });
                            setIsActionDialogOpen(false);
                          }
                        }}
                        className={`w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group cursor-pointer ${
                          selectedActionTab?.isDeviationConfirmed
                            ? "bg-[#F5E6DB]/90 border-[#A55F2A]/35 hover:bg-[#F5E6DB]"
                            : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100/70 shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                              selectedActionTab?.isDeviationConfirmed
                                ? "bg-[#F0D1B9]/60"
                                : "bg-[#F0D1B9]/30"
                            }`}
                          >
                            <Star
                              className={`w-5 h-5 ${selectedActionTab?.isDeviationConfirmed ? "text-[#854D20]" : "text-[#b06a34]"}`}
                            />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm text-zinc-800">乖離確認</p>
                            <p className="text-[10px] font-bold text-zinc-505">
                              更改卡片標題背景顏色
                            </p>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 transition-all group-hover:translate-x-1 ${
                            selectedActionTab?.isDeviationConfirmed
                              ? "text-[#854D20]"
                              : "text-zinc-400 group-hover:text-[#b06a34]"
                          }`}
                        />
                      </button>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </DialogContent>
        </Dialog>

        {/* System Help & Keyboard Shortcuts Dialog */}
        <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
          <DialogContent className="border border-white/10 bg-[#0F0F12]/95 backdrop-blur-2xl text-white w-[92vw] sm:max-w-lg max-h-[90vh] flex flex-col p-5 sm:p-6 rounded-2xl shadow-2xl overflow-hidden scrollbar-hide [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
            <DialogHeader className="space-y-3 pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-emerald-400" />
                  系統說明與指南
                </DialogTitle>
              </div>

              {/* Multi-Tab Buttons */}
              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setHelpDialogTab("shortcuts")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    helpDialogTab === "shortcuts"
                      ? "bg-emerald-500 text-black shadow-md"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>快捷鍵指南</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHelpDialogTab("priceImport")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    helpDialogTab === "priceImport"
                      ? "bg-emerald-500 text-black shadow-md"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>股價獲取與匯入</span>
                </button>
              </div>
            </DialogHeader>

            {helpDialogTab === "shortcuts" ? (
              <div className="space-y-4 py-3 flex-1 overflow-y-auto pr-1 scrollbar-hide [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
                <p className="text-xs text-white/50 font-medium">
                  使用以下快捷鍵更快速地操作系統：
                </p>

                {/* Section 1: 虛擬交易 / 持有中 */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-400 tracking-wide flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    持有中 / 虛擬交易快捷鍵
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "Shift + 1", desc: "持有中 tab" },
                      { key: "Alt + 1", desc: "虛擬交易" },
                      { key: "Alt + 2", desc: "候選名單" },
                      { key: "Alt + 3", desc: "買進操作" },
                      { key: "Alt + 4", desc: "賣出操作" },
                      { key: "Alt + 5", desc: "乖離名單" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="bg-white/5 border border-white/5 rounded-lg p-2 flex flex-col gap-0.5"
                      >
                        <span className="text-[10px] font-black text-emerald-300 tracking-wider font-mono">
                          {item.key}
                        </span>
                        <span className="text-xs font-bold text-white/80">
                          {item.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: 真實交易 */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-teal-400 tracking-wide flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                    真實交易快捷鍵
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "Shift + 2", desc: "真實交易 tab" },
                      { key: "Ctrl + Shift + 1", desc: "觀察中" },
                      { key: "Ctrl + Shift + 2", desc: "候選名單" },
                      { key: "Ctrl + Shift + 3", desc: "買進操作" },
                      { key: "Ctrl + Shift + 4", desc: "賣出操作" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="bg-white/5 border border-white/5 rounded-lg p-2 flex flex-col gap-0.5"
                      >
                        <span className="text-[10px] font-black text-teal-300 tracking-wider font-mono">
                          {item.key}
                        </span>
                        <span className="text-xs font-bold text-white/80">
                          {item.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 3: 導覽與操作 */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-cyan-400 tracking-wide flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    總覽、分析與通用工具
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "Shift + B", desc: "回到交易總覽頁面" },
                      { key: "Shift + I", desc: "匯入最新價格" },
                      { key: "快速連按 H H / Shift + H", desc: "預覽模式 / 全螢幕" },
                      { key: "Shift + F", desc: "搜尋股票" },
                      { key: "Shift + M", desc: "電影觀賞模式" },
                      { key: "Shift + D", desc: "AI 分析回傳" },
                      { key: "Shift + A", desc: "新增股票" },
                      { key: "Alt + W", desc: "動態視覺圖示標籤" },
                      { key: "Alt + Z", desc: "全部翻頁" },
                      { key: "Alt + Q", desc: "顯示 / 隱藏數據統計" },
                      { key: "Alt + ← / →", desc: "橫向滾動卡片" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="bg-white/5 border border-white/5 rounded-lg p-2 flex flex-col gap-0.5"
                      >
                        <span className="text-[10px] font-black text-cyan-300 tracking-wider font-mono">
                          {item.key}
                        </span>
                        <span className="text-xs font-bold text-white/80">
                          {item.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 py-3 text-xs text-white/80 leading-relaxed flex-1 overflow-y-auto pr-1 scrollbar-hide [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
                {/* Section 1: API & Source */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Globe className="w-4 h-4 shrink-0" />
                    <span>數據來源與 API 串接</span>
                  </div>
                  <p className="text-white/70">
                    本系統透過後端安全的代理服務（Proxy API <code className="text-emerald-300 font-mono bg-black/40 px-1 py-0.5 rounded">/api/stock/:symbol</code>）即時串接 <strong className="text-white">Yahoo Finance 全球金融行情數據</strong>。
                  </p>
                  <p className="text-white/70">
                    支援美股（例如 <span className="text-emerald-300 font-mono font-bold">NVDA</span>、<span className="text-emerald-300 font-mono font-bold">AAPL</span>、<span className="text-emerald-300 font-mono font-bold">TSLA</span>）以及台股（如 <span className="text-emerald-300 font-mono font-bold">2330.TW</span>、<span className="text-emerald-300 font-mono font-bold">2454.TW</span>、<span className="text-emerald-300 font-mono font-bold">0050.TW</span>）與全球主要公開市場標的。
                  </p>
                </div>

                {/* Section 2: Import methods */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    <span>獲取與匯入最新股價機制</span>
                  </div>
                  <ul className="space-y-2 text-white/70 list-disc list-inside">
                    <li>
                      <strong className="text-white">一鍵全批量匯入</strong>：點擊頂部橫幅的 <span className="text-emerald-300 font-bold">「↻ 匯入最新現價」</span> 按鈕（或鍵盤快捷鍵 <code className="text-emerald-300 font-mono bg-black/40 px-1 py-0.5 rounded">Shift + I</code>），系統將自動為目前所有「持有中」的股票抓取最新即時成交價，並更新資料庫。
                    </li>
                    <li>
                      <strong className="text-white">背景自動預載 (Prefetch)</strong>：當您在卡片列表瀏覽或開啟股票詳情頁時，系統會在背景以 Ajax 自動預抓最新現價，隨時同步計算最新未實現損益。
                    </li>
                    <li>
                      <strong className="text-white">個股手動模擬試算</strong>：在個股詳情頁面，您亦可手動輸入目標成交價進行策略與損益動態模擬。
                    </li>
                  </ul>
                </div>

                {/* Section 3: Cache & Market hours */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Zap className="w-4 h-4 shrink-0" />
                    <span>快取保護與休市說明</span>
                  </div>
                  <p className="text-white/70">
                    <strong className="text-white">快取機制</strong>：為維持網頁回應效能並防止過度頻繁請求 API，背景設有 30 秒快取保護。
                  </p>
                  <p className="text-white/70">
                    <strong className="text-white">休市期間</strong>：若於非交易時段（如美股盤後或例假日）執行匯入，系統抓取並顯示的為最近一交易日之常規收盤價 (Regular Market Close Price)。
                  </p>
                </div>

                {/* Section 4: Symbol tip */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-200/90 text-xs flex items-start gap-2">
                  <Database className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-emerald-300 block mb-0.5">台股代碼輸入提醒：</strong>
                    台股請務必在代碼後加上 <code className="text-white font-mono bg-black/40 px-1 rounded">.TW</code>（例如台積電請輸入 <code className="text-white font-mono bg-black/40 px-1 rounded">2330.TW</code>），系統才能正確連結行情數據。
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2 border-t border-white/10 shrink-0">
              <Button
                onClick={() => setIsHelpOpen(false)}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl cursor-pointer transition-colors"
              >
                了解並關閉
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {(activeViewTab === "active" || activeViewTab === "real") && (
          <div id="active-cards-section" className="grid grid-cols-1 gap-6">
            <div className="space-y-4">
              <ScrollIn delay={0.2} translateY={20}>
                <div className={`w-screen relative left-1/2 -translate-x-1/2 border-y flex flex-col group transition-all duration-500 ${activeViewTab === "real" ? "border-teal-500/10 bg-teal-500/[0.01]" : "border-emerald-500/10 bg-emerald-500/[0.01]"}`}>
                  <div className={`py-2 border-b w-full ${activeViewTab === "real" ? "border-teal-500/10" : "border-emerald-500/10"}`}>
                    {/* Desktop/Tablet version */}
                    <div className="hidden md:flex max-w-6xl mx-auto px-4 items-center justify-between w-full">
                      <div className="flex items-center gap-4">
                        <div className={`w-1.5 h-6 rounded-full transition-all duration-300 ${activeViewTab === "real" ? "bg-gradient-to-b from-teal-400 to-teal-600 shadow-[0_0_10px_rgba(20,184,166,0.5)]" : "bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"}`}></div>
                        <div className="flex bg-zinc-100 p-1 border border-zinc-200/80 rounded-xl gap-1 shadow-inner">
                          {visibleSubTabs.map((tab) => {
                            const conf = holdingTabConfig[tab];
                            const TabIcon = conf.icon;
                            const tabCount = effectiveVisibleActiveTabs.filter(
                              (t) => getDisplayHoldingStatus(t.holdingStatus) === tab,
                            ).length;
                            const isActive = activeHoldingSubTab === tab;

                            return (
                              <button
                                key={tab}
                                onClick={() => {
                                  playClickSound();
                                  setActiveHoldingSubTab(tab as any);
                                  setTimeout(() => {
                                    scrollToElement("#active-cards-section", -20);
                                  }, 50);
                                }}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 border cursor-pointer ${
                                  isActive
                                    ? `${conf.colorClass} ${conf.bgClass} ${conf.borderClass} ${conf.shadowClass}`
                                    : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50 border-transparent shadow-none"
                                }`}
                              >
                                <TabIcon className="w-3.5 h-3.5" />
                                {tab === "觀察中" && activeViewTab === "active" ? "虛擬交易" : tab}
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${
                                  isActive 
                                    ? conf.activeCountClass 
                                    : "bg-zinc-200/50 border-zinc-300/40 text-zinc-650"
                                }`}>
                                  <AnimatedNumber value={tabCount} />{" "}檔
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {effectiveHiddenActiveTabs.length > 0 && (
                          <span className="text-xs font-bold border border-zinc-200 bg-zinc-50 text-zinc-500 px-3 py-1 rounded-full flex items-center gap-1.5">
                            <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                            已隱藏 {effectiveHiddenActiveTabs.length} 檔
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <InteractiveButton
                          noGlow
                          as="button"
                          onClick={() => {
                            setIsAiAnalysisOpen(true);
                            playClickSound();
                          }}
                          title="Ai分析回傳"
                          className="p-2 bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-850 hover:bg-zinc-100 rounded-md transition-all cursor-pointer flex items-center justify-center"
                        >
                          <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
                        </InteractiveButton>
                        <InteractiveButton
                          noGlow
                          as="button"
                          onClick={() => {
                            setIsVisualLinesBoardOpen(true);
                            playClickSound();
                          }}
                          title="動態視覺線標籤 (Alt + W)"
                          className="p-2 bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-850 hover:bg-zinc-100 rounded-md transition-all cursor-pointer flex items-center justify-center"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </InteractiveButton>
                        <InteractiveButton
                          noGlow
                          as="button"
                          onClick={async () => {
                            playClickSound();
                            if (!selectedCardIds || selectedCardIds.size === 0) {
                              toast.info("請先在卡片列表中勾選要同步的個股卡片（勾選圓形 Tickbox），再點擊一鍵同步");
                              return;
                            }
                            const targetTabs = tabs.filter(
                              (tab) => tab.status !== "COMPLETED" && selectedCardIds.has(tab.id)
                            );
                            if (targetTabs.length === 0) {
                              toast.error("所勾選的卡片中沒有可同步的有效個股卡片");
                              return;
                            }
                            const res = await syncSubTabDividersToCanvas(
                              targetTabs,
                              user?.uid,
                              activeTabStrategies,
                              activeTabStatsMap
                            );
                            if (res.updatedCount > 0) {
                              playSuccessSound();
                              toast.success(
                                `已成功同步所勾選的 ${res.updatedCount} 檔卡片分隔線現價相對位置至視覺線畫布！(${res.updatedSymbols.join(", ")})`
                              );
                            } else {
                              toast.info(
                                "所勾選的卡片中尚未包含分隔線（請在視覺圖示化卡片上繪製分隔線後再同步）"
                              );
                            }
                          }}
                          title="一鍵同步所勾選卡片之分隔線現價相對位置至動態視覺線畫布"
                          className="p-2 bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-emerald-700 hover:bg-emerald-50/60 rounded-md transition-all cursor-pointer flex items-center justify-center"
                        >
                          <Target className="w-4 h-4 text-emerald-600" />
                        </InteractiveButton>
                        <InteractiveButton
                          noGlow
                          as="button"
                          onClick={() => setIsManageHiddenOpen(true)}
                          title="管理持有中股票"
                          className="p-2 bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-850 hover:bg-zinc-100 rounded-md transition-all cursor-pointer"
                        >
                          <Settings2 className="w-4 h-4" />
                        </InteractiveButton>
                        <InteractiveButton
                          noGlow
                          as="button"
                          onClick={() => {
                            if (filteredSubTabVisibleTabs.length > 0) {
                              const isCurrentActiveVisible = filteredSubTabVisibleTabs.some(t => t.id === activeCardTabId);
                              const targetId = isCurrentActiveVisible ? (activeCardTabId || filteredSubTabVisibleTabs[0].id) : filteredSubTabVisibleTabs[0].id;
                              setActiveCinemaCardId(targetId);
                              setIsCinemaModeActive(true);
                              
                              if (document.documentElement.requestFullscreen) {
                                document.documentElement.requestFullscreen().catch((err) => {
                                  console.warn("Fullscreen request rejected:", err);
                                });
                              }
                              playClickSound();
                            } else {
                              toast.error("目前無可見的股票卡片可供放大");
                            }
                          }}
                          title="放大卡片 (電影觀賞模式)"
                          className="p-2 bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-850 hover:bg-zinc-100 rounded-md transition-all cursor-pointer flex items-center justify-center"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </InteractiveButton>
                        <InteractiveButton
                          noGlow
                          as="button"
                          onClick={handleFlipAllCards}
                          title="卡片全部翻面 (Alt + Z)"
                          className="p-2 bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-850 hover:bg-zinc-100 rounded-md transition-all cursor-pointer flex items-center justify-center"
                        >
                          <BookOpen className="w-4 h-4" />
                        </InteractiveButton>
                        <InteractiveButton
                          noGlow
                          as="button"
                          onClick={handleExportMd}
                          title="匯出持有股數交易數據 (.md)"
                          className="p-2 bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-850 hover:bg-zinc-100 rounded-md transition-all cursor-pointer flex items-center justify-center"
                        >
                          <Printer className="w-4 h-4" />
                        </InteractiveButton>
                      </div>
                    </div>

                    {/* Redesigned Premium Mobile version */}
                    <div className="flex md:hidden flex-col w-full gap-3.5 px-4 py-1.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-150 w-full">
                        <div className="flex items-center gap-2">
                          {effectiveHiddenActiveTabs.length > 0 && (
                            <span className="text-[10px] font-black border border-zinc-250 bg-zinc-50 text-zinc-500 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                              <EyeOff className="w-3 h-3 text-zinc-400" />
                              已隱藏 {effectiveHiddenActiveTabs.length} 檔
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <InteractiveButton
                            noGlow
                            as="button"
                            onClick={() => {
                              setIsAiAnalysisOpen(true);
                              playClickSound();
                            }}
                            className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:text-zinc-850 hover:bg-zinc-100 rounded-lg transition-all text-[11px] flex items-center gap-1 font-extrabold cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" />
                            Ai分析
                          </InteractiveButton>
                          <InteractiveButton
                            noGlow
                            as="button"
                            onClick={() => {
                              setIsVisualLinesBoardOpen(true);
                              playClickSound();
                            }}
                            className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:text-zinc-850 hover:bg-zinc-100 rounded-lg transition-all text-[11px] flex items-center gap-1 font-extrabold cursor-pointer"
                            title="動態視覺線標籤 (Alt + W)"
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                            視覺線
                          </InteractiveButton>
                          <InteractiveButton
                            noGlow
                            as="button"
                            onClick={async () => {
                              playClickSound();
                              if (!selectedCardIds || selectedCardIds.size === 0) {
                                toast.info("請先在卡片列表中勾選要同步的個股卡片（勾選圓形 Tickbox），再點擊一鍵同步");
                                return;
                              }
                              const targetTabs = tabs.filter(
                                (tab) => tab.status !== "COMPLETED" && selectedCardIds.has(tab.id)
                              );
                              if (targetTabs.length === 0) {
                                toast.error("所勾選的卡片中沒有可同步的有效個股卡片");
                                return;
                              }
                              const res = await syncSubTabDividersToCanvas(
                                targetTabs,
                                user?.uid,
                                activeTabStrategies,
                                activeTabStatsMap
                              );
                              if (res.updatedCount > 0) {
                                playSuccessSound();
                                toast.success(
                                  `已同步所勾選的 ${res.updatedCount} 檔股票分隔線現價 (${res.updatedSymbols.join(", ")})`
                                );
                              } else {
                                toast.info(
                                  "所勾選的卡片中尚未包含分隔線（請在視覺圖示化卡片上繪製分隔線後再同步）"
                                );
                              }
                            }}
                            className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:text-emerald-700 hover:bg-emerald-50/60 rounded-lg transition-all text-[11px] flex items-center gap-1 font-extrabold cursor-pointer"
                            title="一鍵同步所勾選卡片之分隔線現價相對位置至動態視覺線畫布"
                          >
                            <Target className="w-3 h-3 text-emerald-600" />
                            同步線
                          </InteractiveButton>
                          <InteractiveButton
                            noGlow
                            as="button"
                            onClick={() => setIsManageHiddenOpen(true)}
                            className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:text-zinc-850 hover:bg-zinc-100 rounded-lg transition-all text-[11px] flex items-center gap-1 font-extrabold cursor-pointer"
                          >
                            <Settings2 className="w-3 h-3" />
                            管理
                          </InteractiveButton>
                          <InteractiveButton
                            noGlow
                            as="button"
                            onClick={handleFlipAllCards}
                            className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:text-zinc-850 hover:bg-zinc-100 rounded-lg transition-all text-[11px] flex items-center gap-1 font-extrabold cursor-pointer"
                          >
                            <BookOpen className="w-3 h-3" />
                            翻面
                          </InteractiveButton>
                          <InteractiveButton
                            noGlow
                            as="button"
                            onClick={() => {
                              if (filteredSubTabVisibleTabs.length > 0) {
                                const isCurrentActiveVisible = filteredSubTabVisibleTabs.some(t => t.id === activeCardTabId);
                                const targetId = isCurrentActiveVisible ? (activeCardTabId || filteredSubTabVisibleTabs[0].id) : filteredSubTabVisibleTabs[0].id;
                                setActiveCinemaCardId(targetId);
                                setIsCinemaModeActive(true);
                                playClickSound();
                              } else {
                                toast.error("目前無可見的股票卡片可供放大");
                              }
                            }}
                            className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:text-zinc-850 hover:bg-zinc-100 rounded-lg transition-all text-[11px] flex items-center gap-1 font-extrabold cursor-pointer"
                            title="放大卡片"
                          >
                            <Maximize2 className="w-3 h-3" />
                            放大
                          </InteractiveButton>
                          <InteractiveButton
                            noGlow
                            as="button"
                            onClick={handleExportMd}
                            className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:text-zinc-850 hover:bg-zinc-100 rounded-lg transition-all text-[11px] flex items-center gap-1 font-extrabold cursor-pointer"
                            title="匯出持股資料"
                          >
                            <Printer className="w-3 h-3" />
                            匯出
                          </InteractiveButton>
                        </div>
                      </div>

                      <div className="relative w-full overflow-hidden">
                        {/* Smooth scroll masks */}
                        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-zinc-50 to-transparent pointer-events-none z-10" />
                        <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-zinc-50 to-transparent pointer-events-none z-10" />

                        <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-hide py-1 pl-4 pr-4 -mx-4 snap-x snap-mandatory">
                          {visibleSubTabs.map((tab) => {
                            const conf = holdingTabConfig[tab];
                            const TabIcon = conf.icon;
                            const tabCount = effectiveVisibleActiveTabs.filter(
                              (t) => getDisplayHoldingStatus(t.holdingStatus) === tab,
                            ).length;
                            const isActive = activeHoldingSubTab === tab;

                            return (
                              <button
                                key={tab}
                                onClick={(e) => {
                                  playClickSound();
                                  setActiveHoldingSubTab(tab as any);
                                  e.currentTarget.scrollIntoView({
                                    behavior: "smooth",
                                    block: "nearest",
                                    inline: "center",
                                  });
                                  setTimeout(() => {
                                    scrollToElement("#active-cards-section", -20);
                                  }, 50);
                                }}
                                className={`flex-shrink-0 snap-center flex items-center gap-1.5 px-3.5 py-2 rounded-xl border font-bold text-xs transition-all duration-300 relative cursor-pointer ${
                                  isActive
                                    ? `${conf.colorClass} ${conf.bgClass} ${conf.borderClass} ${conf.shadowClass} scale-[1.03] z-10`
                                    : "bg-zinc-50 border-zinc-200/60 text-zinc-500 hover:bg-zinc-100/75 hover:text-zinc-800"
                                }`}
                              >
                                <TabIcon className={`w-3.5 h-3.5 ${isActive ? conf.colorClass : "text-zinc-400"}`} />
                                <span>{tab === "觀察中" && activeViewTab === "active" ? "虛擬交易" : tab}</span>
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg border ${
                                    isActive
                                      ? conf.activeCountClass
                                      : "bg-zinc-200/50 border-zinc-250/50 text-zinc-600 font-bold"
                                  }`}
                                >
                                  {tabCount}
                                </span>

                                {isActive && (
                                  <motion.div
                                    layoutId="activeTabUnderlineMobile"
                                    className="absolute bottom-1 left-3.5 right-3.5 h-0.5 rounded-full bg-current opacity-60"
                                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Shared Controlled Dialog without a local Trigger */}
                    <Dialog
                      open={isManageHiddenOpen}
                      onOpenChange={(open) => {
                        setIsManageHiddenOpen(open);
                        if (!open) setConfirmDeleteId(null);
                      }}
                    >
                      <DialogContent data-lenis-prevent className="border border-zinc-200 shadow-2xl bg-white text-zinc-800 outline-none w-11/12 sm:max-w-3xl max-h-[85vh] overflow-y-auto overscroll-y-contain overflow-x-hidden !rounded-2xl p-6">
                        <DialogHeader>
                          <DialogTitle className="font-black text-xl text-zinc-900 border-b border-zinc-200 pb-3">
                            管理持有中股票
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                          {/* 主要交易類型分頁 (持有中 vs 真實交易) */}
                          <div className="flex bg-zinc-100 p-1 rounded-xl w-full border border-zinc-200 shadow-inner">
                            <button
                              type="button"
                              onClick={() => setManageTradeType("simulated")}
                              className={`flex-1 py-2 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                                manageTradeType === "simulated"
                                  ? "bg-emerald-500 text-white shadow-sm font-black"
                                  : "text-zinc-600 hover:text-zinc-800 hover:bg-zinc-200/40"
                              }`}
                            >
                              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span>持有中 ({activeTabs.filter((t) => t.tradeType === "simulated").length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setManageTradeType("real")}
                              className={`flex-1 py-2 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                                manageTradeType === "real"
                                  ? "bg-teal-600 text-white shadow-sm font-black"
                                  : "text-zinc-600 hover:text-zinc-800 hover:bg-zinc-200/40"
                              }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span>真實交易 ({activeTabs.filter((t) => t.tradeType === "real").length})</span>
                            </button>
                          </div>

                          {/* 子分頁列 (觀察中 | 候選名單 | 買進操作 | 賣出操作 | 平倉操作 | 乖離名單 | 持股監控) */}
                          <div className="flex bg-zinc-50 p-1 rounded-xl w-full overflow-x-auto scrollbar-hide border border-zinc-200">
                            {(
                              [
                                "觀察中",
                                "候選名單",
                                "買進操作",
                                "賣出操作",
                                "平倉操作",
                                "乖離名單",
                                "持股監控",
                              ] as const
                            ).map((tab) => {
                              const dialogEffectiveHiddenActiveTabs = hiddenActiveTabs.filter(
                                (t) => t.tradeType === manageTradeType
                              );
                              return (
                                <button
                                  key={tab}
                                  onClick={() => setActiveManageTab(tab)}
                                  className={`flex-shrink-0 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                                    activeManageTab === tab
                                      ? manageTradeType === "real"
                                        ? "bg-teal-600 text-white font-black shadow-sm"
                                        : "bg-emerald-500 text-white font-black shadow-sm"
                                      : "text-zinc-600 hover:text-black hover:bg-zinc-200/50"
                                  }`}
                                >
                                  <span>{tab === "觀察中" && manageTradeType === "simulated" ? "虛擬交易" : tab}</span>
                                  {tab === "持股監控" && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black border ${
                                      activeManageTab === tab
                                        ? "bg-white/20 text-white border-white/20"
                                        : manageTradeType === "real"
                                        ? "bg-teal-50 text-teal-700 border-teal-200"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}>
                                      {dialogEffectiveHiddenActiveTabs.length}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          <div className="space-y-4">
                            {(() => {
                              const dialogEffectiveHiddenActiveTabs = hiddenActiveTabs.filter(
                                (t) => t.tradeType === manageTradeType
                              );
                              const dialogEffectiveActiveTabs = activeTabs.filter(
                                (t) => t.tradeType === manageTradeType
                              );

                              const categoryTabs = activeManageTab === "持股監控"
                                ? dialogEffectiveHiddenActiveTabs
                                : dialogEffectiveActiveTabs.filter(
                                    (t) => getDisplayHoldingStatus(t.holdingStatus) === activeManageTab
                                  );

                              if (categoryTabs.length === 0) {
                                return (
                                  <div className="text-center text-zinc-400 py-12 text-sm font-black bg-zinc-50 border border-zinc-200 border-dashed rounded-xl">
                                    {activeManageTab === "持股監控"
                                      ? "目前無隱藏的個股名單"
                                      : `此分類下沒有${manageTradeType === "real" ? "真實交易" : "持有中"}股票`}
                                  </div>
                                );
                              }
                              return categoryTabs.map((tab) => {
                                const idx = dialogEffectiveActiveTabs.findIndex(t => t.id === tab.id);
                                return (
                                  <div
                                    className="flex flex-col gap-3.5 p-4 rounded-xl border border-zinc-200 bg-zinc-50/55 hover:bg-zinc-50 transition-colors relative overflow-hidden shadow-xs"
                                    key={tab.id}
                                  >
                                    <div className="flex items-center justify-between z-10 w-full relative border-b border-zinc-200 pb-2">
                                      <div className="flex items-center gap-3">
                                        <span
                                          className={`font-black text-base ${tab.isHidden ? "text-zinc-400 line-through decoration-zinc-300" : "text-zinc-800"}`}
                                        >
                                          {tab.symbol}
                                        </span>
                                        {tab.tradeType === "simulated" ? (
                                          <Badge className="bg-amber-50 border border-amber-200 text-amber-700 font-extrabold rounded-md shadow-xs">
                                            模擬
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold rounded-md shadow-xs">
                                            真實
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => moveTabUp(idx, dialogEffectiveActiveTabs)}
                                          disabled={idx === 0}
                                          className="p-1.5 rounded-lg bg-white hover:bg-zinc-100 disabled:opacity-20 disabled:cursor-not-allowed border border-zinc-200 shadow-xs transition-colors cursor-pointer"
                                          title="往上移"
                                        >
                                          <ArrowUp className="w-3.5 h-3.5 text-zinc-600" />
                                        </button>
                                        <button
                                          onClick={() => moveTabDown(idx, dialogEffectiveActiveTabs)}
                                          disabled={idx === dialogEffectiveActiveTabs.length - 1}
                                          className="p-1.5 rounded-lg bg-white hover:bg-zinc-100 disabled:opacity-20 disabled:cursor-not-allowed border border-zinc-200 shadow-xs transition-colors cursor-pointer"
                                          title="往下移"
                                        >
                                          <ArrowDown className="w-3.5 h-3.5 text-zinc-600" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 mt-1">
                                      {(
                                        [
                                          "觀察中",
                                          "候選名單",
                                          "買進操作",
                                          "賣出操作",
                                          "平倉操作",
                                          "乖離名單",
                                        ] as const
                                      ).map((cat) => {
                                        const isSelected = getDisplayHoldingStatus(tab.holdingStatus) === cat;
                                        return (
                                          <button
                                            key={cat}
                                            onClick={() =>
                                              updateTab(tab.id, {
                                                holdingStatus: cat,
                                              })
                                            }
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all border cursor-pointer ${
                                              isSelected
                                                ? "bg-emerald-500 text-white border-emerald-600 shadow-xs"
                                                : "bg-white text-zinc-700 hover:bg-zinc-100 border-zinc-200 shadow-xs"
                                            }`}
                                          >
                                            {cat === "觀察中" && tab.tradeType === "simulated" ? "虛擬交易" : cat}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-1.5 w-full relative">
                                      <button
                                        onClick={() =>
                                          updateTabHidden(tab.id, !tab.isHidden)
                                        }
                                        className={`flex-1 h-[48px] sm:h-[44px] rounded-lg sm:rounded-md border transition-all flex flex-row items-center justify-center gap-2 font-black text-base sm:text-xs cursor-pointer ${tab.isHidden ? "bg-zinc-200 border-zinc-300 text-zinc-600 hover:bg-zinc-300 shadow-xs" : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 shadow-sm"}`}
                                      >
                                        {tab.isHidden ? (
                                          <EyeOff className="w-5 h-5 sm:w-3.5 sm:h-3.5 text-zinc-500" />
                                        ) : (
                                          <Eye className="w-5 h-5 sm:w-3.5 sm:h-3.5 text-amber-600 font-extrabold" />
                                        )}
                                        {tab.isHidden ? "取消隱藏" : "隱藏"}
                                      </button>

                                      <button
                                        onClick={() => toggleTabGroup(tab)}
                                        className={`flex-1 h-[48px] sm:h-[44px] rounded-lg sm:rounded-md border transition-all flex flex-row items-center justify-center gap-2 font-black text-base sm:text-xs cursor-pointer ${tab.groupId ? "bg-purple-100 border-purple-200 text-purple-700 hover:bg-purple-150 shadow-sm" : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100 shadow-xs"}`}
                                      >
                                        <Link className={`w-5 h-5 sm:w-3.5 sm:h-3.5 ${tab.groupId ? 'text-purple-600 font-black' : 'text-zinc-500'}`} />
                                        {tab.groupId ? "解除區塊" : "區塊"}
                                      </button>

                                      {confirmDeleteId === tab.id ? (
                                        <div className="absolute right-0 top-0 bottom-0 bg-white border border-rose-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-end w-full rounded-lg sm:rounded-md px-1 py-1 sm:py-0 z-10 gap-2 shadow-lg">
                                          <span className="text-zinc-800 text-xs font-black mr-auto ml-3 hidden sm:inline">
                                            確定刪除股票 【{tab.symbol}】？
                                          </span>
                                          <div className="flex gap-2 h-full w-full sm:w-auto p-1 sm:p-0">
                                            <button
                                              onClick={() =>
                                                setConfirmDeleteId(null)
                                              }
                                              className="flex-1 sm:flex-none p-1.5 px-3 h-full sm:h-[32px] rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-600 hover:bg-zinc-200 text-base sm:text-xs font-black cursor-pointer"
                                            >
                                              取消
                                            </button>
                                            <button
                                              onClick={() => {
                                                deleteTab(tab.id);
                                                setConfirmDeleteId(null);
                                              }}
                                              className="flex-1 sm:flex-none p-1.5 px-3 h-full sm:h-[32px] rounded-lg bg-rose-600 border border-rose-700 text-white hover:bg-rose-700 text-base sm:text-xs font-black cursor-pointer shadow-sm"
                                            >
                                              確認刪除
                                            </button>
                                          </div>
                                        </div>
                                      ) : groupingTabId === tab.id ? (
                                        <div className="absolute right-0 top-0 bottom-0 bg-white border border-purple-200 shadow-xl flex flex-col items-center justify-center w-full rounded-lg px-2 py-2 z-10 gap-2 backdrop-blur-xl">
                                          <div className="text-zinc-800 text-xs font-black w-full text-center">選擇要連動的股票 (同一代號)</div>
                                          <div className="flex flex-wrap gap-2 w-full items-center justify-center">
                                             {activeTabs.filter(t => t.symbol === tab.symbol && t.id !== tab.id).length === 0 ? (
                                                <span className="text-rose-600 text-xs font-black">無其他相同代號的持有中股票</span>
                                             ) : (
                                                activeTabs.filter(t => t.symbol === tab.symbol && t.id !== tab.id).map(target => (
                                                   <button 
                                                      key={target.id}
                                                      onClick={(e) => { e.stopPropagation(); handleGroupWith(tab.id, target); }}
                                                      className={`px-3 py-1 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-black transition-colors cursor-pointer ${target.groupId ? "bg-purple-100 text-purple-700 border-purple-200" : "text-zinc-700 hover:text-black hover:border-zinc-300"}`}
                                                   >
                                                      {target.holdingStatus || '未分類'}
                                                   </button>
                                                ))
                                             )}
                                          </div>
                                          <button 
                                            onClick={() => setGroupingTabId(null)}
                                            className="absolute right-2 top-2 p-1 text-zinc-400 hover:text-zinc-800 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded cursor-pointer"
                                          >
                                            取消
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() =>
                                            setConfirmDeleteId(tab.id)
                                          }
                                          className="flex-1 h-[48px] sm:h-[44px] rounded-lg sm:rounded-md border transition-all bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 flex flex-row items-center justify-center gap-2 font-black text-base sm:text-xs cursor-pointer"
                                        >
                                          <Trash2 className="w-5 h-5 sm:w-3.5 sm:h-3.5 text-rose-600 font-bold" />
                                          刪除
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                          {activeTabs.length === 0 && (
                            <div className="text-zinc-400 text-center py-8 font-black bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                              目前無持有中股票
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                      {/* Sub tab row of small colored blocks */}
                      <div className="py-2.5 px-6 max-w-6xl mx-auto w-full flex items-center justify-between border-t border-zinc-200 sm:border-t-0 select-none">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[11px] font-extrabold text-zinc-650">分組篩選</span>
                          <div className="flex items-center gap-2 bg-zinc-150 p-1 border border-zinc-250/70 rounded-lg">
                            {[
                              { id: "all", tooltip: "全部", color: "bg-zinc-300 hover:bg-zinc-400", activeColor: "bg-zinc-800 ring-2 ring-zinc-300", count: currentSubTabVisibleTabs.length },
                              { id: "highlight", tooltip: "重點關注", color: "bg-[#B1C28D]/50 hover:bg-[#B1C28D]", activeColor: "bg-[#B1C28D] ring-2 ring-[#B1C28D]/30", count: currentSubTabVisibleTabs.filter(t => !!t.isFavoriteHighlight).length },
                              { id: "operation", tooltip: "操作確認", color: "bg-[#A3A3A3]/50 hover:bg-[#A3A3A3]", activeColor: "bg-[#A3A3A3] ring-2 ring-[#A3A3A3]/30", count: currentSubTabVisibleTabs.filter(t => !!t.isOperationConfirmed).length },
                              { id: "deviation", tooltip: "乖離確認", color: "bg-[#F0D1B9]/50 hover:bg-[#F0D1B9]", activeColor: "bg-[#F0D1B9] ring-2 ring-[#F0D1B9]/30", count: currentSubTabVisibleTabs.filter(t => !!t.isDeviationConfirmed).length },
                              { id: "group", tooltip: "連動區塊", color: "bg-sky-500/50 hover:bg-sky-450", activeColor: "bg-sky-400 ring-2 ring-sky-500/35", count: currentSubTabVisibleTabs.filter(t => !!t.groupId).length },
                            ].filter(item => item.count > 0).map((filterItem) => {
                              const isActive = activeCardDefinitionFilter === filterItem.id;
                              return (
                                <button
                                  key={filterItem.id}
                                  onClick={() => setActiveCardDefinitionFilter(filterItem.id as any)}
                                  title={`${filterItem.tooltip} (${filterItem.count} 檔)`}
                                  className={`w-6 h-3 rounded transition-all duration-300 relative cursor-pointer ${
                                    isActive ? `${filterItem.activeColor} scale-110 shadow-md` : `${filterItem.color} opacity-80 hover:opacity-100 hover:scale-105`
                                  }`}
                                >
                                  {isActive && (
                                    <span className="absolute inset-0 m-auto w-1 h-1 rounded-full bg-white shadow-sm" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Dynamic label showing active category & count */}
                          <span className="text-[11px] font-black text-zinc-700 tracking-wider flex items-center gap-1.5 ml-1 border-l border-zinc-250 pl-3 h-4">
                            {
                              (() => {
                                const activeObj = [
                                  { id: "all", label: "全部" },
                                  { id: "highlight", label: "重點關注" },
                                  { id: "operation", label: "操作確認" },
                                  { id: "deviation", label: "乖離確認" },
                                  { id: "group", label: "連動區塊" },
                                ].find(f => f.id === activeCardDefinitionFilter);
                                const activeCount = activeObj ? (
                                  activeObj.id === "all" ? currentSubTabVisibleTabs.length :
                                  activeObj.id === "highlight" ? currentSubTabVisibleTabs.filter(t => !!t.isFavoriteHighlight).length :
                                  activeObj.id === "operation" ? currentSubTabVisibleTabs.filter(t => !!t.isOperationConfirmed).length :
                                  activeObj.id === "deviation" ? currentSubTabVisibleTabs.filter(t => !!t.isDeviationConfirmed).length :
                                  currentSubTabVisibleTabs.filter(t => !!t.groupId).length
                                ) : 0;
                                return activeObj ? `${activeObj.label} (${activeCount} 檔)` : "";
                              })()
                            }
                          </span>
                        </div>

                        {/* Circular Tickbox Select All / Deselect All Toolbar */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {selectedCardIds.size > 0 && (
                            <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-xs select-none">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              已勾選 {selectedCardIds.size} 檔
                            </span>
                          )}
                          <InteractiveButton
                            noGlow
                            as="button"
                            onClick={handleSelectAll}
                            className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-zinc-250 hover:border-emerald-300 text-zinc-700 hover:text-emerald-700 rounded-full text-[11px] font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                            title="全選目前子分頁個股卡片 (再次點擊全選所有子分頁)"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            全選
                          </InteractiveButton>
                          <InteractiveButton
                            noGlow
                            as="button"
                            onClick={handleDeselectAll}
                            disabled={selectedCardIds.size === 0}
                            className={`px-2.5 py-1 bg-white border border-zinc-250 rounded-full text-[11px] font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                              selectedCardIds.size === 0
                                ? "opacity-50 cursor-not-allowed text-zinc-400 bg-zinc-50"
                                : "hover:bg-rose-50 hover:border-rose-300 text-zinc-700 hover:text-rose-600"
                            }`}
                            title="取消勾選所有個股"
                          >
                            <Circle className="w-3.5 h-3.5 text-zinc-400" />
                            取消全選
                          </InteractiveButton>
                        </div>
                      </div>
                    </div>

                  <div className="bg-transparent w-full">
                    <div className="overflow-hidden w-full">
                      <div className="pt-0 pb-4 sm:pt-0 sm:pb-6 min-h-[200px] w-full">
                        <AnimatePresence mode="wait">
                          {filteredSubTabVisibleTabs.length === 0 ? (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="h-full flex flex-col items-center justify-center text-white/30 py-16"
                            >
                              <div className="bg-white/5 p-5 border border-white/10 rounded-full mb-4">
                                <Activity className="h-10 w-10 opacity-40" />
                              </div>
                              <p className="text-base font-bold text-white/50 tracking-wide">
                                尚無可見的{activeHoldingSubTab === "觀察中" && activeViewTab === "active" ? "虛擬交易" : activeHoldingSubTab}股票
                              </p>
                            </motion.div>
                          ) : (
                            <>
                            <div
                              ref={carouselRef}
                              onScroll={handleCarouselScroll}
                              className="relative w-full overflow-x-auto scrollbar-hide cursor-grab select-none border-y border-zinc-200/5 bg-zinc-50/[0.02] rounded-2xl"
                              onMouseDown={onDragStart}
                              onTouchStart={onDragStart}
                              style={{ touchAction: "pan-y" }}
                            >
                              <div className="flex flex-nowrap items-stretch gap-6 px-4 md:px-8 py-4 w-max">
                                {renderGroups.map((group, groupIdx) => {
                                  const renderCard = (tab: any, idx: number) => {
                                    const getCardStatusInfo = (tabItem: any) => {
                                      const statusName = getDisplayHoldingStatus(tabItem.holdingStatus || tabItem.list);
                                      let color = "#38bdf8";
                                      if (statusName === "候選名單") color = "#fbbf24";
                                      else if (statusName === "買進操作") color = "#34d399";
                                      else if (statusName === "賣出操作") color = "#fb7185";
                                      else if (statusName === "平倉操作") color = "#e879f9";
                                      else if (statusName === "乖離名單") color = "#818cf8";
                                      return { text: statusName, color };
                                    };

                                    let plannedOrders =
                                    activeTabOrders[tab.id] || [];
                                    const getStrategyTargets = (tabId: string) => {
                                      const strat = activeTabStrategies[tabId] || {};
                                      const targets: {
                                        id: string;
                                        price: number | string;
                                        notes: string;
                                        direction?: string;
                                        categoryType: "止損設定" | "止盈設定" | "分批進出場規劃" | "支撐門檻" | "壓力門檻";
                                      }[] = [];

                                      // 1. tpTargets
                                      if (Array.isArray(strat.tpTargets)) {
                                        strat.tpTargets.forEach((tp: any, i: number) => {
                                          if (tp.price > 0) {
                                            targets.push({
                                              id: `tp-${i}`,
                                              price: tp.price,
                                              notes: tp.quantity ? `預定量: ${tp.quantity}股` : "止盈目標價",
                                              categoryType: "止盈設定"
                                            });
                                          }
                                        });
                                      }

                                      // 2. slTargets
                                      if (Array.isArray(strat.slTargets)) {
                                        strat.slTargets.forEach((sl: any, i: number) => {
                                          let priceVal = sl.price || 0;
                                          let n = "";
                                          if (sl.quantity) {
                                            n += `股數: ${sl.quantity}股`;
                                          }
                                          if (sl.percentage) {
                                            n += (n ? "，" : "") + `百分比: ${sl.percentage}%`;
                                          }
                                          if (priceVal > 0 || sl.percentage > 0) {
                                            targets.push({
                                              id: `sl-${i}`,
                                              price: priceVal || `止損 %: ${sl.percentage}%`,
                                              notes: n || "止損目標價",
                                              categoryType: "止損設定"
                                            });
                                          }
                                        });
                                      }

                                      // 3. entries
                                      if (Array.isArray(strat.entries)) {
                                        strat.entries.forEach((entry: any, i: number) => {
                                          if (entry.priceStr) {
                                            targets.push({
                                              id: `entry-${i}`,
                                              price: entry.priceStr,
                                              notes: `批次 ${i + 1} (${entry.quantityStr ? entry.quantityStr + "股" : ""}): ${entry.notes || ""}`.trim(),
                                              direction: entry.type,
                                              categoryType: "分批進出場規劃"
                                            });
                                          }
                                        });
                                      }

                                      // 4. resistanceZones
                                      if (Array.isArray(strat.resistanceZones)) {
                                        strat.resistanceZones.forEach((res: any, i: number) => {
                                          if (res.price > 0) {
                                            targets.push({
                                              id: `res-${i}`,
                                              price: res.price,
                                              notes: res.notes || "壓力門檻價",
                                              categoryType: "壓力門檻"
                                            });
                                          }
                                        });
                                      }

                                      // 5. supportZones
                                      if (Array.isArray(strat.supportZones)) {
                                        strat.supportZones.forEach((sup: any, i: number) => {
                                          if (sup.price > 0) {
                                            targets.push({
                                              id: `sup-${i}`,
                                              price: sup.price,
                                              notes: sup.notes || "支撐門檻價",
                                              categoryType: "支撐門檻"
                                            });
                                          }
                                        });
                                      }

                                      return targets;
                                    };

                                    const strategyTargets = getStrategyTargets(tab.id); plannedOrders = strategyTargets.map(t => ({ ...t, category: t.categoryType, direction: t.categoryType === "止損設定" || t.categoryType === "止盈設定" || t.categoryType === "壓力門檻" ? "SELL" : "BUY", isManualHighlight: !!strategyHighlights[`${tab.id}-${t.id}`] }));
                                    const groupedTargets = strategyTargets.reduce((acc: Record<string, any[]>, target) => {
                                      const displayCategory = `[${target.categoryType}]`;
                                      if (!acc[displayCategory]) {
                                        acc[displayCategory] = [];
                                      }
                                      acc[displayCategory].push(target);
                                      return acc;
                                    }, {});
                                  const trades = activeTabTrades[tab.id] || [];
                                  const stats = calculateStats(
                                    trades,
                                    tab.currentPrice,
                                  );
                                  const unrealizedPnL =
                                    stats.unrealizedPnL || 0;
                                  const pnlColor =
                                    unrealizedPnL > 0
                                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                      : unrealizedPnL < 0
                                        ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                                        : "text-white/60 bg-white/5 border-white/10";

                                  let isBuyOperation = false;
                                  let tpMax = 0;
                                  let batchMax = 0;
                                  let batchMin = Infinity;

                                  plannedOrders.forEach((order) => {
                                    const fullText =
                                      `${order.category || ""} ${order.notes || ""} ${order.conditions || ""}`.trim();
                                    const isTP = fullText.includes("止盈");
                                    const isBatch =
                                      fullText.includes("分批") ||
                                      fullText.includes("分批進出場規劃");

                                    if (isBatch && order.direction === "BUY") {
                                      isBuyOperation = true;
                                    }

                                    const p = order.price || 0;
                                    if (p > 0) {
                                      if (isTP) {
                                        if (p > tpMax) tpMax = p;
                                      }
                                      if (isBatch) {
                                        if (p > batchMax) batchMax = p;
                                        if (p < batchMin) batchMin = p;
                                      }
                                    }
                                  });

                                  let shouldHighlightTitle = false;
                                  const currentP = tab.currentPrice || 0;
                                  if (isBuyOperation && currentP > 0) {
                                    if (tpMax > 0 && currentP > tpMax * 1.1) {
                                      shouldHighlightTitle = true;
                                    } else if (
                                      batchMax > 0 &&
                                      currentP > batchMax * 1.1
                                    ) {
                                      shouldHighlightTitle = true;
                                    } else if (
                                      batchMin !== Infinity &&
                                      batchMin > 0 &&
                                      currentP < batchMin * 0.9
                                    ) {
                                      shouldHighlightTitle = true;
                                    }
                                  }

                                  const isCardExpanded = isCinemaModeActive ? true : (tab.groupId ? (expandedCards[tab.groupId] !== false) : (expandedCards[tab.id] !== false));

                                  return (
                                    <div
                                      key={tab.id}
                                      id={`stock-card-${tab.id}`}
                                      className={`card-wrapper w-[calc(100vw-32px)] sm:w-[410px] md:w-[410px] shrink-0 flex flex-col transition-all duration-300 ${isCardExpanded ? "min-h-[460px] h-[460px] select-none" : "min-h-[135px] h-[135px]"}`}
                                      style={{ touchAction: isCardExpanded ? "none" : "auto" }}
                                      onMouseDown={(e) => {
                                        if (e.button !== 0) return; // only left click
                                        cardDragTrackerRef.current = {
                                          startY: e.pageY,
                                          startX: e.pageX,
                                          cardId: tab.id,
                                          hasTriggeredFlip: false,
                                          startTime: Date.now(),
                                        };
                                      }}
                                      onTouchStart={(e) => {
                                        if (e.touches.length > 0) {
                                          cardDragTrackerRef.current = {
                                            startY: e.touches[0].pageY,
                                            startX: e.touches[0].pageX,
                                            cardId: tab.id,
                                            hasTriggeredFlip: false,
                                            startTime: Date.now(),
                                          };
                                        }
                                      }}
                                      onMouseMove={(e) => {
                                        const tracker = cardDragTrackerRef.current;
                                        if (tracker.cardId !== tab.id || tracker.hasTriggeredFlip) return;
                                        
                                        // Require holding down for about 0.5 seconds (~500ms) before vertical gesture triggers card flip
                                        const holdDuration = Date.now() - (tracker.startTime || 0);
                                        if (holdDuration < 500) return;

                                        const dy = tracker.startY - e.pageY; // dragging upward means final Y is smaller, so dy is positive
                                        const dx = Math.abs(tracker.startX - e.pageX);
                                        const absDy = Math.abs(dy);
                                        const currentShowBack = flippedCards[tab.id] !== false;
                                        
                                        if (absDy > 30 && absDy > dx && isCardExpanded) {
                                          tracker.hasTriggeredFlip = true;
                                          setFlippedCards((prev) => ({
                                            ...prev,
                                            [tab.id]: !currentShowBack,
                                          }));
                                          playClickSound();
                                        }
                                      }}
                                      onTouchMove={(e) => {
                                        const tracker = cardDragTrackerRef.current;
                                        if (tracker.cardId !== tab.id || tracker.hasTriggeredFlip) return;
                                        if (e.touches.length > 0) {
                                          // Require holding down for about 0.5 seconds (~500ms) before vertical gesture triggers card flip
                                          const holdDuration = Date.now() - (tracker.startTime || 0);
                                          if (holdDuration < 500) return;

                                          const dy = tracker.startY - e.touches[0].pageY;
                                          const dx = Math.abs(tracker.startX - e.touches[0].pageX);
                                          const absDy = Math.abs(dy);
                                          const currentShowBack = flippedCards[tab.id] !== false;
                                          
                                          if (absDy > 30 && absDy > dx && isCardExpanded) {
                                            tracker.hasTriggeredFlip = true;
                                            setFlippedCards((prev) => ({
                                              ...prev,
                                              [tab.id]: !currentShowBack,
                                            }));
                                            playClickSound();
                                          }
                                        }
                                      }}
                                      onMouseUp={() => {
                                        // keep cardId and hasTriggeredFlip intact for onClick to intercept
                                        cardDragTrackerRef.current.startY = 0;
                                        cardDragTrackerRef.current.startX = 0;
                                        cardDragTrackerRef.current.startTime = 0;
                                      }}
                                      onTouchEnd={() => {
                                        cardDragTrackerRef.current.startY = 0;
                                        cardDragTrackerRef.current.startX = 0;
                                        cardDragTrackerRef.current.startTime = 0;
                                      }}
                                      onClickCapture={(e) => {
                                        if (
                                          dragRef.current
                                            .hasDraggedBeyondThreshold
                                        ) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }
                                      }}
                                      onClick={(e) => {
                                        const tracker = cardDragTrackerRef.current;
                                        const wasFlippedThisGesture = tracker.cardId === tab.id && tracker.hasTriggeredFlip;
                                        
                                        // Reset tracker state for subsequent gestures
                                        tracker.cardId = null;
                                        tracker.hasTriggeredFlip = false;
                                        tracker.startTime = 0;

                                        if (wasFlippedThisGesture) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          return;
                                        }

                                        if (
                                          dragRef.current
                                            .hasDraggedBeyondThreshold
                                        ) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          return;
                                        }
                                        if (!isCardExpanded) {
                                          setExpandedCards((prev) => ({
                                            ...prev,
                                            [tab.groupId || tab.id]: true,
                                          }));
                                          return;
                                        }
                                        // If expanded, clicking the border does not flip anymore!
                                        // Flipping is handled exclusively by dragging upwards.
                                      }}
                                    >
                                      <div
                                        className={`card-inner-parallax w-full h-full flex flex-col transition-all duration-300 ${isCardExpanded ? "min-h-[460px] h-[460px]" : "min-h-[135px] h-[135px]"}`}
                                        style={{ perspective: "1200px" }}
                                      >
                                        <motion.div
                                          layout
                                          initial={{ opacity: 0, y: 20 }}
                                          animate={{
                                            opacity: 1,
                                            y: 0,
                                          }}
                                          transition={{
                                            duration: 0.6,
                                            type: "spring",
                                            stiffness: 260,
                                            damping: 20,
                                            delay: idx * 0.05,
                                          }}
                                          key={tab.id}
                                          className={`relative w-full h-full flex-1 flex flex-col cursor-pointer slide-drawer-container transition-all duration-300 ${isCardExpanded ? "min-h-[460px] h-[460px]" : "min-h-[135px] h-[135px]"} ${
                                            ((flippedCards[tab.id] !== false) && isCardExpanded) ? "show-back" : ""
                                          } ${activeTabStrategies[tab.id]?.observeChecked ? "card-breathe-observe" : activeTabStrategies[tab.id]?.closeChecked ? "card-breathe-close" : activeTabStrategies[tab.id]?.slChecked ? "card-breathe-sl" : activeTabStrategies[tab.id]?.addChecked ? "card-breathe-add" : activeTabStrategies[tab.id]?.tpChecked ? "card-breathe-tp" : ""}`}
                                        >
                                          {/* Corner label badges - stacked vertically (render on container level to avoid clip truncation) */}
                                          <div className="absolute -top-2.5 -left-2.5 z-40 flex flex-col gap-1 items-start">
                                            {(() => {
                                              const strat = activeTabStrategies[tab.id] || {};
                                              const badges: React.ReactNode[] = [];

                                              if (strat.observeChecked) {
                                                badges.push(
                                                  <div key="observe" className="flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#C9C9C9] text-black border border-[#C9C9C9]/50 shadow-[0_0_12px_rgba(201,201,201,0.6)] select-none font-bold">
                                                    觀察中
                                                  </div>
                                                );
                                              }
                                              if (strat.addChecked) {
                                                badges.push(
                                                  <div key="add" className="flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#426B4A] text-white border border-[#426B4A]/50 shadow-[0_0_12px_rgba(66,107,74,0.6)] select-none font-bold">
                                                    加碼中
                                                  </div>
                                                );
                                              }
                                              if (strat.slChecked) {
                                                badges.push(
                                                  <div key="sl" className="flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#E04141] text-white border border-[#E04141]/50 shadow-[0_0_12px_rgba(224,65,65,0.6)] select-none font-bold">
                                                    止損中
                                                  </div>
                                                );
                                              }
                                              if (strat.closeChecked) {
                                                badges.push(
                                                  <div key="close" className="flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#EBF527] text-black border border-[#EBF527]/50 shadow-[0_0_12px_rgba(235,245,39,0.6)] select-none font-bold">
                                                    平倉中
                                                  </div>
                                                );
                                              }
                                              if (strat.tpChecked) {
                                                badges.push(
                                                  <div key="tp" className="flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#35428C] text-white border border-[#35428C]/50 shadow-[0_0_12px_rgba(53,66,140,0.6)] select-none font-bold">
                                                    止盈中
                                                  </div>
                                                );
                                              }

                                              return badges;
                                            })()}
                                          </div>

                                          {/* Top Center Edge Badge: Stock's Unrealized PnL (未實現損益) */}
                                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex items-center justify-center">
                                            <div
                                              className={`flex items-center gap-1.5 text-[11px] font-black px-3 py-0.5 rounded-full border shadow-md whitespace-nowrap select-none font-mono ${
                                                unrealizedPnL > 0
                                                  ? "bg-emerald-600 text-white border-emerald-400/80 shadow-emerald-600/30"
                                                  : unrealizedPnL < 0
                                                    ? "bg-rose-600 text-white border-rose-400/80 shadow-rose-600/30"
                                                    : "bg-zinc-700 text-zinc-100 border-zinc-500/80 shadow-zinc-900/20"
                                              }`}
                                            >
                                              <span className="text-[10px] font-medium opacity-90">未實現:</span>
                                              <span className="tabular-nums">
                                                {unrealizedPnL > 0 ? "+" : ""}
                                                ${unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Inner sliding wrapper that handles overflow: hidden for transition faces */}
                                          <div className="slide-drawer-inner">
                                            {/* Front Face */}
                                          <div
                                            style={{
                                              pointerEvents: (flippedCards[tab.id] !== false)
                                                ? "none"
                                                : "auto",
                                            }}
                                            className={`card-front absolute inset-0 glass-card rounded-2xl flex flex-col group/item w-full h-full ${isCinemaModeActive ? "" : "transition-all duration-500"} overflow-hidden ${selectedCardIds.has(tab.id) ? "ring-2 ring-emerald-500 shadow-md ring-offset-1" : ""}`}
                                          >
                                            {/* Removed old redundant child elements since they are now declared on container level */}

                                            {/* 左側色條 */}
                                            {(() => {
                                              const strat = activeTabStrategies[tab.id] || {};
                                              let color = "";
                                              if (strat.observeChecked) color = "#C9C9C9";
                                              else if (strat.closeChecked) color = "#EBF527";
                                              else if (strat.slChecked) color = "#E04141";
                                              else if (strat.addChecked) color = "#426B4A";
                                              else if (strat.tpChecked) color = "#35428C";

                                              if (!color) return null;
                                              return (
                                                <div 
                                                  style={{ backgroundColor: color }}
                                                  className="absolute left-0 top-4 bottom-4 w-[3px] z-30 rounded-full"
                                                />
                                              );
                                            })()}

                                            {/* Independent Top Banner Row */}
                                            {(() => {
                                              const isBannerActive = tab.isDeviationConfirmed || tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle;
                                              const bannerBgColor = tab.isDeviationConfirmed
                                                ? "#F0D1B9"
                                                : tab.isOperationConfirmed
                                                  ? "#D1D5DB"
                                                  : tab.isFavoriteHighlight
                                                    ? "#DCE6C1"
                                                    : shouldHighlightTitle
                                                      ? "#FCDAD7"
                                                      : "transparent";

                                              const bannerTextColor = tab.isDeviationConfirmed
                                                ? "#823b0a"
                                                : tab.isOperationConfirmed
                                                  ? "#1f2937"
                                                  : tab.isFavoriteHighlight
                                                    ? "#3f4d21"
                                                    : shouldHighlightTitle
                                                      ? "#9c2c2c"
                                                      : "#71717a";

                                              const statusInfo = getCardStatusInfo(tab);
                                              const dotColor = isBannerActive ? bannerTextColor : statusInfo.color;

                                              return (
                                                <div
                                                  onTouchStart={(e) => e.stopPropagation()}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedActionTab(tab);
                                                    setActionActiveTab("general");
                                                    setIsActionDialogOpen(true);
                                                  }}
                                                  style={{ backgroundColor: bannerBgColor }}
                                                  className={`w-full h-[18px] flex items-center justify-between px-3 transition-colors duration-500 shrink-0 border-b ${isBannerActive ? "border-transparent" : "border-zinc-200/50"} select-none cursor-pointer`}
                                                >
                                                  {/* Status with dot */}
                                                  <div className="flex items-center gap-1.5 font-sans">
                                                    <span 
                                                      className="w-1.5 h-1.5 rounded-full inline-block transition-colors duration-500" 
                                                      style={{ backgroundColor: dotColor }}
                                                    />
                                                  </div>
                                                </div>
                                              );
                                            })()}

                                            {/* Main Card Content Body with padding */}
                                            <div
                                              onClick={(e) => {
                                                // Stop click event from bubbling so that clicking content inside the card does not trigger flipping!
                                                e.stopPropagation();
                                              }}
                                              className={`flex-1 flex flex-col p-3 pt-2 ${isCardExpanded ? "pb-16" : "pb-2"} w-full overflow-y-auto scrollbar-hide relative`}
                                            >
                                            {/* 左側色條 */}
                                            {(() => {
                                              const strat = activeTabStrategies[tab.id] || {};
                                              let color = "";
                                              if (strat.observeChecked) color = "#C9C9C9";
                                              else if (strat.closeChecked) color = "#EBF527";
                                              else if (strat.slChecked) color = "#E04141";
                                              else if (strat.addChecked) color = "#426B4A";
                                              else if (strat.tpChecked) color = "#35428C";

                                              if (!color) return null;
                                              return (
                                                <div 
                                                  style={{ backgroundColor: color }}
                                                  className="hidden"
                                                />
                                              );
                                            })()}

                                            {/* Symbol, Price, Scores Row */}
                                            <div
                                              className="flex items-center justify-between relative z-10 w-full overflow-hidden rounded-lg p-1.5 hover:bg-zinc-150/40 transition-colors duration-200 shrink-0 cursor-pointer"
                                              onTouchStart={(e) => e.stopPropagation()}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedActionTab(tab);
                                                setActionActiveTab("general");
                                                setIsActionDialogOpen(true);
                                              }}
                                              title={
                                                activeTabStrategies[tab.id]
                                                  ?.operationNote
                                                  ? `[執行操作備註]\n${activeTabStrategies[tab.id].operationNote}`
                                                  : undefined
                                              }
                                            >
                                              <div className="flex flex-col w-full min-w-0">
                                                {/* Top row: Checkbox, Symbol, Price, Unrealized Pill, SIM/LIVE, Toggle */}
                                                <div className="flex items-center justify-between w-full relative z-10 gap-2 mb-2">
                                                  {/* Left part: Circular Tickbox, Symbol & Price */}
                                                  <div className="flex items-center gap-2.5 min-w-0">
                                                    <label
                                                      className="flex items-center justify-center cursor-pointer select-none p-1 rounded-full hover:bg-zinc-200/80 transition-colors z-30 shrink-0"
                                                      onClick={(e) => e.stopPropagation()}
                                                      onTouchStart={(e) => e.stopPropagation()}
                                                      title={selectedCardIds.has(tab.id) ? "取消勾選此個股" : "勾選此個股 (用於一鍵同步)"}
                                                    >
                                                      <div
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleToggleCardSelected(tab.id);
                                                        }}
                                                        className={`w-4 h-4 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                                          selectedCardIds.has(tab.id)
                                                            ? "bg-emerald-600 border border-emerald-600 text-white shadow-xs scale-105"
                                                            : "border-2 border-zinc-400 hover:border-emerald-600 bg-white"
                                                        }`}
                                                      >
                                                        {selectedCardIds.has(tab.id) && (
                                                          <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />
                                                        )}
                                                      </div>
                                                    </label>
                                                    <div className="flex items-baseline gap-2 min-w-0">
                                                      <span 
                                                        className="font-black text-2xl tracking-tighter leading-none text-black shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                                        onTouchStart={(e) => e.stopPropagation()}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setSelectedActionTab(tab);
                                                          setActionActiveTab("general");
                                                          setIsActionDialogOpen(true);
                                                        }}
                                                      >
                                                        {tab.symbol}
                                                      </span>
                                                      {typeof tab.currentPrice === "number" && (
                                                        <div className="flex items-baseline gap-1.5 shrink-0">
                                                          <span className="text-xl font-black tabular-nums text-zinc-900 leading-none">
                                                            ${tab.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                          </span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>

                                                  {/* Right part: Unrealized PnL Pill, SIM/LIVE, Toggle */}
                                                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                                                    {/* Unrealized PnL Capsule (Pill) */}
                                                    {unrealizedPnL !== 0 && (
                                                      <div className="flex flex-col items-center justify-center border border-zinc-200/60 bg-zinc-50 rounded-xl px-2.5 py-0.5 leading-none h-[38px] select-none">
                                                        <span className="text-[9px] font-medium text-zinc-500 mb-0.5">
                                                          未實現:
                                                        </span>
                                                        <span className={`text-xs font-black tabular-nums ${unrealizedPnL > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                          {unrealizedPnL > 0 ? "+" : ""}{unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                      </div>
                                                    )}

                                                    {/* SIM / LIVE Badge */}
                                                    <div
                                                      className={`flex items-center gap-1.5 text-[9px] font-black px-2 py-1.5 rounded-full border uppercase tracking-widest h-7 ${
                                                        tab.tradeType === "simulated"
                                                          ? "bg-amber-50 text-amber-800 border-amber-200/80"
                                                          : "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                                                      }`}
                                                    >
                                                      {tab.tradeType === "simulated" ? (
                                                        <Gamepad2 className="h-3 w-3 text-amber-600" />
                                                      ) : (
                                                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                                                      )}
                                                      {tab.tradeType === "simulated" ? "SIM" : "LIVE"}
                                                    </div>

                                                    {/* Expand / Collapse Button */}
                                                    {!isCinemaModeActive && (
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setExpandedCards((prev) => ({
                                                            ...prev,
                                                            [tab.groupId || tab.id]: !isCardExpanded,
                                                          }));
                                                        }}
                                                        className="p-1 text-zinc-500 hover:text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-full transition-colors flex items-center justify-center shrink-0 w-7 h-7"
                                                        title={isCardExpanded ? "收合個股卡片" : "展開個股卡片"}
                                                      >
                                                        <ChevronDown
                                                          className={`w-4 h-4 transition-transform duration-300 ${
                                                            isCardExpanded ? "rotate-180" : ""
                                                          }`}
                                                        />
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>

                                                {/* Strategy target price percentage deviation */}
                                                {((activeHoldingSubTab === "觀察中" && activeViewTab === "active" && activeCardDefinitionFilter === "operation") || (activeViewTab === "real" && activeHoldingSubTab === "買進操作")) && unrealizedPnL !== 0 && (() => {
                                                  const isUp = unrealizedPnL > 0;
                                                  const txt = (isUp ? "+" : "") + unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                  const bg = isUp ? "bg-[#E1F5EE]" : "bg-[#FCEBEB]";
                                                  const fg = isUp ? "#085041" : "#791F1F";
                                                  const border = isUp ? "#1D9E75" : "#E24B4A";
                                                  return (
                                                    <div className="flex items-center gap-2 mb-1 flex-nowrap overflow-x-auto scrollbar-hide shrink-0 select-none">
                                                      <div
                                                        className={`inline-flex items-center gap-0.5 px-1.5 rounded-[5px] select-none shrink-0 h-5 border ${bg}`}
                                                        style={{ borderColor: border, color: fg }}
                                                      >
                                                        {isUp ? (
                                                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                            <line x1="7" y1="17" x2="17" y2="7" />
                                                            <polyline points="7 7 17 7 17 17" />
                                                          </svg>
                                                        ) : (
                                                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                            <line x1="7" y1="7" x2="17" y2="17" />
                                                            <polyline points="17 7 17 17 7 17" />
                                                          </svg>
                                                        )}
                                                        <span className="text-[9px] font-medium tabular-nums tracking-tight">
                                                          {txt}
                                                        </span>
                                                      </div>
                                                    </div>
                                                  );
                                                })()}
                                              </div>
                                              </div>

                                            {/* Expanded content */}
                                            {isCardExpanded && (
                                              <>
                                                {/* Active strategies and target prices */}
                                                {plannedOrders.length > 0 && (
                                                  <div className="mt-2 pt-2 border-t border-zinc-200/55 relative z-10">
                                                    <p className="text-[12px] font-bold text-zinc-550 text-zinc-500 mb-[6px] tracking-wide uppercase">
                                                      交易計畫與策略目標價 ({plannedOrders.length})
                                                    </p>
                                                    <div className="flex flex-col gap-1">
                                                      {Object.entries(plannedOrders.reduce((acc: any, order: any) => {
                                                        const text = `${order.notes || ""} ${order.conditions || ""}`.trim();
                                                        let category = order.category || "其他";
                                                        if (category === "其他" || !order.category || category === "關鍵價格門檻") {
                                                          if (text.includes("[支撐") || text.includes("支撐門檻")) category = "支撐門檻";
                                                          else if (text.includes("[壓力") || text.includes("壓力門檻")) category = "壓力門檻";
                                                          else if (text.includes("止損設定") || text.includes("[止損")) category = "止損設定";
                                                          else if (text.includes("止盈設定") || text.includes("[止盈")) category = "止盈設定";
                                                          else if (text.includes("分批進出場") || text.includes("[分批")) category = "分批進出場規劃";
                                                          else if (category === "分批") category = "分批進出場規劃";
                                                        }
                                                        const formattedCat = `[${category}]`;
                                                        if (!acc[formattedCat]) acc[formattedCat] = [];
                                                        acc[formattedCat].push(order);
                                                        return acc;
                                                      }, {})).sort(([catA], [catB]) => {
                                                        const orderList = ["[止損設定]", "[止盈設定]", "[分批進出場規劃]", "[支撐門檻]", "[壓力門檻]", "[其他]"];
                                                        const idxA = orderList.indexOf(catA);
                                                        const idxB = orderList.indexOf(catB);
                                                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                                        if (idxA !== -1) return -1;
                                                        if (idxB !== -1) return 1;
                                                        return catA.localeCompare(catB);
                                                      }).map(([catName, orders]: [string, any]) => {
                                                        const cleanCat = catName.replace(/[\[\]]/g, "");
                                                        return (
                                                          <div key={catName} className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5 px-1 mb-1 mt-1.5">
                                                              <div className={`h-1 w-1 rounded-full ${cleanCat === "止損設定" ? "bg-red-500" : cleanCat === "止盈設定" ? "bg-emerald-500" : cleanCat === "支撐門檻" || cleanCat === "壓力門檻" ? "bg-amber-500" : "bg-blue-500"}`} />
                                                              <span className={`text-[11px] font-bold tracking-widest uppercase leading-none ${cleanCat === "止損設定" ? "text-red-600" : cleanCat === "止盈設定" ? "text-emerald-600" : cleanCat === "支撐門檻" || cleanCat === "壓力門檻" ? "text-amber-600" : "text-zinc-500"}`}>
                                                                {catName}
                                                              </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                              {orders.sort((a: any, b: any) => (b.price || 0) - (a.price || 0)).map((order: any) => {
                                                                const isSL = cleanCat === "止損設定";
                                                                const isBarrier = cleanCat === "支撐門檻" || cleanCat === "壓力門檻";
                                                                const directionLabel = isBarrier ? (cleanCat === "支撐門檻" ? "支撐" : "壓力") : (order.direction === "BUY" ? "買入" : "賣出");
                                                                const isSpecial = directionLabel === "支撐" || directionLabel === "壓力";
                                                                const isHighlighted = (order.price && tab.currentPrice && Math.abs((tab.currentPrice - order.price) / order.price) <= 0.02) || order.isManualHighlight || !!manualHighlight[`${tab.id}-${order.id}`];
                                                                let styleClass = "";
                                                                let borderStyle = "border";
                                                                if (isHighlighted) {
                                                                  styleClass = "bg-amber-500 text-zinc-950 border-amber-600 shadow-sm font-semibold";
                                                                  borderStyle = "border";
                                                                } else if (isSL) {
                                                                  styleClass = "border-red-200 text-red-700 bg-red-50";
                                                                } else if (isBarrier) {
                                                                  styleClass = "bg-amber-50/50 border-amber-200 text-amber-800";
                                                                } else {
                                                                  styleClass = order.direction === "BUY" ? "bg-emerald-50/50 border-emerald-200 text-emerald-800 font-medium" : "bg-blue-50/50 border-blue-200 text-blue-800 font-medium";
                                                                }
                                                                return (
                                                                  <div
                                                                    key={order.id}
                                                                    title={order.notes || order.conditions || ""}
                                                                    className={`rounded-lg ${borderStyle} py-1 px-2.5 flex items-center gap-1.5 backdrop-blur-sm transition-all duration-300 cursor-pointer select-none ${styleClass}`}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onDoubleClick={(e) => {
                                                                      e.stopPropagation();
                                                                      if (order.id.startsWith("tp-") || order.id.startsWith("sl-") || order.id.startsWith("entry-") || order.id.startsWith("res-") || order.id.startsWith("sup-")) {
                                                                        setManualHighlight(prev => ({
                                                                          ...prev,
                                                                          [`${tab.id}-${order.id}`]: !prev[`${tab.id}-${order.id}`]
                                                                        }));
                                                                      } else {
                                                                        handleToggleOrderHighlight(tab.id, order.id, order.isManualHighlight);
                                                                      }
                                                                    }}
                                                                  >
                                                                    {isSpecial && (
                                                                      <span className={`text-[9px] tracking-wider font-extrabold px-1 py-0.5 rounded leading-none ${isHighlighted ? "bg-black/10 text-amber-950" : "bg-amber-100 text-amber-800"}`}>
                                                                        {directionLabel}
                                                                      </span>
                                                                    )}
                                                                    <span className={`text-xs leading-none ${isHighlighted ? "font-black" : "font-bold"}`}>
                                                                      {order.price ? `$${order.price.toLocaleString()}` : "市價"}
                                                                    </span>
                                                                  </div>
                                                                );
                                                              })}
                                                            </div>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Recent transaction history */}
                                                {trades.length > 0 && (
                                                  <div className="mt-2 pt-2 border-t border-white/10 relative z-10">
                                                    <div className="flex items-center justify-between mb-[4px]">
                                                      <p className="text-[12px] font-bold text-zinc-500 tracking-wide uppercase">
                                                        近期操作記錄 (${trades.length})
                                                      </p>
                                                      {stats.totalQuantity !== 0 && (
                                                        <div className="flex items-center gap-2 text-[10px] text-white/40">
                                                          <span>
                                                            平均成本{" "}
                                                            <span className="font-bold text-white/80">
                                                              $${stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                          </span>
                                                          <span>
                                                            持有數量{" "}
                                                            <span className="font-bold text-white/80">
                                                              {Math.abs(stats.totalQuantity)}股
                                                            </span>
                                                          </span>
                                                        </div>
                                                      )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                      {trades.slice(0, 3).map((hist: any) => (
                                                        <div
                                                          key={hist.id}
                                                          className={`text-[11px] rounded border px-[8px] py-[2px] flex items-center gap-[4px] backdrop-blur-md ${hist.type === "BUY" ? "bg-emerald-50 border-emerald-200/80 text-emerald-800" : "bg-blue-50 border-blue-200/80 text-blue-800"}`}
                                                        >
                                                          <span className="font-bold">{hist.type === "BUY" ? "買，" : "賣，"}</span>
                                                          <span className="font-medium">
                                                            {hist.price ? `$${hist.price}` : "市價"} / {hist.quantity}股
                                                          </span>
                                                          {hist.operator === "機器" && <span className="text-red-500 font-bold ml-0.5">(機器)</span>}
                                                          {hist.operator === "人" && <span className="text-zinc-500 font-bold ml-0.5">(人)</span>}
                                                        </div>
                                                      ))}
                                                      {trades.length > 3 && (
                                                        <div className="text-[11px] rounded border border-zinc-200 bg-zinc-100/50 px-[8px] py-[2px] flex items-center gap-[4px] text-zinc-500">
                                                          +{trades.length - 3} 更多
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Flip hint overlay */}
                                                {!isCinemaModeActive && (
                                                  <div
                                                    className="absolute bottom-0 left-0 right-0 h-[40px] z-20 pointer-events-none bg-gradient-to-t from-white/[0.03] to-transparent transition-colors"
                                                  >
                                                    <div className="absolute bottom-2 right-3 opacity-60 text-[10px] text-white flex items-center gap-1 font-bold">
                                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M7 13l5 5 5-5M7 11l5-5 5 5" />
                                                      </svg>
                                                      ↑↓ 按住約0.5秒後上下滑動
                                                    </div>
                                                  </div>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </div>

                                      {/* Card Back */}
                                      {isCardExpanded && (
                                        <div
                                          onClick={(e) => {
                                            // Stop click event from bubbling to card-wrapper's onClick, so clicking on the chart side doesn't accidentally flip it back to the front!
                                            e.stopPropagation();
                                          }}
                                          style={{ pointerEvents: (flippedCards[tab.id] !== false) ? "auto" : "none" }}
                                          className={`card-back absolute inset-0 glass-card bg-transparent rounded-2xl flex flex-col w-full h-full sm:hover:bg-white/[0.04] transition-all duration-500 overflow-hidden ${selectedCardIds.has(tab.id) ? "ring-2 ring-emerald-500 shadow-md ring-offset-1" : ""} ${
                                            (activeTabStrategies[tab.id])?.observeChecked ? "card-breathe-observe" : (activeTabStrategies[tab.id])?.closeChecked ? "card-breathe-close" : (activeTabStrategies[tab.id])?.slChecked ? "card-breathe-sl" : (activeTabStrategies[tab.id])?.addChecked ? "card-breathe-add" : (activeTabStrategies[tab.id])?.tpChecked ? "card-breathe-tp" : ""
                                          }`}
                                        >
                                          {(() => {
                                            const strat = activeTabStrategies[tab.id] || {};
                                            let indicatorColor = "";
                                            if (strat.observeChecked) indicatorColor = "#C9C9C9";
                                            else if (strat.closeChecked) indicatorColor = "#EBF527";
                                            else if (strat.slChecked) indicatorColor = "#E04141";
                                            else if (strat.addChecked) indicatorColor = "#426B4A";
                                            else if (strat.tpChecked) indicatorColor = "#35428C";
                                            return indicatorColor ? (
                                              <div style={{ backgroundColor: indicatorColor }} className="absolute left-0 top-4 bottom-4 w-[3px] z-30 rounded-full" />
                                            ) : null;
                                          })()}
                                          {(() => {
                                            const isSpecialHighlight = tab.isDeviationConfirmed || tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle;
                                            const bgCol = tab.isDeviationConfirmed ? "#F0D1B9" : tab.isOperationConfirmed ? "#A3A3A3" : tab.isFavoriteHighlight ? "#B1C28D" : shouldHighlightTitle ? "#F5DAD5" : "transparent";
                                            const labelCol = tab.isDeviationConfirmed || tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "#7a4a1e" : "rgba(255, 255, 255, 0.7)";
                                            const statusColor = getCardStatusInfo(tab).color;
                                            const textIndicatorColor = isSpecialHighlight ? labelCol : statusColor;
                                            return (
                                              <div
                                                style={{ backgroundColor: bgCol }}
                                                className={`w-full h-[18px] flex items-center justify-between px-3 transition-colors duration-500 shrink-0 border-b ${isSpecialHighlight ? "border-transparent" : "border-white/5"} select-none cursor-pointer hover:opacity-90 transition-opacity`}
                                                onTouchStart={(e) => e.stopPropagation()}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedActionTab(tab);
                                                  setActionActiveTab("status");
                                                  setIsActionDialogOpen(true);
                                                }}
                                              >
                                                <div className="flex items-center gap-1.5 font-sans">
                                                  <span className="w-1.5 h-1.5 rounded-full inline-block transition-colors duration-500" style={{ backgroundColor: textIndicatorColor }} />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  {tab.updatedAt && (
                                                    <span style={{ color: labelCol }} className="text-[9.5px] font-black tracking-wider opacity-80 transition-colors duration-500 font-bold">
                                                      {formatTimestamp(tab.updatedAt, "yyyy/MM/dd HH:mm")}
                                                    </span>
                                                  )}
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setFlippedCards(prev => ({ ...prev, [tab.id]: false }));
                                                    }}
                                                    style={{ color: labelCol, borderColor: isSpecialHighlight ? "rgba(122,74,30,0.2)" : "rgba(255,255,255,0.1)" }}
                                                    className="w-3.5 h-3.5 flex items-center justify-center rounded-full border bg-black/10 sm:hover:bg-black/20 text-[7px] font-black transition-all leading-none"
                                                    title="返回正面"
                                                  >
                                                    ✕
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })()}

                                          <div className="flex-1 flex flex-col p-2.5 pt-1.5 w-full min-h-0 relative overflow-hidden">
                                            <StockCardVisualizer
                                              plannedOrders={plannedOrders}
                                              currentPrice={tab.currentPrice}
                                              onOpenActionSettings={() => {
                                                setSelectedActionTab(tab);
                                                setActionActiveTab("status");
                                                setIsActionDialogOpen(true);
                                              }}
                                              onToggleHighlight={(orderId, isManual) => {
                                                if (orderId.startsWith("tp-") || orderId.startsWith("sl-") || orderId.startsWith("entry-") || orderId.startsWith("res-") || orderId.startsWith("sup-")) {
                                                  setManualHighlight(prev => ({
                                                    ...prev,
                                                    [`${tab.id}-${orderId}`]: !prev[`${tab.id}-${orderId}`]
                                                  }));
                                                } else {
                                                  handleToggleOrderHighlight(tab.id, orderId, isManual);
                                                }
                                              }}
                                              tabId={tab.id}
                                              annotations={tab.chartAnnotations || EMPTY_CHART_ANNOTATIONS}
                                              onUpdateAnnotations={(annots) => updateTab(tab.id, { chartAnnotations: annots })}
                                              averageCost={stats.totalQuantity !== 0 ? stats.averagePrice : undefined}
                                              averageCostQuantity={stats.totalQuantity !== 0 ? stats.totalQuantity : undefined}
                                              averagingRowsSys2={tab.averagingRowsSys2}
                                              holdingQuantity={tab.status !== "COMPLETED" ? stats.totalQuantity : 0}
                                              stockName={tab.symbol}
                                              rating={tab.rating}
                                              qualityScore={tab.qualityScore}
                                              valueScore={tab.valueScore}
                                              buyRate={tab.buyRate}
                                              sellRate={tab.sellRate}
                                              volatility={tab.volatility}
                                              crashSimilarity={tab.crashSimilarity}
                                              onRatingBarDoubleClick={(e) => {
                                                if (e.stopPropagation) e.stopPropagation();
                                                setVisualizerFocusTabId(tab.id);
                                                setVisualizerFocusText((activeTabStrategies[tab.id])?.operationFocus || "");
                                              }}
                                              strategy={activeTabStrategies[tab.id]}
                                              tradeDirection={tab.tradeDirection}
                                              onUpdateStrategyField={(field, val) => handleUpdateStrategyField(tab.id, field, val)}
                                              onUpdateTPChecked={(val) => handleUpdateTPChecked(tab.id, val)}
                                              onUpdateSLChecked={(val) => handleUpdateSLChecked(tab.id, val)}
                                              onUpdateAddChecked={(val) => handleUpdateAddChecked(tab.id, val)}
                                              onUpdateCloseChecked={(val) => handleUpdateCloseChecked(tab.id, val)}
                                              onUpdateObserveChecked={(val) => handleUpdateObserveChecked(tab.id, val)}
                                              onUpdateNotesHighlighted={(val) => handleUpdateNotesHighlighted(tab.id, val)}
                                              userId={user?.uid}
                                              holdingStatus={tab.holdingStatus}
                                              tradeType={tab.tradeType}
                                              isSelected={selectedCardIds.has(tab.id)}
                                              onToggleSelected={() => handleToggleCardSelected(tab.id)}
                                              onOpenMiniVisualLinesModal={(info) => setMiniVisualLinesStock(info)}
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {tab.isNew && (
                                        <div
                                          className="absolute top-0 right-0 z-[100] flex items-center justify-center select-none whitespace-nowrap pointer-events-none"
                                          style={{
                                            background: "linear-gradient(135deg, #ff6b35 0%, #e03030 100%)",
                                            color: "#ffffff",
                                            fontSize: "10px",
                                            fontWeight: "700",
                                            letterSpacing: "0.12em",
                                            padding: "5px 13px 5px 10px",
                                            borderRadius: "0 14px 0 12px",
                                            fontFamily: "var(--font-sans)",
                                          }}
                                        >
                                          NEW
                                        </div>
                                      )}
                                            </div>
                                          </motion.div>
                                        </div>
                                      </div>
                                    );
                                  };

                                  renderCardRef.current = renderCard;

                                  return group.isGroup ? (
                                    <div
                                      key={group.id}
                                      className="relative flex p-1.5 sm:p-2 bg-gradient-to-r from-white/[0.04] to-white/[0.01] rounded-[36px] shrink-0 gap-4 group/box transition-all"
                                      style={{ border: "0.8px solid #D9FF00", boxShadow: "none" }}
                                    >
                                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white/10 px-3 py-0.5 rounded-full text-[10px] font-bold text-white/50 opacity-0 group-hover/box:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">
                                        連動區塊
                                      </div>
                                      {group.tabs.map((tabItem: any, tabIdx: number) => renderCard(tabItem, tabIdx))}
                                    </div>
                                  ) : (
                                    renderCard(group.tabs[0], groupIdx)
                                  );
                                })}
                              </div>
                            </div>

                            {/* Sliding tab indicator navigation bar underneath stock cards */}
                            {orderedFilteredSubTabVisibleTabs.length > 0 && (
                              <div className="hidden sm:block mt-6 px-4 md:px-8 w-full">
                                <div className="flex justify-center w-full">
                                  <div className="relative max-w-4xl pb-2">
                                    <div className="flex flex-row items-center justify-center gap-6 overflow-x-auto scrollbar-hide relative pb-1.5">
                                      {orderedFilteredSubTabVisibleTabs.map((tab) => {
                                        const isSelected = (activeCardTabId || orderedFilteredSubTabVisibleTabs[0].id) === tab.id;
                                        return (
                                          <button
                                            key={tab.id}
                                            ref={(el) => {
                                              tabRefs.current[tab.id] = el;
                                            }}
                                            onClick={() => handleTabIndicatorClick(tab.id)}
                                            className="px-2 py-1 text-sm font-medium transition-colors duration-200 cursor-pointer outline-none shrink-0"
                                            style={{
                                              color: isSelected ? "#1a1a1a" : "#999999",
                                              fontWeight: isSelected ? 500 : 400,
                                            }}
                                          >
                                            {tab.symbol}
                                          </button>
                                        );
                                      })}
                                      <div
                                        className="absolute bottom-0 left-0 right-0"
                                        style={{ height: "1.5px", backgroundColor: "#e0e0e0" }}
                                      />
                                      <div
                                        className="absolute bottom-0"
                                        style={{
                                          height: "2px",
                                          backgroundColor: "#1a1a1a",
                                          borderRadius: "2px",
                                          left: `${indicatorStyle.left}px`,
                                          width: `${indicatorStyle.width}px`,
                                          transition: "left 0.3s cubic-bezier(0.16, 1, 0.3, 1), width 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                  </div>
                </ScrollIn>
              </div>
            </div>
          )}

        {activeViewTab === "completed" && (
          <div id="completed-cards-section" className="w-full space-y-4">
            <ScrollIn delay={0.1} translateY={15}>
              <div className="bg-white border border-zinc-200/90 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-sm flex flex-col transition-all duration-300">
                
                {/* Top Header & Search / Actions Bar */}
                <div className="px-4 sm:px-6 py-4 bg-zinc-50/80 border-b border-zinc-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
                    <h3 className="font-black text-lg sm:text-xl tracking-tight text-zinc-900">
                      已完成交易
                    </h3>
                    <span className="text-xs font-black border border-blue-200 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full shadow-2xs">
                      <AnimatedNumber value={completedTabs.length} /> 檔總紀錄
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 sm:w-64 min-w-[180px]">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        value={completedSearchQuery}
                        onChange={(e) => setCompletedSearchQuery(e.target.value)}
                        placeholder="搜尋代號或公司..."
                        className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-zinc-200 rounded-xl text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all font-medium"
                      />
                      {completedSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCompletedSearchQuery("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Json Import/Export */}
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      ref={completedJsonFileInputRef}
                      onChange={handleImportCompletedTabsJson}
                    />
                    <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-xl p-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={handleExportCompletedTabsJson}
                        disabled={isExportingCompleted}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-all text-xs font-bold leading-none select-none cursor-pointer disabled:opacity-50"
                        title="匯出 JSON 備份"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>匯出</span>
                      </button>
                      <div className="w-[1px] h-3 bg-zinc-200 shrink-0" />
                      <button
                        type="button"
                        onClick={() => completedJsonFileInputRef.current?.click()}
                        disabled={isImportingCompleted}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-all text-xs font-bold leading-none select-none cursor-pointer disabled:opacity-50"
                        title="匯入 JSON 備份"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>匯入</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-Tabs: Main Category & Result Filters */}
                <div className="px-4 sm:px-6 py-3 bg-white border-b border-zinc-200/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  
                  {/* Category Tabs: All | Real Trades | Simulated Trades */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100/80 p-1 rounded-2xl border border-zinc-200/60 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCompletedMainTab("all")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        completedMainTab === "all"
                          ? "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                          : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50"
                      }`}
                    >
                      <span>🌐 全部類別</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        completedMainTab === "all" ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600"
                      }`}>
                        {completedTabs.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCompletedMainTab("real")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        completedMainTab === "real"
                          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                          : "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>真實交易 (Real)</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        completedMainTab === "real" ? "bg-white/30 text-white" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {realCompletedTabs.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCompletedMainTab("simulated")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        completedMainTab === "simulated"
                          ? "bg-amber-600 text-white shadow-sm shadow-amber-600/20"
                          : "text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                      }`}
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      <span>模擬交易 (Simulated)</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        completedMainTab === "simulated" ? "bg-white/30 text-white" : "bg-amber-100 text-amber-800"
                      }`}>
                        {simulatedCompletedTabs.length}
                      </span>
                    </button>
                  </div>

                  {/* Sub-Filters: Result WIN / LOSE Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-zinc-400 mr-1 hidden sm:inline">損益分類:</span>
                    
                    <button
                      type="button"
                      onClick={() => setCompletedResultFilter("all")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer border ${
                        completedResultFilter === "all"
                          ? "bg-zinc-800 text-white border-zinc-800 shadow-2xs"
                          : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                      }`}
                    >
                      全部結果 ({baseCompletedTabs.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setCompletedResultFilter("win")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer border flex items-center gap-1 ${
                        completedResultFilter === "win"
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-2xs"
                          : "bg-emerald-50/80 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" />
                      <span>獲利 WIN</span>
                      <span className="text-[10px] opacity-90 font-mono">
                        ({baseCompletedTabs.filter((t) => (t.finalPnL || 0) >= 0).length})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCompletedResultFilter("lose")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer border flex items-center gap-1 ${
                        completedResultFilter === "lose"
                          ? "bg-rose-500 text-white border-rose-500 shadow-2xs"
                          : "bg-rose-50/80 text-rose-700 border-rose-200 hover:bg-rose-100"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-300 shrink-0" />
                      <span>虧損 LOSE</span>
                      <span className="text-[10px] opacity-90 font-mono">
                        ({baseCompletedTabs.filter((t) => (t.finalPnL || 0) < 0).length})
                      </span>
                    </button>
                  </div>
                </div>

                {/* Stats Summary Strip */}
                <div className="px-4 sm:px-6 py-2.5 bg-zinc-50/50 border-b border-zinc-200/60 flex flex-wrap items-center justify-between text-xs gap-3">
                  <div className="flex flex-wrap items-center gap-4 text-zinc-600 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-zinc-800">{displayCompletedTabs.length} 筆</span>
                    </span>
                    <div className="w-[1px] h-3 bg-zinc-300 shrink-0" />
                    <span className="flex items-center gap-1.5">
                      <span className="text-zinc-400">勝率:</span>
                      <span className="font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                        {displayWinRate}% ({displayWinCount}勝 / {displayLoseCount}敗)
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-medium">小計損益:</span>
                    <span className={`font-mono text-sm font-black px-2.5 py-0.5 rounded-lg border ${
                      displayCompletedPnL >= 0
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}>
                      {displayCompletedPnL >= 0 ? "+" : ""}${displayCompletedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                {/* Cards Grid - High Density Responsive Layout */}
                <div className="p-4 sm:p-5 flex flex-col min-h-[220px]">
                  <AnimatePresence mode="wait">
                    {displayCompletedTabs.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="h-full flex flex-col items-center justify-center text-zinc-500 flex-1 py-14"
                      >
                        <div className="bg-zinc-50 p-4 border border-zinc-200 rounded-full mb-3">
                          <TrendingUp className="h-8 w-8 text-zinc-400" />
                        </div>
                        <p className="text-sm font-black text-zinc-700 tracking-wide">
                          尚無符合條件的已完成交易紀錄
                        </p>
                        <p className="text-xs text-zinc-400 mt-1 text-center max-w-xs leading-relaxed">
                          請切換頂部分類 Tab (全部 / 真實 / 模擬) 或調整 WIN / LOSE 損益篩選條件。
                        </p>
                      </motion.div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-3">
                        {displayCompletedTabs.map((tab, idx) => {
                          const val = tab.finalPnL || 0;
                          const isProfit = val >= 0;
                          const isReal = tab.tradeType === "real";

                          return (
                            <motion.div
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                              whileHover={{ y: -2, scale: 1.01 }}
                              key={tab.id}
                              id={`stock-card-${tab.id}`}
                              onClick={() => navigate(`/stock/${tab.id}`)}
                              onMouseEnter={() => tab.symbol && prefetchStockPrice(tab.symbol)}
                              className="bg-white border border-zinc-200 hover:border-zinc-350 shadow-2xs hover:shadow-md p-3.5 rounded-xl cursor-pointer relative overflow-hidden group flex flex-col justify-between transition-all duration-200 gap-2.5"
                            >
                              {/* Top row: Symbol + Badges */}
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="min-w-0">
                                  <div className="font-mono font-black text-base sm:text-lg tracking-tight text-zinc-900 group-hover:text-blue-600 transition-colors truncate">
                                    {tab.symbol}
                                  </div>
                                  <div className="text-[11px] font-medium text-zinc-500 truncate max-w-[120px]">
                                    {tab.companyName || "已結算個股"}
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {/* Type badge */}
                                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                                    isReal
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}>
                                    {isReal ? "真實" : "模擬"}
                                  </span>
                                  
                                  {/* WIN/LOSE badge */}
                                  <span className={`text-[9px] font-mono font-black px-1.5 py-0.2 rounded ${
                                    isProfit
                                      ? "bg-emerald-500 text-white"
                                      : "bg-rose-500 text-white"
                                  }`}>
                                    {isProfit ? "WIN" : "LOSE"}
                                  </span>
                                </div>
                              </div>

                              {/* Bottom row: PnL Display */}
                              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-zinc-400">
                                  {isReal ? "實盤損益" : "預估損益"}
                                </span>
                                <div className={`px-2 py-0.5 rounded-lg font-mono text-xs font-black ${
                                  isProfit 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80" 
                                    : "bg-rose-50 text-rose-700 border border-rose-200/80"
                                }`}>
                                  {isProfit ? "+" : ""}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </ScrollIn>
                  </div>
                )}

        {activeViewTab === "notes" && (() => {
          return (
            <div id="notes-cards-section" className="space-y-6">
              {filledCategories.map((cat) => {
                    const filteredTabs = visibleActiveTabs.filter(
                      (t) => getDisplayHoldingStatus(t.holdingStatus) === cat
                    );
                    const isExpanded = notesExpandedCategories[cat] !== false;
                    const highlightedStocksInCat = filteredTabs.filter(
                      (t) => !!activeTabStrategies[t.id]?.notesHighlighted
                    );
                    const conf = holdingTabConfig[cat];

                    return (
                      <div
                        key={cat}
                        className={`bg-white border rounded-[1.5rem] shadow-sm transition-all duration-300 overflow-hidden ${
                          isExpanded ? "border-zinc-300 shadow-md ring-1 ring-zinc-100" : "border-zinc-200 hover:border-zinc-300 hover:shadow-md"
                        }`}
                      >
                        {/* Section Header */}
                        <div 
                          className={`px-5 py-4 flex items-center justify-between cursor-pointer select-none transition-all duration-300 ${
                            isExpanded ? `border-b border-zinc-200 ${conf.bgClass}/50` : "hover:bg-zinc-50/50"
                          }`}
                          onClick={() => toggleNotesCategory(cat)}
                        >
                          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-3 shrink-0">
                              {(() => {
                                const CatIcon = conf.icon;
                                return (
                                  <div className={`p-1.5 rounded-lg border ${conf.borderClass} ${conf.bgClass} flex items-center justify-center`}>
                                    <CatIcon className={`w-3.5 h-3.5 ${conf.colorClass}`} />
                                  </div>
                                );
                              })()}
                              <span className="text-base font-extrabold text-zinc-900 tracking-tight">
                                {cat}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${conf.activeCountClass}`}>
                                {filteredTabs.length} 檔
                              </span>
                            </div>
                            
                            {highlightedStocksInCat.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 ml-1.5 border-l border-zinc-200 pl-3">
                                {highlightedStocksInCat.map((tab) => {
                                  const strat = activeTabStrategies[tab.id] || {};
                                  const actions = [];
                                  if (strat.tpChecked) actions.push({ label: "止盈", color: "bg-emerald-50 text-emerald-700 border-emerald-200/80" });
                                  if (strat.slChecked) actions.push({ label: "止損", color: "bg-rose-50 text-rose-700 border-rose-200/80" });
                                  if (strat.addChecked) actions.push({ label: "加碼", color: "bg-sky-50 text-sky-700 border-sky-200/80" });
                                  if (strat.closeChecked) actions.push({ label: "平倉", color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/80" });
                                  if (strat.observeChecked) actions.push({ label: "觀察", color: "bg-zinc-100 text-zinc-700 border-zinc-300" });
                                  
                                  return (
                                    <div 
                                      key={tab.id}
                                      onClick={(e) => {
                                        // Prevent clicking the stock badge from collapsing/expanding the accordion
                                        e.stopPropagation();
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-50 border border-zinc-200 text-[10px] font-bold"
                                    >
                                      <span className="text-amber-805 whitespace-nowrap font-extrabold">{tab.symbol}</span>
                                      <span className="text-zinc-500 font-medium max-w-[60px] truncate hidden md:inline">({tab.companyName || "-"})</span>
                                      {actions.length > 0 && (
                                        <div className="flex items-center gap-0.5 ml-0.5">
                                          {actions.map((act, i) => (
                                            <span 
                                              key={i} 
                                              className={`text-[9px] px-0.5 py-0 rounded border ${act.color} font-black whitespace-nowrap`}
                                            >
                                              {act.label}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-center p-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-all shrink-0">
                            <ChevronDown 
                              className={`w-4 h-4 text-zinc-650 transition-transform duration-300 ${
                                isExpanded ? "rotate-180 text-amber-500" : ""
                              }`}
                            />
                          </div>
                        </div>

                        {/* Collapsible Content */}
                        {isExpanded && (
                          <div className="border-t border-zinc-200 animate-in slide-in-from-top-2 duration-300 bg-white">
                            {/* Mobile Card View */}
                            <div className="flex flex-col lg:hidden divide-y divide-zinc-200">
                              {filteredTabs.map((tab) => {
                                const isHighlighted = Boolean(activeTabStrategies[tab.id]?.notesHighlighted);
                                const trades = activeTabTrades[tab.id] || [];
                                const stats = calculateStats(trades, tab.currentPrice);
                                const unrealizedPnL = stats.unrealizedPnL || 0;
                                
                                return (
                                  <div 
                                    key={`mobile-note-${tab.id}`}
                                    className={`p-4 transition-colors duration-200 ${
                                      isHighlighted ? "bg-amber-500/[0.04]" : "hover:bg-zinc-50/50"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={isHighlighted}
                                          onChange={(e) => handleUpdateNotesHighlighted(tab.id, e.target.checked)}
                                          className="h-4.5 w-4.5 rounded border-zinc-300 text-amber-500 focus:ring-offset-0 focus:ring-amber-500 cursor-pointer accent-amber-500 transition-all"
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-base font-extrabold text-zinc-900 tracking-wider">
                                            {tab.symbol}
                                          </span>
                                          <span 
                                            onClick={() => {
                                              handleSearchSelect(tab.id);
                                              setFlippedCards((prev) => ({
                                                ...prev,
                                                [tab.id]: true,
                                              }));
                                            }}
                                            className="text-[11px] font-bold text-zinc-500 hover:text-amber-805 hover:underline truncate max-w-[160px] cursor-pointer transition-colors mt-0.5"
                                          >
                                            {tab.companyName || tab.symbol}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-right flex flex-col items-end">
                                        <span className="text-sm font-mono text-zinc-900 font-extrabold">
                                          {tab.currentPrice !== undefined && tab.currentPrice > 0 ? tab.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                        </span>
                                        <span className="text-[10px] text-zinc-400 mt-0.5 uppercase font-black tracking-wider">現價</span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 mb-4 bg-zinc-50/50 p-3.5 rounded-xl border border-zinc-150">
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase mb-1 tracking-wider">平均成本</span>
                                        <span className="text-xs font-mono text-zinc-800 font-bold">
                                          {Math.abs(stats.totalQuantity) > 0 && stats.averagePrice > 0 ? stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                        </span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase mb-1 tracking-wider">未實現損益</span>
                                        <span className="text-xs font-mono font-bold">
                                          {Math.abs(stats.totalQuantity) > 0 && unrealizedPnL !== 0 ? (
                                            <span className={unrealizedPnL > 0 ? "text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" : "text-rose-700 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100"}>
                                              {unrealizedPnL > 0 ? "+" : ""}{unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                          ) : (
                                            <span className="text-zinc-400">-</span>
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex flex-col text-right">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase mb-1 tracking-wider">持有股數</span>
                                        <span className="text-xs font-mono text-zinc-800 font-bold">
                                          {Math.abs(stats.totalQuantity) > 0 ? stats.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "-"}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-5 gap-2 mb-4 bg-zinc-50/20 p-2 border border-zinc-150 rounded-xl">
                                      <div className="flex flex-col items-center justify-center py-1.5">
                                        <span className="text-[10px] font-black text-zinc-500 mb-2">止盈</span>
                                        <input type="checkbox" checked={!!activeTabStrategies[tab.id]?.tpChecked} onChange={(e) => handleUpdateTPChecked(tab.id, e.target.checked)} className="h-4.5 w-4.5 rounded border-zinc-350 bg-white checked:bg-emerald-600 checked:border-emerald-600 text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-600 transition-all shadow-sm" />
                                      </div>
                                      <div className="flex flex-col items-center justify-center py-1.5">
                                        <span className="text-[10px] font-black text-zinc-500 mb-2">止損</span>
                                        <input type="checkbox" checked={!!activeTabStrategies[tab.id]?.slChecked} onChange={(e) => handleUpdateSLChecked(tab.id, e.target.checked)} className="h-4.5 w-4.5 rounded border-zinc-350 bg-white checked:bg-rose-600 checked:border-rose-600 text-rose-600 focus:ring-0 cursor-pointer accent-rose-600 transition-all shadow-sm" />
                                      </div>
                                      <div className="flex flex-col items-center justify-center py-1.5">
                                        <span className="text-[10px] font-black text-zinc-500 mb-2">加碼</span>
                                        <input type="checkbox" checked={!!activeTabStrategies[tab.id]?.addChecked} onChange={(e) => handleUpdateAddChecked(tab.id, e.target.checked)} className="h-4.5 w-4.5 rounded border-zinc-350 bg-white checked:bg-sky-600 checked:border-sky-600 text-sky-600 focus:ring-0 cursor-pointer accent-sky-600 transition-all shadow-sm" />
                                      </div>
                                      <div className="flex flex-col items-center justify-center py-1.5">
                                        <span className="text-[10px] font-black text-zinc-500 mb-2">平倉</span>
                                        <input type="checkbox" checked={!!activeTabStrategies[tab.id]?.closeChecked} onChange={(e) => handleUpdateCloseChecked(tab.id, e.target.checked)} className="h-4.5 w-4.5 rounded border-zinc-350 bg-white checked:bg-violet-600 checked:border-violet-600 text-violet-600 focus:ring-0 cursor-pointer accent-violet-600 transition-all shadow-sm" />
                                      </div>
                                      <div className="flex flex-col items-center justify-center py-1.5">
                                        <span className="text-[10px] font-black text-zinc-500 mb-2">觀察</span>
                                        <input id="observe-input-tab" type="checkbox" checked={!!activeTabStrategies[tab.id]?.observeChecked} onChange={(e) => handleUpdateObserveChecked(tab.id, e.target.checked)} className="h-4.5 w-4.5 rounded border-zinc-350 bg-white checked:bg-zinc-650 checked:border-zinc-650 text-zinc-650 focus:ring-0 cursor-pointer accent-zinc-650 transition-all shadow-sm" />
                                      </div>
                                    </div>

                                    <div>
                                      <span className="text-[10px] font-black text-zinc-500 mb-2 block tracking-wider">操作重點</span>
                                      <textarea
                                        value={activeTabStrategies[tab.id]?.operationFocus || ""}
                                        onChange={(e) => handleUpdateOperationFocus(tab.id, e.target.value)}
                                        placeholder="點擊輸入操作重點..."
                                        rows={4}
                                        className="w-full bg-white border border-zinc-250/80 focus:border-amber-500 focus:shadow-[0_0_12px_rgba(245,158,11,0.08)] text-zinc-800 text-xs rounded-xl p-3 focus:ring-0 outline-none resize-y transition-all min-h-[100px] font-medium leading-relaxed font-sans shadow-inner overflow-auto"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Desktop Table View */}
                            <div className="overflow-x-auto hidden lg:block pb-1">
                              <table className="w-full text-left border-collapse table-fixed">
                              <thead>
                                <tr className="border-b border-zinc-200 bg-zinc-50/50">
                                  <th className="w-[115px] py-2.5 px-4 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                                    選取 / 股票代號
                                  </th>
                                  <th className="w-[125px] py-2.5 px-3 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                                    股票名稱
                                  </th>
                                  <th className="w-[85px] py-2.5 px-3 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-right">
                                    現價
                                  </th>
                                  <th className="w-[85px] py-2.5 px-3 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-right">
                                    平均成本
                                  </th>
                                  <th className="w-[100px] py-2.5 px-3 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-right">
                                    未實現損益
                                  </th>
                                  <th className="w-[85px] py-2.5 px-3 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-right">
                                    持有股數
                                  </th>
                                  <th className="w-[54px] py-2.5 px-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-center">
                                    止盈
                                  </th>
                                  <th className="w-[54px] py-2.5 px-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-center">
                                    止損
                                  </th>
                                  <th className="w-[54px] py-2.5 px-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-center">
                                    加碼
                                  </th>
                                  <th className="w-[54px] py-2.5 px-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-center">
                                    平倉
                                  </th>
                                  <th className="w-[54px] py-2.5 px-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-center">
                                    觀察
                                  </th>
                                  <th className="py-2.5 px-4 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                                    操作重點
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-200">
                                {filteredTabs.map((tab) => {
                                  const isHighlighted = !!activeTabStrategies[tab.id]?.notesHighlighted;
                                  const trades = activeTabTrades[tab.id] || [];
                                  const stats = calculateStats(trades, tab.currentPrice);
                                  const unrealizedPnL = stats.unrealizedPnL || 0;
                                  
                                  return (
                                    <tr
                                      key={tab.id}
                                      id={`notes-row-${tab.id}`}
                                      className={`transition-colors duration-200 ${
                                        isHighlighted
                                          ? "bg-amber-500/10 hover:bg-amber-500/15"
                                          : "hover:bg-zinc-50"
                                      }`}
                                    >
                                      <td className="py-2.5 px-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={isHighlighted}
                                            onChange={(e) => handleUpdateNotesHighlighted(tab.id, e.target.checked)}
                                            className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-amber-500 checked:border-amber-500 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500 transition-all"
                                          />
                                          <span className="text-xs font-bold text-zinc-800 tracking-wide">
                                            {tab.symbol}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span 
                                          onClick={() => {
                                            handleSearchSelect(tab.id);
                                            setFlippedCards((prev) => ({
                                              ...prev,
                                              [tab.id]: true,
                                            }));
                                          }}
                                          className="text-xs font-semibold text-zinc-650 hover:text-amber-700 block truncate cursor-pointer transition-colors duration-200 hover:underline" 
                                          title="點擊前往持有中該股卡片並翻面數據圖示化"
                                        >
                                          {tab.companyName || tab.symbol}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-xs text-zinc-800 font-bold">
                                        {tab.currentPrice !== undefined && tab.currentPrice > 0 ? tab.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-xs text-zinc-800">
                                        {Math.abs(stats.totalQuantity) > 0 && stats.averagePrice > 0 ? stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-xs">
                                        {Math.abs(stats.totalQuantity) > 0 && unrealizedPnL !== 0 ? (
                                          <span className={`${unrealizedPnL > 0 ? "text-emerald-700 font-extrabold" : "text-rose-700 font-extrabold"}`}>
                                            {unrealizedPnL > 0 ? "+" : ""}{unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </span>
                                        ) : (
                                          <span className="text-zinc-400">-</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-xs text-zinc-800">
                                        {Math.abs(stats.totalQuantity) > 0 ? stats.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "-"}
                                      </td>
                                      <td className="py-2.5 px-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.tpChecked}
                                          onChange={(e) => handleUpdateTPChecked(tab.id, e.target.checked)}
                                          className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-emerald-500 checked:border-emerald-500 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500 transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-2.5 px-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.slChecked}
                                          onChange={(e) => handleUpdateSLChecked(tab.id, e.target.checked)}
                                          className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-rose-500 checked:border-rose-500 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500 transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-2.5 px-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.addChecked}
                                          onChange={(e) => handleUpdateAddChecked(tab.id, e.target.checked)}
                                          className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-sky-500 checked:border-sky-500 text-sky-500 focus:ring-0 cursor-pointer accent-sky-500 transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-2.5 px-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.closeChecked}
                                          onChange={(e) => handleUpdateCloseChecked(tab.id, e.target.checked)}
                                          className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-violet-500 checked:border-violet-500 text-violet-500 focus:ring-0 cursor-pointer accent-violet-500 transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-2.5 px-2 text-center">
                                        <input
                                          id="observe-input-row"
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.observeChecked}
                                          onChange={(e) => handleUpdateObserveChecked(tab.id, e.target.checked)}
                                          className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-[#929292] checked:border-[#929292] text-[#929292] focus:ring-0 cursor-pointer accent-[#929292] transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-2 px-4">
                                        <textarea
                                          value={activeTabStrategies[tab.id]?.operationFocus || ""}
                                          onChange={(e) => handleUpdateOperationFocus(tab.id, e.target.value)}
                                          placeholder="點擊輸入操作重點..."
                                          rows={4}
                                          className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:border-amber-500/50 text-zinc-800 text-xs rounded-lg p-2 focus:ring-1 focus:ring-amber-500/50 outline-none resize-y transition-colors min-h-[90px] font-medium overflow-auto"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

      {/* Operation Focus and Flip Dialog */}
      <Dialog
        open={!!visualizerFocusTabId}
        onOpenChange={(open) => {
          if (!open) setVisualizerFocusTabId(null);
        }}
      >
        <DialogContent className="border-zinc-300 shadow-2xl bg-white text-zinc-900 w-[92vw] max-w-[420px] max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-3xl border">
          <DialogHeader className="mb-4">
            <DialogTitle className="font-extrabold text-xl text-zinc-900 flex items-center justify-center gap-2">
              <span className="text-xl">📊</span>
              {(() => {
                const t = tabs.find((x) => x.id === visualizerFocusTabId);
                return t ? `${t.symbol} 操作設定` : "個股操作設定";
              })()}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-indigo-650 tracking-wider flex items-center gap-1.5 font-sans">
                <span>📝 編輯個股操作重點</span>
              </label>
              <textarea
                value={visualizerFocusText}
                onChange={(e) => setVisualizerFocusText(e.target.value)}
                placeholder="在此編輯您的操作策略或關鍵觀察..."
                className="w-full h-36 bg-zinc-50 border border-zinc-200 focus:border-indigo-500 text-zinc-850 placeholder-zinc-450 text-sm rounded-xl p-3 focus:ring-1 focus:ring-indigo-500/30 outline-none resize-none transition-all font-semibold font-sans text-zinc-800"
              />
            </div>
            {visualizerFocusTabId && (
              <div className="grid grid-cols-6 gap-2">
                <div className="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => handleUpdateNotesHighlighted(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.notesHighlighted)}>
                  <span className="text-[10px] font-black text-zinc-600 mb-2 pointer-events-none">選取</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.notesHighlighted} onChange={(e) => handleUpdateNotesHighlighted(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-indigo-600 checked:border-indigo-600 text-indigo-600 focus:ring-0 cursor-pointer accent-indigo-600 transition-all" />
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => handleUpdateTPChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.tpChecked)}>
                  <span className="text-[10px] font-black text-zinc-600 mb-2 pointer-events-none">止盈</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.tpChecked} onChange={(e) => handleUpdateTPChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border-zinc-300 bg-white checked:bg-emerald-600 checked:border-emerald-600 text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-600 transition-all font-black" />
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => handleUpdateSLChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.slChecked)}>
                  <span className="text-[10px] font-black text-zinc-600 mb-2 pointer-events-none">止損</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.slChecked} onChange={(e) => handleUpdateSLChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border-zinc-300 bg-white checked:bg-rose-500 checked:border-rose-500 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500 transition-all font-black" />
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => handleUpdateAddChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.addChecked)}>
                  <span className="text-[10px] font-black text-zinc-600 mb-2 pointer-events-none">加碼</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.addChecked} onChange={(e) => handleUpdateAddChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-sky-500 checked:border-sky-500 text-sky-500 focus:ring-0 cursor-pointer accent-sky-500 transition-all font-black" />
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => handleUpdateCloseChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.closeChecked)}>
                  <span className="text-[10px] font-black text-zinc-600 mb-2 pointer-events-none">平倉</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.closeChecked} onChange={(e) => handleUpdateCloseChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-violet-500 checked:border-violet-500 text-violet-500 focus:ring-0 cursor-pointer accent-violet-500 transition-all font-black" />
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => handleUpdateObserveChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.observeChecked)}>
                  <span className="text-[10px] font-black text-zinc-600 mb-2 pointer-events-none">觀察</span>
                  <input id="observe-input-focus" type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.observeChecked} onChange={(e) => handleUpdateObserveChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-zinc-500 checked:border-zinc-500 text-zinc-500 focus:ring-0 cursor-pointer accent-zinc-500 transition-all font-black" />
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={async () => {
                if (visualizerFocusTabId) {
                  await handleUpdateOperationFocus(visualizerFocusTabId, visualizerFocusText);
                  toast.success("操作重點已儲存 🚀");
                }
                setVisualizerFocusTabId(null);
              }}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
            >
              <span>儲存操作重點</span>
            </button>

            <button
              onClick={async () => {
                if (visualizerFocusTabId) {
                  await handleUpdateOperationFocus(visualizerFocusTabId, visualizerFocusText);
                  
                  // Go to the specific stock notes section in notes view
                  setActiveViewTab("notes");
                  
                  const currentTab = tabs.find((t) => t.id === visualizerFocusTabId);
                  if (currentTab) {
                    const cat = getDisplayHoldingStatus(currentTab.holdingStatus);
                    setNotesExpandedCategories((prev) => ({
                      ...prev,
                      [cat]: true,
                    }));
                  }
                  
                  const tabIdToScroll = visualizerFocusTabId;
                  setTimeout(() => {
                    const rowElement = document.getElementById(`notes-row-${tabIdToScroll}`);
                    if (rowElement) {
                      rowElement.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                      
                      rowElement.style.transition = "all 0.5s ease-in-out";
                      const originalBg = rowElement.style.backgroundColor;
                      rowElement.style.backgroundColor = "rgba(245, 158, 11, 0.25)";
                      setTimeout(() => {
                        rowElement.style.backgroundColor = originalBg;
                      }, 1500);
                    }
                  }, 300);

                  toast.success("已儲存筆記並前往該操作重點 🚀");
                }
                setVisualizerFocusTabId(null);
              }}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(79,70,229,0.2)]"
            >
              <span>前往該操作重點</span>
            </button>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => {
                  if (visualizerFocusTabId) {
                    setFlippedCards((prev) => ({
                      ...prev,
                      [visualizerFocusTabId]: false,
                    }));
                  }
                  setVisualizerFocusTabId(null);
                }}
                className="py-2.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-850 border border-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>僅翻回前面</span>
              </button>
              
              <button
                onClick={() => setVisualizerFocusTabId(null)}
                className="py-2.5 px-3 bg-zinc-50 hover:bg-rose-50 text-zinc-500 hover:text-rose-600 border border-zinc-200 hover:border-rose-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>取消</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload HTML Dialog */}
      <Dialog open={isUploadHtmlOpen} onOpenChange={setIsUploadHtmlOpen}>
        <DialogContent className="border border-white/10 bg-[#0F0F12]/95 backdrop-blur-2xl text-white max-w-md w-[92vw] max-h-[90vh] overflow-y-auto !rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
              <Upload className="w-5 h-5 text-red-500" />
              <span>
                上傳 {
                  htmlContext === "market_filter" ? "大盤濾網" :
                  htmlContext === "stock_micro" ? "個股微觀" :
                  htmlContext === "fed" ? "FED" :
                  htmlContext === "plus_70" ? "+70" :
                  "個股分析"
                } HTML 文件
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4 text-sm">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 font-sans uppercase">
                {htmlContext === "market_filter" ? "類別 (大盤濾網)" :
                 htmlContext === "stock_micro" ? "類別 (個股微觀)" :
                 htmlContext === "fed" ? "類別 (FED)" :
                 htmlContext === "plus_70" ? "類別 (+70)" :
                 "個股代號/名稱"}
              </label>
              <input
                type="text"
                value={htmlUploadSymbol}
                onChange={(e) => {
                  if (htmlContext === "dynamic") {
                    setHtmlUploadSymbol(e.target.value.toUpperCase());
                  }
                }}
                disabled={htmlContext !== "dynamic"}
                placeholder="例如: META"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-red-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 font-sans uppercase">日期與年份</label>
              <input
                type="date"
                value={htmlUploadDate}
                onChange={(e) => setHtmlUploadDate(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-red-500 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 font-sans uppercase">產生的檔案名稱預覽</label>
              <div className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-zinc-300 font-mono text-xs flex flex-col gap-1.5 break-all">
                {!htmlUploadSymbol.trim() ? (
                  <span>(請先輸入個股代號)</span>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-zinc-500 font-sans">檔案一預覽：</span>
                      <span className="text-zinc-300">
                        {htmlUploadSymbol.trim().toUpperCase()}_{htmlUploadDate.replace(/-/g, "")}
                        {htmlFileContent2 ? "_1" : ""}.html
                      </span>
                    </div>
                    {htmlFileContent2 && (
                      <div className="flex flex-col gap-1 border-t border-white/5 pt-1.5">
                        <span className="text-[10px] text-zinc-500 font-sans">檔案二預覽：</span>
                        <span className="text-zinc-300">
                          {htmlUploadSymbol.trim().toUpperCase()}_{htmlUploadDate.replace(/-/g, "")}_2.html
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 font-sans uppercase">第一份 HTML 檔案</label>
              <div className="relative border border-dashed border-white/20 hover:border-white/40 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 transition-all bg-white/[0.02]">
                <input
                  type="file"
                  accept=".html,.htm"
                  onChange={(e) => handleHtmlFileChange(e, 1)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileText className="w-6 h-6 text-zinc-500" />
                <span className="text-xs text-zinc-400 text-center font-medium">
                  {htmlFileToUpload ? htmlFileToUpload.name : "拖曳或點擊選擇 .html 檔案"}
                </span>
                {htmlFileToUpload && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    大小: {(htmlFileToUpload.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 font-sans uppercase">第二份 HTML 檔案（選填）</label>
              <div className="relative border border-dashed border-white/20 hover:border-white/40 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 transition-all bg-white/[0.02]">
                <input
                  type="file"
                  accept=".html,.htm"
                  onChange={(e) => handleHtmlFileChange(e, 2)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileText className="w-6 h-6 text-zinc-500" />
                <span className="text-xs text-zinc-400 text-center font-medium">
                  {htmlFileToUpload2 ? htmlFileToUpload2.name : "拖曳或點擊選擇 .html 檔案"}
                </span>
                {htmlFileToUpload2 && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    大小: {(htmlFileToUpload2.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setIsUploadHtmlOpen(false)}
              className="py-2 px-4 bg-zinc-800 hover:bg-zinc-750 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border border-white/5"
            >
              取消
            </button>
            <button
              disabled={isUploadingHtml}
              onClick={handleUploadHtmlSubmit}
              className="py-2 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isUploadingHtml ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>上傳中...</span>
                </>
              ) : (
                <span>開始上傳</span>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview HTML Dialog */}
      <Dialog open={isPreviewHtmlOpen} onOpenChange={(open) => {
        setIsPreviewHtmlOpen(open);
        if (!open) {
          setSelectedPreviewFileId(null);
        }
      }}>
        <DialogContent
          showCloseButton={selectedPreviewFileId ? false : true}
          className={`border-none transition-all duration-300 flex flex-col overflow-hidden ${
            selectedPreviewFileId
              ? "!p-0 !gap-0 w-[75vw] sm:w-[75vw] md:w-[75vw] max-w-[75vw] sm:max-w-none h-[98vh] max-h-[98vh] !rounded-2xl shadow-2xl bg-white"
              : "w-[95vw] max-w-md p-6 bg-[#0F0F12]/95 backdrop-blur-2xl text-white border border-white/10"
          }`}
        >
          {!selectedPreviewFileId && (
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-zinc-400" />
                  <span>
                    選擇 {
                      htmlContext === "market_filter" ? "大盤濾網" :
                      htmlContext === "stock_micro" ? "個股微觀" :
                      htmlContext === "fed" ? "FED" :
                      htmlContext === "plus_70" ? "+70" :
                      "個股分析"
                    } HTML 檔案進行預覽
                  </span>
                </span>
              </DialogTitle>
            </DialogHeader>
          )}

          {selectedPreviewFileId ? (
            /* Selected File Sandbox Iframe Preview - Maximized spacing & zero borders */
            <div className="flex-1 w-full h-full bg-white relative">
              <iframe
                src={`/api/html-files/${selectedPreviewFileId}/content`}
                className="w-full h-full border-0 bg-white"
                title="HTML Preview"
                sandbox="allow-same-origin allow-scripts allow-popups"
                onLoad={(e) => {
                  try {
                    const iframe = e.currentTarget;
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc) {
                      // Handle Escape key inside the iframe
                      iframeDoc.addEventListener("keydown", (event) => {
                        if (event.key === "Escape") {
                          setIsPreviewHtmlOpen(false);
                          setSelectedPreviewFileId(null);
                        }
                      });

                      // Inject CSS to hide scrollbars completely inside the iframe
                      const style = iframeDoc.createElement("style");
                      style.textContent = `
                        ::-webkit-scrollbar {
                          display: none !important;
                          width: 0 !important;
                          height: 0 !important;
                        }
                        html, body {
                          scrollbar-width: none !important;
                          -ms-overflow-style: none !important;
                        }
                      `;
                      iframeDoc.head.appendChild(style);
                    }
                  } catch (err) {
                    console.warn("Iframe keydown/style injection hook skipped:", err);
                  }
                }}
              />
            </div>
          ) : (
            /* Files List */
            <div className="flex flex-col gap-3 py-4 text-sm max-h-[50vh] overflow-y-auto scrollbar-hide">
              {htmlFilesList.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs font-medium">
                  目前尚未上傳任何 HTML 檔案
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {htmlFilesList.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all"
                    >
                      <div
                        onClick={() => {
                          setSelectedPreviewFileId(file.id);
                          playClickSound();
                        }}
                        className="flex-1 flex flex-col gap-0.5 cursor-pointer"
                      >
                        <span className="font-mono text-sm text-zinc-200 hover:text-white font-bold transition-all break-all">
                          {file.filename}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                          <span>
                            類別: {
                              file.symbol === "MARKET_FILTER" ? "大盤濾網" :
                              file.symbol === "STOCK_MICRO" ? "個股微觀" :
                              file.symbol === "FED" ? "FED" :
                              file.symbol === "+70" ? "+70" :
                              `個股 (${file.symbol})`
                            }
                          </span>
                          <span>•</span>
                          <span>上傳日: {new Date(file.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                      {deletingFileId === file.id ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleDeleteHtmlFile(file.id)}
                            className="px-2 py-1 text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-md border border-red-500/20 transition-all cursor-pointer"
                          >
                            確認
                          </button>
                          <button
                            onClick={() => setDeletingFileId(null)}
                            className="px-2 py-1 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingFileId(file.id)}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                          title="刪除檔案"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!selectedPreviewFileId && (
            <DialogFooter className="mt-2">
              <button
                onClick={() => setIsPreviewHtmlOpen(false)}
                className="py-2 px-4 bg-zinc-800 hover:bg-zinc-750 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border border-white/5 w-full sm:w-auto"
              >
                關閉
              </button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {isCinemaModeActive && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-[#0a0a0a] flex flex-col p-6 text-white select-none overflow-hidden"
          >
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between border-b border-white/5 pb-4 opacity-90">
              <div className="flex items-center gap-2">
                <span className="text-[#e5484d] text-base leading-none animate-pulse">●</span>
                <span className="text-[13px] font-semibold tracking-wider text-zinc-400 font-sans">
                  電影觀賞專注模式 · {isMobile ? "FOCUS" : "CINEMA FOCUS"}
                </span>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                {isMobile && (
                  <button
                    onClick={() => {
                      setIsMobileCinemaSidebarOpen(true);
                      playClickSound();
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[11.5px] font-bold text-zinc-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#e5484d]" />
                    <span>選擇個股</span>
                  </button>
                )}
                <span className="hidden sm:inline text-xs text-zinc-500 font-sans">
                  ESC / X 鍵退出電影模式
                </span>
                <button
                  onClick={() => {
                    setIsCinemaModeActive(false);
                    if (document.fullscreenElement) {
                      document.exitFullscreen().catch(() => {});
                    }
                  }}
                  className="w-8 h-8 rounded-full border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Split Screen Container: Left Sidebar & Right Main View */}
            <div className="flex-1 w-full flex flex-col lg:flex-row min-h-0 relative mt-4 overflow-hidden gap-8">
              {/* Left Sidebar containing Category Tabs & CinemaDock (aligned start for compact layout) */}
              <div className="hidden lg:flex w-full lg:w-64 shrink-0 flex-col gap-4 lg:border-r lg:border-white/5 lg:pr-6 justify-start items-start py-2 overflow-y-auto scrollbar-hide">
                {/* HTML Document Management Consolidated Panel (Tabbed Compact Layout) */}
                <div className="w-full flex flex-col gap-1.5 p-1.5 bg-white/5 border border-white/[0.04] rounded-xl">
                  {/* Tab bar header */}
                  <div className="grid grid-cols-5 gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/[0.03]">
                    <button
                      onClick={() => {
                        setHtmlContext("dynamic");
                        playClickSound();
                      }}
                      className={`py-1 text-center text-[10px] font-bold rounded transition-all cursor-pointer ${
                        htmlContext === "dynamic"
                          ? "bg-zinc-800 text-white border border-white/[0.05]"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-0.5">
                        <span>個股</span>
                        {activeCinemaSymbol && (
                          <span className="text-[7px] font-bold px-1 rounded bg-red-500/20 text-red-400 font-mono scale-[0.85] origin-center">
                            {activeCinemaSymbol}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setHtmlContext("market_filter");
                        playClickSound();
                      }}
                      className={`py-1 text-center text-[10px] font-bold rounded transition-all cursor-pointer ${
                        htmlContext === "market_filter"
                          ? "bg-zinc-800 text-white border border-white/[0.05]"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      大盤
                    </button>
                    <button
                      onClick={() => {
                        setHtmlContext("stock_micro");
                        playClickSound();
                      }}
                      className={`py-1 text-center text-[10px] font-bold rounded transition-all cursor-pointer ${
                        htmlContext === "stock_micro"
                          ? "bg-zinc-800 text-white border border-white/[0.05]"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      微觀
                    </button>
                    <button
                      onClick={() => {
                        setHtmlContext("fed");
                        playClickSound();
                      }}
                      className={`py-1 text-center text-[10px] font-bold rounded transition-all cursor-pointer ${
                        htmlContext === "fed"
                          ? "bg-zinc-800 text-white border border-white/[0.05]"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      FED
                    </button>
                    <button
                      onClick={() => {
                        setHtmlContext("plus_70");
                        playClickSound();
                      }}
                      className={`py-1 text-center text-[10px] font-bold rounded transition-all cursor-pointer ${
                        htmlContext === "plus_70"
                          ? "bg-zinc-800 text-white border border-white/[0.05]"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      +70
                    </button>
                  </div>

                  {/* Active context controls */}
                  <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                    <button
                      onClick={() => {
                        if (htmlContext === "dynamic") {
                          const activeTab = orderedFilteredSubTabVisibleTabs.find(t => t.id === activeCinemaCardId);
                          if (activeTab) {
                            setHtmlUploadSymbol(activeTab.symbol);
                          } else {
                            setHtmlUploadSymbol("");
                          }
                        } else if (htmlContext === "market_filter") {
                          setHtmlUploadSymbol("MARKET_FILTER");
                        } else if (htmlContext === "stock_micro") {
                          setHtmlUploadSymbol("STOCK_MICRO");
                        } else if (htmlContext === "fed") {
                          setHtmlUploadSymbol("FED");
                        } else if (htmlContext === "plus_70") {
                          setHtmlUploadSymbol("+70");
                        }
                        setHtmlFileToUpload(null);
                        setHtmlFileContent("");
                        setHtmlFileToUpload2(null);
                        setHtmlFileContent2("");
                        setIsUploadHtmlOpen(true);
                        playClickSound();
                      }}
                      className="flex items-center justify-center gap-1.5 py-1 px-1.5 text-[10px] font-semibold rounded-md bg-red-600/90 hover:bg-red-600 text-white transition-all cursor-pointer border border-red-500/10 shadow-sm"
                    >
                      <Upload className="w-2.5 h-2.5" />
                      <span>上傳</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsPreviewHtmlOpen(true);
                        if (htmlContext === "dynamic") {
                          const activeTab = orderedFilteredSubTabVisibleTabs.find(t => t.id === activeCinemaCardId);
                          fetchUploadedHtmlFiles(activeTab?.symbol);
                        } else if (htmlContext === "market_filter") {
                          fetchUploadedHtmlFiles("MARKET_FILTER");
                        } else if (htmlContext === "stock_micro") {
                          fetchUploadedHtmlFiles("STOCK_MICRO");
                        } else if (htmlContext === "fed") {
                          fetchUploadedHtmlFiles("FED");
                        } else if (htmlContext === "plus_70") {
                          fetchUploadedHtmlFiles("+70");
                        }
                        playClickSound();
                      }}
                      className="flex items-center justify-center gap-1.5 py-1 px-1.5 text-[10px] font-semibold rounded-md bg-zinc-800 hover:bg-zinc-750 text-zinc-200 hover:text-white transition-all cursor-pointer border border-white/5"
                    >
                      <Eye className="w-2.5 h-2.5" />
                      <span>預覽</span>
                    </button>
                  </div>
                </div>

                {/* Classification Category Section */}
                <div className="w-full flex flex-col gap-3">
                  <div className="text-[10px] font-bold tracking-widest text-zinc-500 font-sans uppercase">
                    分類選單 CATEGORY
                  </div>

                  {/* Primary Tabs */}
                  <div className="flex bg-[#161616] p-1 rounded-full border border-white/5 shadow-inner w-full">
                    <button
                      onClick={() => {
                        setActiveViewTab("active");
                        playClickSound();
                      }}
                      className={`flex-1 py-1 text-[11px] font-semibold rounded-full transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer ${
                        activeViewTab === "active"
                          ? "bg-[#e5484d] text-white shadow-md font-bold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Activity className="w-3 h-3" />
                      <span>持有中</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveViewTab("real");
                        playClickSound();
                      }}
                      className={`flex-1 py-1 text-[11px] font-semibold rounded-full transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer ${
                        activeViewTab === "real"
                          ? "bg-[#e5484d] text-white shadow-md font-bold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      <span>真實交易</span>
                    </button>
                  </div>

                  {/* Sub Tabs */}
                  <div className="flex flex-col gap-1 w-full">
                    {visibleSubTabs.map((tab) => {
                      const isActive = activeHoldingSubTab === tab;
                      const tabCount = effectiveVisibleActiveTabs.filter(
                        (t) => getDisplayHoldingStatus(t.holdingStatus) === tab
                      ).length;
                      return (
                        <button
                          key={`cinema-sub-${tab}`}
                          onClick={() => {
                            setActiveHoldingSubTab(tab as any);
                            playClickSound();
                          }}
                          className={`w-full px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all flex items-center justify-between border cursor-pointer ${
                            isActive
                              ? "bg-white/10 text-white border-white/10 shadow-sm font-semibold"
                              : "text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-white/5"
                          }`}
                        >
                          <span>{tab === "觀察中" && activeViewTab === "active" ? "虛擬交易" : tab}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                            isActive ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-500"
                          }`}>
                            {tabCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Aesthetic Divider */}
                <div className="w-full h-px bg-white/5" />

                {/* Stock List Dock Section */}
                <div className="w-full flex flex-col gap-3 min-h-[220px] overflow-hidden">
                  <div className="text-[10px] font-bold tracking-widest text-zinc-500 font-sans uppercase pl-4">
                    個股導覽 STOCKS
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-hide w-full max-h-[45vh]">
                    {orderedFilteredSubTabVisibleTabs.length > 0 ? (
                      <CinemaDock
                        tabs={orderedFilteredSubTabVisibleTabs}
                        activeId={activeCinemaCardId}
                        onSelect={(id) => setActiveCinemaCardId(id)}
                      />
                    ) : (
                      <div className="py-4 px-4 text-xs text-[#6b6b6b] font-sans tracking-wide">
                        此分類目前無股票卡片
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right/Center Main Focus Area */}
              <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
                <div className="flex-1 w-full flex items-center justify-center relative my-2">
                  {/* Left Arrow */}
                  {orderedFilteredSubTabVisibleTabs.length > 1 && (
                    <button
                      onClick={() => {
                        const currentIndex = orderedFilteredSubTabVisibleTabs.findIndex(t => t.id === activeCinemaCardId);
                        if (currentIndex > 0) {
                          setActiveCinemaCardId(orderedFilteredSubTabVisibleTabs[currentIndex - 1].id);
                          playSwipeSound();
                        } else {
                          setActiveCinemaCardId(orderedFilteredSubTabVisibleTabs[orderedFilteredSubTabVisibleTabs.length - 1].id);
                          playSwipeSound();
                        }
                      }}
                      className="absolute left-2 lg:left-4 z-50 w-12 h-12 rounded-full border border-white/10 bg-[#161616]/80 hover:bg-[#222222]/90 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm shadow-xl hover:scale-110 active:scale-95"
                      title="上一張"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}

                  {/* Scaled/Zoomed Card Container */}
                  <div className="flex items-center justify-center w-full h-full max-h-[82vh] overflow-visible">
                    {orderedFilteredSubTabVisibleTabs.map((tab, idx) => {
                      const isSelected = tab.id === activeCinemaCardId;
                      if (!isSelected) return null;
                      const cinemaScale = isMobile ? 0.96 : (typeof window !== "undefined" && window.innerWidth < 1024 ? 1.25 : 1.45);
                      return (
                        <motion.div
                          key={`cinema-${tab.id}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: cinemaScale }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.35, type: "spring", stiffness: 220, damping: 24 }}
                          className="origin-center shadow-[0_30px_80px_rgba(0,0,0,0.85)] rounded-2xl"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {renderCardRef.current && renderCardRef.current(tab, idx)}
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Right Arrow */}
                  {orderedFilteredSubTabVisibleTabs.length > 1 && (
                    <button
                      onClick={() => {
                        const currentIndex = orderedFilteredSubTabVisibleTabs.findIndex(t => t.id === activeCinemaCardId);
                        if (currentIndex < orderedFilteredSubTabVisibleTabs.length - 1) {
                          setActiveCinemaCardId(orderedFilteredSubTabVisibleTabs[currentIndex + 1].id);
                          playSwipeSound();
                        } else {
                          setActiveCinemaCardId(orderedFilteredSubTabVisibleTabs[0].id);
                          playSwipeSound();
                        }
                      }}
                      className="absolute right-2 lg:right-4 z-50 w-12 h-12 rounded-full border border-white/10 bg-[#161616]/80 hover:bg-[#222222]/90 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm shadow-xl hover:scale-110 active:scale-95"
                      title="下一張"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  )}
                </div>

                {/* Bottom Pagination Info */}
                <div className="w-full flex flex-col items-center gap-1.5 pb-2">
                  {/* Sleek page dots */}
                  {orderedFilteredSubTabVisibleTabs.length > 1 && (
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      {orderedFilteredSubTabVisibleTabs.map((tab) => {
                        const isActive = tab.id === activeCinemaCardId;
                        return (
                          <span
                            key={`dot-${tab.id}`}
                            onClick={() => {
                              setActiveCinemaCardId(tab.id);
                              playSwipeSound();
                            }}
                            className={`h-[6px] transition-all duration-300 cursor-pointer ${
                              isActive ? "w-4 bg-[#e5484d] rounded-sm" : "w-[6px] bg-[#3a3a3a] hover:bg-[#555555] rounded-full"
                            }`}
                          />
                        );
                      })}
                    </div>
                  )}

                  {orderedFilteredSubTabVisibleTabs.length > 0 && (
                    <div className="text-xs font-mono text-zinc-600 font-medium -mt-1">
                      第 {orderedFilteredSubTabVisibleTabs.findIndex(t => t.id === activeCinemaCardId) + 1} / {orderedFilteredSubTabVisibleTabs.length} 檔:{" "}
                      <span className="text-zinc-400 font-bold">{orderedFilteredSubTabVisibleTabs.find(t => t.id === activeCinemaCardId)?.symbol}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Drawer Slide-up Sheet */}
            <AnimatePresence>
              {isMobileCinemaSidebarOpen && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMobileCinemaSidebarOpen(false)}
                    className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm sm:hidden"
                  />
                  {/* Drawer */}
                  <motion.div
                    initial={{ translateY: "100%" }}
                    animate={{ translateY: 0 }}
                    exit={{ translateY: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed bottom-0 left-0 right-0 z-[100001] bg-[#121212] border-t border-white/10 rounded-t-3xl max-h-[85vh] flex flex-col p-5 text-white select-none sm:hidden"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-300">選擇股票與分類</span>
                      </div>
                      <button
                        onClick={() => setIsMobileCinemaSidebarOpen(false)}
                        className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Content Area with scroll */}
                    <div className="flex-1 overflow-y-auto space-y-5 pb-8 scrollbar-hide">
                      {/* 1. HTML Consolidated Panel */}
                      <div className="w-full flex flex-col gap-1.5 p-2 bg-white/5 border border-white/[0.04] rounded-xl">
                        <div className="grid grid-cols-5 gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/[0.03]">
                          <button
                            onClick={() => {
                              setHtmlContext("dynamic");
                              playClickSound();
                            }}
                            className={`py-1.5 text-center text-[10px] font-bold rounded transition-all cursor-pointer ${
                              htmlContext === "dynamic"
                                ? "bg-zinc-800 text-white border border-white/[0.05]"
                                : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            <span>個股</span>
                            {activeCinemaSymbol && (
                              <span className="ml-0.5 text-[7px] font-bold px-1 rounded bg-red-500/20 text-red-400 font-mono">
                                {activeCinemaSymbol}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setHtmlContext("market_filter");
                              playClickSound();
                            }}
                            className={`py-1.5 text-center text-[10px] font-bold rounded transition-all cursor-pointer ${
                              htmlContext === "market_filter"
                                ? "bg-zinc-800 text-white border border-white/[0.05]"
                                : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            大盤
                          </button>
                          <button
                            onClick={() => {
                              setHtmlContext("stock_micro");
                              playClickSound();
                            }}
                            className={`py-1.5 text-center text-[10px] font-bold rounded transition-all cursor-pointer ${
                              htmlContext === "stock_micro"
                                ? "bg-zinc-800 text-white border border-white/[0.05]"
                                : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            微觀
                          </button>
                          <button
                            onClick={() => {
                              setHtmlContext("fed");
                              playClickSound();
                            }}
                            className={`py-1.5 text-center text-[10px] font-bold rounded transition-all cursor-pointer ${
                              htmlContext === "fed"
                                ? "bg-zinc-800 text-white border border-white/[0.05]"
                                : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            FED
                          </button>
                          <button
                            onClick={() => {
                              setHtmlContext("plus_70");
                              playClickSound();
                            }}
                            className={`py-1.5 text-center text-[10px] font-bold rounded transition-all cursor-pointer ${
                              htmlContext === "plus_70"
                                ? "bg-zinc-800 text-white border border-white/[0.05]"
                                : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            +70
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          <button
                            onClick={() => {
                              if (htmlContext === "dynamic") {
                                const activeTab = orderedFilteredSubTabVisibleTabs.find(t => t.id === activeCinemaCardId);
                                if (activeTab) {
                                  setHtmlUploadSymbol(activeTab.symbol);
                                } else {
                                  setHtmlUploadSymbol("");
                                }
                              } else {
                                setHtmlUploadSymbol(htmlContext.toUpperCase());
                              }
                              setHtmlFileToUpload(null);
                              setHtmlFileContent("");
                              setHtmlFileToUpload2(null);
                              setHtmlFileContent2("");
                              setIsUploadHtmlOpen(true);
                              playClickSound();
                            }}
                            className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-[10px] font-semibold rounded-md bg-red-600 hover:bg-red-500 text-white transition-all cursor-pointer"
                          >
                            <Upload className="w-3 h-3" />
                            <span>上傳</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsPreviewHtmlOpen(true);
                              if (htmlContext === "dynamic") {
                                const activeTab = orderedFilteredSubTabVisibleTabs.find(t => t.id === activeCinemaCardId);
                                fetchUploadedHtmlFiles(activeTab?.symbol);
                              } else {
                                fetchUploadedHtmlFiles(htmlContext.toUpperCase());
                              }
                              playClickSound();
                            }}
                            className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-[10px] font-semibold rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all cursor-pointer border border-white/5"
                          >
                            <Eye className="w-3 h-3" />
                            <span>預覽</span>
                          </button>
                        </div>
                      </div>

                      {/* 2. Primary & Sub Categories */}
                      <div className="space-y-2.5">
                        <div className="text-[10px] font-bold tracking-widest text-zinc-500 font-sans uppercase">
                          分類選單 CATEGORY
                        </div>
                        <div className="flex bg-[#161616] p-1 rounded-full border border-white/5 shadow-inner w-full">
                          <button
                            onClick={() => {
                              setActiveViewTab("active");
                              playClickSound();
                            }}
                            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-full transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer ${
                              activeViewTab === "active"
                                ? "bg-[#e5484d] text-white shadow-md font-bold"
                                : "text-zinc-400"
                            }`}
                          >
                            <Activity className="w-3 h-3" />
                            <span>持有中</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveViewTab("real");
                              playClickSound();
                            }}
                            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-full transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer ${
                              activeViewTab === "real"
                                ? "bg-[#e5484d] text-white shadow-md font-bold"
                                : "text-zinc-400"
                            }`}
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>真實交易</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          {visibleSubTabs.map((tab) => {
                            const isActive = activeHoldingSubTab === tab;
                            const tabCount = effectiveVisibleActiveTabs.filter(
                              (t) => getDisplayHoldingStatus(t.holdingStatus) === tab
                            ).length;
                            return (
                              <button
                                key={`cinema-drawer-sub-${tab}`}
                                onClick={() => {
                                  setActiveHoldingSubTab(tab as any);
                                  playClickSound();
                                }}
                                className={`px-3 py-2 text-[11px] font-medium rounded-lg transition-all flex items-center justify-between border cursor-pointer ${
                                  isActive
                                    ? "bg-white/10 text-white border-white/15 font-semibold"
                                    : "text-zinc-400 border-transparent bg-white/5"
                                }`}
                              >
                                <span>{tab === "觀察中" && activeViewTab === "active" ? "虛擬交易" : tab}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                                  {tabCount}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Stock List Dock */}
                      <div className="space-y-2.5">
                        <div className="text-[10px] font-bold tracking-widest text-zinc-500 font-sans uppercase">
                          個股導覽 STOCKS
                        </div>
                        <div className="bg-[#161616] rounded-xl p-2 max-h-[30vh] overflow-y-auto scrollbar-hide">
                          {orderedFilteredSubTabVisibleTabs.length > 0 ? (
                            <CinemaDock
                              tabs={orderedFilteredSubTabVisibleTabs}
                              activeId={activeCinemaCardId}
                              onSelect={(id) => {
                                setActiveCinemaCardId(id);
                                setIsMobileCinemaSidebarOpen(false);
                                playClickSound();
                              }}
                            />
                          ) : (
                            <div className="py-4 text-center text-xs text-[#6b6b6b] font-sans">
                              此分類目前無股票卡片
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Dynamic Visual Lines Board Modal */}
      <DynamicVisualLinesModal
        isOpen={isVisualLinesBoardOpen}
        onClose={() => {
          setIsVisualLinesBoardOpen(false);
          try {
            if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch((err) => {
                console.warn("Fullscreen request rejected:", err);
              });
            }
          } catch (e) {
            console.warn("Fullscreen trigger error:", e);
          }
        }}
        allTabs={tabs}
        selectedCardIds={selectedCardIds}
        userId={user?.uid}
        initialTradeType={activeViewTab === "real" ? "real" : activeViewTab === "active" ? "active" : "all"}
        strategiesMap={activeTabStrategies}
        statsMap={activeTabStatsMap}
        onSelectStock={(tabId, symbol) => {
          setIsVisualLinesBoardOpen(false);
          try {
            if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch((err) => {
                console.warn("Fullscreen request rejected:", err);
              });
            }
          } catch (e) {
            console.warn("Fullscreen trigger error:", e);
          }
          const cleanSym = symbol ? symbol.trim().toUpperCase() : "";
          // 優先尋找未結算 (持有中或真實交易) 的股票分頁
          let targetTab = tabs.find((t) => t.id === tabId);
          if (!targetTab || targetTab.status === "COMPLETED") {
            const activeMatch = tabs.find(
              (t) => t.symbol.trim().toUpperCase() === cleanSym && t.status !== "COMPLETED"
            );
            if (activeMatch) {
              targetTab = activeMatch;
            }
          }

          if (targetTab) {
            // 嚴格跳轉至「持有中」或「真實交易」主分頁，絕不跳轉至「已完成」分頁
            if (targetTab.tradeType === "real") {
              setActiveViewTab("real");
            } else {
              setActiveViewTab("active");
            }
            setActiveHoldingSubTab(getDisplayHoldingStatus(targetTab.holdingStatus));
            setActiveCardTabId(targetTab.id);
          } else {
            setActiveViewTab("active");
            setActiveCardTabId(tabId);
          }
          setActiveCardDefinitionFilter("all");

          const effectiveTabId = targetTab ? targetTab.id : tabId;
          let attempts = 0;
          const attemptScroll = () => {
            const el = document.getElementById(`stock-card-${effectiveTabId}`) || document.getElementById(`notes-row-${effectiveTabId}`);
            if (el) {
              scrollToElement(el, -120);
              el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
              el.classList.add("ring-4", "ring-amber-400", "ring-offset-2", "scale-[1.03]", "transition-all", "duration-300");
              setTimeout(() => {
                el.classList.remove("ring-4", "ring-amber-400", "ring-offset-2", "scale-[1.03]");
              }, 2500);
            } else if (attempts < 25) {
              attempts++;
              setTimeout(attemptScroll, 80);
            }
          };
          setTimeout(attemptScroll, 120);
        }}
      />

      {/* Mini Visual Lines Tag Position Standalone Modal */}
      {miniVisualLinesStock && (
        <MiniVisualLinesModal
          isOpen={!!miniVisualLinesStock}
          onClose={() => setMiniVisualLinesStock(null)}
          stockName={miniVisualLinesStock.stockName}
          currentPrice={miniVisualLinesStock.currentPrice}
          holdingStatus={miniVisualLinesStock.holdingStatus}
          tradeType={miniVisualLinesStock.tradeType}
          userId={user?.uid}
        />
      )}

      {isAiAnalysisOpen && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-[#0a0a0a] flex flex-col p-4 sm:p-6 text-white select-none overflow-hidden"
          >
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between border-b border-white/5 pb-4 opacity-90">
              <div className="flex items-center gap-2">
                <span className="text-[#e5484d] text-base leading-none animate-pulse">●</span>
                <span className="text-[13px] font-semibold tracking-wider text-zinc-400 font-sans">
                  AI 搜尋分析與 Airtap 回傳 · AI FOCUS ANALYTICS
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-zinc-500 font-sans">
                  ESC 鍵可退出 AI 分析模式
                </span>
                <button
                  onClick={() => setIsAiAnalysisOpen(false)}
                  className="w-8 h-8 rounded-full border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="flex lg:hidden bg-zinc-950 p-0.5 rounded-lg border border-white/5 gap-0.5 mt-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAiMobileActiveTab("controls");
                  playClickSound();
                }}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded transition-all cursor-pointer text-center ${
                  aiMobileActiveTab === "controls"
                    ? "bg-[#e5484d] text-white border border-[#e5484d]/10"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                指令與設定 Settings & Prompt
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiMobileActiveTab("preview");
                  playClickSound();
                }}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded transition-all cursor-pointer text-center relative ${
                  aiMobileActiveTab === "preview"
                    ? "bg-[#e5484d] text-white border border-[#e5484d]/10"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                網頁預覽 Web Preview
                {aiHtmlFiles.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#e5484d] text-white text-[8px] px-1.5 rounded-full font-bold">
                    {aiHtmlFiles.length}
                  </span>
                )}
              </button>
            </div>

            {/* Main Section */}
            <div className="flex-1 w-full flex flex-col lg:flex-row min-h-0 relative mt-4 overflow-hidden gap-6">
              {/* Left Column (Dropdowns, Prompt Text Box, Execute button) */}
              <div className={`w-full lg:w-[420px] shrink-0 flex-col gap-4 lg:border-r lg:border-white/5 lg:pr-6 justify-start py-2 overflow-y-auto scrollbar-hide ${aiMobileActiveTab === "controls" ? "flex" : "hidden lg:flex"}`}>
                
                {isPromptManagerOpen ? (
                  <div className="flex flex-col gap-4 animate-fadeIn">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 tracking-wider">
                        <Settings className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                        <span>管理指令模版 PROMPT MANAGE</span>
                      </div>
                      <button
                        onClick={() => {
                          setIsPromptManagerOpen(false);
                          setEditingPromptId(null);
                          setNewPromptName("");
                          setNewPromptTemplate("");
                          setNewPromptNote("");
                          setEditingPromptNote("");
                          playClickSound();
                        }}
                        className="text-[10px] text-zinc-400 hover:text-white bg-white/5 px-2.5 py-1 rounded transition-all border border-white/5 cursor-pointer"
                      >
                        返回分析
                      </button>
                    </div>

                    {/* Editor list */}
                    <div className="flex flex-col gap-3">
                      {/* Active Edit Area if editing */}
                      {editingPromptId ? (
                        <div className="p-3 bg-white/5 rounded-lg border border-amber-500/20 flex flex-col gap-2.5">
                          <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                            <Edit3 className="w-3 h-3 text-amber-400" />
                            <span>正在編輯指令</span>
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-zinc-400 font-bold">模版名稱</label>
                            <input
                              type="text"
                              value={editingPromptName}
                              onChange={(e) => setEditingPromptName(e.target.value)}
                              className="w-full bg-[#161616] border border-white/10 text-white rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-500"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-zinc-400 font-bold">模版備註 (選填)</label>
                            <input
                              type="text"
                              placeholder="輸入模版備註 (選填)"
                              value={editingPromptNote}
                              onChange={(e) => setEditingPromptNote(e.target.value)}
                              className="w-full bg-[#161616] border border-white/10 text-white rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-red-500"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-zinc-400 font-bold">
                              模版內容 (支援 &#123;symbol&#125;, &#123;companyName&#125;)
                            </label>
                            <textarea
                              value={editingPromptTemplate}
                              onChange={(e) => setEditingPromptTemplate(e.target.value)}
                              rows={5}
                              className="w-full bg-[#161616] border border-white/10 text-white rounded p-2 text-xs focus:outline-none focus:border-red-500 resize-none leading-relaxed"
                            />
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={() => {
                                if (!editingPromptName.trim() || !editingPromptTemplate.trim()) {
                                  toast.error("請填寫完整的名稱與內容");
                                  return;
                                }
                                const updated = dynamicPrompts.map(p => 
                                  p.id === editingPromptId 
                                    ? { ...p, name: editingPromptName, template: editingPromptTemplate, note: editingPromptNote } 
                                    : p
                                );
                                handleSavePrompts(updated);
                                setEditingPromptId(null);
                                setEditingPromptNote("");
                                toast.success("模版修改成功！");
                                playClickSound();
                              }}
                              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer border border-emerald-500/20"
                            >
                              <Save className="w-3 h-3" />
                              儲存修改
                            </button>
                            <button
                              onClick={() => {
                                setEditingPromptId(null);
                                playClickSound();
                              }}
                              className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-750 text-zinc-300 font-bold rounded text-[10px] transition-all cursor-pointer border border-white/5"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Create New Area */
                        <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5 flex flex-col gap-2">
                          <div className="text-[10px] font-bold text-zinc-300 flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5 text-emerald-500" />
                            新增自訂模版
                          </div>

                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              placeholder="輸入模版名稱 (例如: 個股籌碼透視)"
                              value={newPromptName}
                              onChange={(e) => setNewPromptName(e.target.value)}
                              className="w-full bg-[#161616] border border-white/10 text-white rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              placeholder="輸入模版備註 (例如: 主要分析籌碼主力, 選填)"
                              value={newPromptNote}
                              onChange={(e) => setNewPromptNote(e.target.value)}
                              className="w-full bg-[#161616] border border-white/10 text-white rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <textarea
                              placeholder="輸入模版內容。支援 {symbol} 與 {companyName} 自動代入"
                              value={newPromptTemplate}
                              onChange={(e) => setNewPromptTemplate(e.target.value)}
                              rows={3}
                              className="w-full bg-[#161616] border border-white/10 text-white rounded p-2 text-xs focus:outline-none focus:border-emerald-500/50 resize-none leading-relaxed"
                            />
                          </div>

                          <button
                            onClick={() => {
                              if (!newPromptName.trim() || !newPromptTemplate.trim()) {
                                toast.error("請輸入標題與模版內容");
                                return;
                              }
                              const newId = `custom_${Date.now()}`;
                              const updated = [
                                ...dynamicPrompts,
                                { id: newId, name: newPromptName, template: newPromptTemplate, note: newPromptNote }
                              ];
                              handleSavePrompts(updated);
                              setAiSelectedPromptId(newId);
                              setNewPromptName("");
                              setNewPromptTemplate("");
                              setNewPromptNote("");
                              toast.success("自訂模版新增成功！");
                              playClickSound();
                            }}
                            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer border border-emerald-500/20"
                          >
                            <Plus className="w-3 h-3" />
                            新增並儲存
                          </button>
                        </div>
                      )}

                      {/* Templates list with edit/delete buttons */}
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          現有模版列表 ({dynamicPrompts.length})
                        </div>
                        <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                          {dynamicPrompts.map((tmpl) => (
                            <div
                              key={`tmpl-item-${tmpl.id}`}
                              className="p-2.5 bg-[#141414] rounded border border-white/5 flex items-center justify-between gap-3 text-xs hover:border-white/10 transition-all"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-zinc-200 truncate">{tmpl.name}</div>
                                <div className="text-[10px] text-zinc-500 truncate mt-0.5">{tmpl.template}</div>
                                {tmpl.note && (
                                  <div className="text-[9px] text-amber-500/80 truncate mt-0.5 font-sans">
                                    備註: {tmpl.note}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingPromptId(tmpl.id);
                                    setEditingPromptName(tmpl.name);
                                    setEditingPromptTemplate(tmpl.template);
                                    setEditingPromptNote(tmpl.note || "");
                                    playClickSound();
                                  }}
                                  className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-all cursor-pointer"
                                  title="編輯標題與內容"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {confirmDeletePromptId === tmpl.id ? (
                                  <div className="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded border border-red-500/20">
                                    <button
                                      onClick={() => {
                                        const updated = dynamicPrompts.filter(p => p.id !== tmpl.id);
                                        handleSavePrompts(updated);
                                        if (aiSelectedPromptId === tmpl.id) {
                                          setAiSelectedPromptId(updated[0].id);
                                        }
                                        toast.success("模版已刪除");
                                        playClickSound();
                                        setConfirmDeletePromptId(null);
                                      }}
                                      className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[9px] transition-all cursor-pointer"
                                      title="確認刪除"
                                    >
                                      確認
                                    </button>
                                    <button
                                      onClick={() => {
                                        setConfirmDeletePromptId(null);
                                        playClickSound();
                                      }}
                                      className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[9px] transition-all cursor-pointer"
                                      title="取消"
                                    >
                                      取消
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      if (dynamicPrompts.length <= 1) {
                                        toast.error("至少需要保留一個指令模版");
                                        return;
                                      }
                                      setConfirmDeletePromptId(tmpl.id);
                                      playClickSound();
                                    }}
                                    className="p-1 hover:bg-red-500/10 rounded text-zinc-500 hover:text-red-400 transition-all cursor-pointer"
                                    title="刪除"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Stock selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold tracking-wider text-zinc-500 font-sans uppercase">
                        選擇分析個股 SELECT STOCK
                      </label>
                      <select
                        value={aiSelectedSymbol}
                        onChange={(e) => {
                          setAiSelectedSymbol(e.target.value);
                          playClickSound();
                        }}
                        className="w-full bg-[#161616] border border-white/10 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500/50 cursor-pointer"
                      >
                        {uniqueActiveStocks.length === 0 ? (
                          <option value="">(無持有或真實交易個股)</option>
                        ) : (
                          uniqueActiveStocks.map((stock) => (
                            <option key={`ai-stock-${stock.symbol}`} value={stock.symbol}>
                              {stock.symbol} {stock.companyName ? `(${stock.companyName})` : ""}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* Prompt Template selector */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold tracking-wider text-zinc-500 font-sans uppercase">
                          選擇指令模版 SELECT PROMPT
                        </label>
                        <button
                          onClick={() => {
                            setIsPromptManagerOpen(true);
                            playClickSound();
                          }}
                          className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1 bg-amber-500/5 hover:bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 transition-all cursor-pointer font-bold"
                          title="管理/新增/修改 Prompt 範本"
                        >
                          <Settings className="w-3 h-3 text-amber-500" />
                          <span>管理模版</span>
                        </button>
                      </div>
                      <select
                        value={aiSelectedPromptId}
                        onChange={(e) => {
                          setAiSelectedPromptId(e.target.value);
                          playClickSound();
                        }}
                        className="w-full bg-[#161616] border border-white/10 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500/50 cursor-pointer"
                      >
                        {dynamicPrompts.map((tmpl) => (
                          <option key={`ai-tmpl-${tmpl.id}`} value={tmpl.id}>
                            {tmpl.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Prompt Template Memo Field */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold tracking-wider text-zinc-500 font-sans uppercase">
                        指令模版備註 PROMPT TEMPLATE NOTE
                      </label>
                      <textarea
                        value={(() => {
                          const selectedTmpl = dynamicPrompts.find(t => t.id === aiSelectedPromptId);
                          return selectedTmpl?.note || "";
                        })()}
                        onChange={(e) => {
                          const updated = dynamicPrompts.map(p => 
                            p.id === aiSelectedPromptId 
                              ? { ...p, note: e.target.value } 
                              : p
                          );
                          handleSavePrompts(updated);
                        }}
                        placeholder="在此輸入此指令模版的備註說明，修改後會自動存檔..."
                        className="w-full h-20 bg-[#161616] border border-white/10 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-red-500/50 resize-none font-sans leading-relaxed"
                      />
                    </div>
                                {/* Prompt Text Box */}
                    <div className="flex-1 flex flex-col gap-1.5 relative min-h-[220px]">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[10px] font-bold tracking-wider text-zinc-500 font-sans uppercase">
                          編輯與確認指令 EDIT PROMPT
                        </label>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              handlePasteOnDeepseek();
                              playClickSound();
                            }}
                            className="lg:hidden text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded transition-all cursor-pointer border border-amber-500/20 font-bold"
                          >
                            <span>Deepseek</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(aiPromptText);
                                toast.success("已複製 Prompt 到剪貼簿！");
                              } catch (err) {
                                toast.error("複製失敗");
                              }
                            }}
                            className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-all cursor-pointer border border-white/5"
                          >
                            <Copy className="w-3 h-3" />
                            <span>複製指令</span>
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={aiPromptText}
                        onChange={(e) => setAiPromptText(e.target.value)}
                        className="flex-1 w-full bg-[#161616] border border-white/10 text-white rounded-lg p-3 text-xs focus:outline-none focus:border-red-500/50 resize-none font-sans leading-relaxed"
                        placeholder="請輸入或選擇 Prompt 指令..."
                      />
                    </div>

                    {/* Compact Tab Interface for AI Operations */}
                    <div className="flex flex-col gap-2 mt-2 border-t border-white/5 pt-3 shrink-0">
                      <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/[0.03] gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAiLeftTab("upload");
                            playClickSound();
                          }}
                          className={`flex-1 py-1 text-[11px] font-bold rounded transition-all cursor-pointer text-center ${
                            aiLeftTab === "upload"
                              ? "bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          上傳 HTML
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAiLeftTab("preview");
                            playClickSound();
                          }}
                          className={`flex-1 py-1 text-[11px] font-bold rounded transition-all cursor-pointer text-center relative ${
                            aiLeftTab === "preview"
                              ? "bg-zinc-800 text-white border border-white/[0.05]"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          預覽 HTML
                          {aiHtmlFiles.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full scale-90">
                              {aiHtmlFiles.length}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handlePasteOnDeepseek();
                            playClickSound();
                          }}
                          className="hidden lg:block flex-1 py-1 text-[11px] font-bold rounded transition-all cursor-pointer text-center text-amber-500 hover:text-amber-400 hover:bg-amber-500/5 border border-transparent hover:border-amber-500/10"
                        >
                          Paste on Deepseek
                        </button>
                      </div>

                      {/* Tab Content Areas */}
                      <div className="mt-1">
                        {aiLeftTab === "upload" && (
                          <div className="flex flex-col gap-2 p-2 bg-white/[0.02] border border-white/5 rounded-lg animate-fadeIn">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                              上傳個股分析檔案 ({aiSelectedSymbol || "尚未選擇"})
                            </div>
                            
                            <div className="relative border border-dashed border-white/10 hover:border-emerald-500/30 rounded-lg p-3 transition-all flex flex-col items-center justify-center gap-1.5 bg-black/20">
                              <input
                                type="file"
                                accept=".html"
                                onChange={handleAiFileChange}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              />
                              <Upload className="w-5 h-5 text-zinc-500" />
                              <span className="text-[10px] text-zinc-300 font-sans">
                                {aiUploadFile ? aiUploadFile.name : "點擊或拖曳選擇 HTML 檔案"}
                              </span>
                              {aiUploadFile && (
                                <span className="text-[8px] font-mono text-zinc-500">
                                  大小: {(aiUploadFile.size / 1024).toFixed(1)} KB
                                </span>
                              )}
                            </div>

                            <button
                              onClick={handleAiUploadSubmit}
                              disabled={isAiUploading || !aiUploadContent || !aiSelectedSymbol}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow"
                            >
                              {isAiUploading ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>正在上傳中...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>確認上傳 HTML 檔案</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {aiLeftTab === "preview" && (
                          <div className="flex flex-col gap-2 animate-fadeIn">
                            {aiHtmlFiles.length === 0 ? (
                              <div className="text-center py-4 text-xs text-zinc-500 bg-white/[0.01] border border-white/5 rounded-lg">
                                目前此個股尚無上傳之 HTML 檔案。
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto scrollbar-hide">
                                {aiHtmlFiles.map((file) => (
                                  <div
                                    key={`ai-html-${file.id}`}
                                    onClick={() => {
                                      setSelectedPreviewUrl(`/api/html-files/${file.id}/content`);
                                      setSelectedPreviewLinkTitle(file.fileName);
                                      setAiMobileActiveTab("preview");
                                      playClickSound();
                                    }}
                                    className={`px-2.5 py-1.5 rounded bg-[#141414]/80 border text-xs cursor-pointer flex items-center justify-between transition-all group ${
                                      selectedPreviewUrl === `/api/html-files/${file.id}/content`
                                        ? "border-amber-500/40 bg-amber-500/10 text-white"
                                        : "border-white/5 text-zinc-400 hover:text-white hover:bg-white/5"
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0 pr-2">
                                      <div className="truncate font-semibold text-[11px]">{file.fileName}</div>
                                      <div className="text-[9px] font-mono text-zinc-500 mt-0.5">{file.uploadDate}</div>
                                    </div>
                                    {confirmDeleteFileId === file.id ? (
                                      <div className="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded border border-red-500/20 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          onClick={(e) => {
                                            handleAiDeleteHtmlFile(e, file.id);
                                            playClickSound();
                                          }}
                                          className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[9px] transition-all cursor-pointer"
                                          title="確認刪除"
                                        >
                                          確認
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteFileId(null);
                                            playClickSound();
                                          }}
                                          className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[9px] transition-all cursor-pointer"
                                          title="取消"
                                        >
                                          取消
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteFileId(file.id);
                                          playClickSound();
                                        }}
                                        className="p-1 text-zinc-500 hover:text-red-400 hover:bg-white/5 rounded transition-colors"
                                        title="刪除檔案"
                                      >
                                        <Trash className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right Column (Output Display) */}
              <div className={`flex-1 flex-col min-h-0 bg-[#121212]/50 border border-white/5 rounded-xl overflow-hidden p-4 ${aiMobileActiveTab === "preview" ? "flex" : "hidden lg:flex"}`}>
                
                {/* Content Container */}
                <div className="flex-1 overflow-hidden relative">
                  
                  {selectedPreviewUrl ? (
                    <div className="h-full w-full flex flex-col">
                      <div className="flex-1 bg-white rounded-lg overflow-hidden relative">
                        <a
                          href={selectedPreviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute top-3 right-3 z-10 p-2 bg-black/85 hover:bg-black/95 text-white hover:text-[#10b981] rounded-full transition-all border border-white/10 hover:border-[#10b981]/50 shadow-lg flex items-center justify-center cursor-pointer"
                          title="在新分頁開啟"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <iframe
                          src={selectedPreviewUrl}
                          className="w-full h-full border-none"
                          title="HTML Preview"
                          sandbox="allow-scripts allow-same-origin allow-popups"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-650">
                      <FileJson className="w-10 h-10 text-zinc-800" />
                      <p className="text-xs text-zinc-550 font-medium font-sans">請在左側選擇或上傳個股的 HTML 檔案以進行網頁預覽。</p>
                    </div>
                  )}

                </div>
              </div>

            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
    </div>
  );
}
