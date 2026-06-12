import { useCallback, useEffect, useState } from 'react';
import type { PlanTier } from '../types/plans';
import type { IpCameraConfig } from '../types/ipCamera';
import { clearIpCameraConfig, loadIpCameraConfig, saveIpCameraConfig } from '../lib/ipCameraStorage';
import { validateIpCameraUrl } from '../lib/ipCameraUrl';
import { planAllowsIpCamera } from '../lib/planLimits';

interface UseIpCameraConfigOptions {
  sessionId: string | undefined;
  planId: PlanTier;
  defaultSlot: number;
}

export function useIpCameraConfig({ sessionId, planId, defaultSlot }: UseIpCameraConfigOptions) {
  const [config, setConfig] = useState<IpCameraConfig | null>(null);

  useEffect(() => {
    if (!sessionId || !planAllowsIpCamera(planId)) {
      setConfig(null);
      return;
    }
    setConfig(loadIpCameraConfig(sessionId));
  }, [sessionId, planId]);

  const save = useCallback(
    (partial: Partial<IpCameraConfig> & { url?: string; label?: string }) => {
      if (!sessionId || !planAllowsIpCamera(planId)) {
        return { ok: false, message: 'IP camera inputs require a Pro or Pro Master plan.' };
      }

      const url = (partial.url ?? config?.url ?? '').trim();
      if (partial.enabled !== false && url) {
        const check = validateIpCameraUrl(url);
        if (!check.ok) return { ok: false, message: check.message };
      }

      const next: IpCameraConfig = {
        id: config?.id ?? crypto.randomUUID(),
        label: (partial.label ?? config?.label ?? 'IP Camera').trim() || 'IP Camera',
        url,
        enabled: partial.enabled ?? config?.enabled ?? Boolean(url),
        slotNumber: partial.slotNumber ?? config?.slotNumber ?? defaultSlot,
        sessionId,
        updatedAt: new Date().toISOString(),
      };

      saveIpCameraConfig(next);
      setConfig(next);
      return { ok: true, message: url ? 'IP camera saved.' : 'IP camera cleared.' };
    },
    [config, sessionId, planId, defaultSlot],
  );

  const remove = useCallback(() => {
    clearIpCameraConfig();
    setConfig(null);
  }, []);

  return { config, save, remove, allowed: planAllowsIpCamera(planId) };
}
