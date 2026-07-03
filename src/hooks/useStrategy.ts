import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { subscribeStrategy, upsertStrategy as dbUpsertStrategy } from '../lib/supabase-helpers';
import type { StrategyConfig } from '../types';
import { toast } from 'sonner';

export function useStrategy(tabId: string | undefined) {
  const { user } = useAuth();
  const [strategy, setStrategy] = useState<StrategyConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tabId || !user) { setStrategy(null); setLoading(false); return; }
    const unsubscribe = subscribeStrategy(tabId, (data) => {
      if (data) setStrategy({ ...data, id: 'main' });
      else setStrategy(null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tabId, user]);

  const saveStrategy = async (data: Partial<StrategyConfig>) => {
    if (!tabId || !user) return;
    const { error } = await dbUpsertStrategy(tabId, data);
    if (error) { toast.error('保存策略失敗'); console.error(error); }
    else {
      if (data.tags !== undefined) {
        try {
          const { updateTab } = await import('../lib/supabase-helpers');
          await updateTab(tabId, { tags: data.tags });
        } catch (err) { toast.error('保存標籤失敗'); console.error(err); }
      }
      toast.success('策略已儲存');
    }
  };

  return { strategy, loading, saveStrategy };
}
