import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { StrategyConfig } from '../types';
import { toast } from 'sonner';
import { safeSessionStorage } from '../lib/utils';

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

const getCachedTabStrategy = (userId?: string | null, tabId?: string): StrategyConfig | null => {
  if (!userId || !tabId) return null;
  try {
    const raw = safeSessionStorage.getItem(`cached_tab_strategies_v3_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed[tabId]) {
        return parsed[tabId] as StrategyConfig;
      }
    }
  } catch (e) {}
  return null;
};

const saveCachedTabStrategy = (userId: string | undefined | null, tabId: string | undefined, next: StrategyConfig | null) => {
  if (!userId || !tabId) return;
  try {
    const raw = safeSessionStorage.getItem(`cached_tab_strategies_v3_${userId}`);
    const parsed = raw ? JSON.parse(raw) : {};
    if (next) {
      parsed[tabId] = next;
    } else {
      delete parsed[tabId];
    }
    safeSessionStorage.setItem(`cached_tab_strategies_v3_${userId}`, JSON.stringify(parsed));
  } catch (e) {}
};

export function useStrategy(tabId: string | undefined) {
  const { user } = useAuth();
  const [strategy, setStrategy] = useState<StrategyConfig | null>(() => getCachedTabStrategy(user?.uid, tabId));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tabId || !user) {
      setStrategy(null);
      setLoading(false);
      return;
    }

    const cached = getCachedTabStrategy(user.uid, tabId);
    if (cached) {
      setStrategy(cached);
    }

    const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const next = { id: docSnap.id, ...docSnap.data() } as StrategyConfig;
        setStrategy(next);
        saveCachedTabStrategy(user?.uid, tabId, next);
      } else {
        setStrategy(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `stockTabs/${tabId}/strategy/main`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tabId, user?.uid]);

  const saveStrategy = async (data: Partial<StrategyConfig>) => {
    if (!tabId || !user) return;
    try {
      const sanitizedData: any = {};
      Object.keys(data).forEach(key => {
        if ((data as any)[key] === undefined) {
          sanitizedData[key] = deleteField();
        } else {
          sanitizedData[key] = stripUndefined((data as any)[key]);
        }
      });
      try {
        await setDoc(doc(db, `stockTabs/${tabId}/strategy`, 'main'), {
          ...sanitizedData,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        toast.error('保存策略失敗');
        handleFirestoreError(error, OperationType.WRITE, `stockTabs/${tabId}/strategy/main`);
        return;
      }
      
      if (sanitizedData.tags !== undefined && sanitizedData.tags !== deleteField()) {
        try {
          await updateDoc(doc(db, 'stockTabs', tabId), {
            tags: sanitizedData.tags,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          toast.error('保存標籤失敗');
          handleFirestoreError(error, OperationType.WRITE, `stockTabs/${tabId}`);
          return;
        }
      }

      toast.success('策略已儲存');
    } catch (error) {
      toast.error('系統錯誤');
      console.warn(error);
    }
  };

  return { strategy, loading, saveStrategy };
}
