import type { CloudCastProduct } from '../../types/products';

export interface ProductAccentTheme {
  border: string;
  glow: string;
  btn: string;
  icon: string;
  hex: string;
  emissive: string;
  gradient: string;
}

export function productAccentTheme(accent: CloudCastProduct['accent']): ProductAccentTheme {
  if (accent === 'blue') {
    return {
      border: 'border-sky-500/40',
      glow: 'shadow-[0_0_40px_#0ea5e920]',
      btn: 'bg-sky-600 text-white hover:bg-sky-500',
      icon: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
      hex: '#0ea5e9',
      emissive: '#0284c7',
      gradient: 'from-sky-500/20 via-sky-950/40 to-transparent',
    };
  }
  if (accent === 'purple') {
    return {
      border: 'border-violet-500/40',
      glow: 'shadow-[0_0_40px_#8b5cf620]',
      btn: 'bg-violet-600 text-white hover:bg-violet-500',
      icon: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
      hex: '#8b5cf6',
      emissive: '#6d28d9',
      gradient: 'from-violet-500/20 via-violet-950/40 to-transparent',
    };
  }
  if (accent === 'emerald') {
    return {
      border: 'border-emerald-500/40',
      glow: 'shadow-[0_0_40px_#10b98120]',
      btn: 'bg-emerald-600 text-white hover:bg-emerald-500',
      icon: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
      hex: '#10b981',
      emissive: '#047857',
      gradient: 'from-emerald-500/20 via-emerald-950/40 to-transparent',
    };
  }
  if (accent === 'amber') {
    return {
      border: 'border-amber-500/40',
      glow: 'shadow-[0_0_40px_#f59e0b20]',
      btn: 'bg-amber-500 text-black hover:bg-amber-400',
      icon: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      hex: '#f59e0b',
      emissive: '#b45309',
      gradient: 'from-amber-500/20 via-amber-950/40 to-transparent',
    };
  }
  return {
    border: 'border-mixer-red/40',
    glow: 'shadow-[0_0_40px_#e11d4820]',
    btn: 'bg-mixer-red text-white hover:bg-mixer-red-dim',
    icon: 'border-mixer-red/30 bg-mixer-red/10 text-mixer-red',
    hex: '#e11d48',
    emissive: '#9f1239',
    gradient: 'from-mixer-red/20 via-red-950/40 to-transparent',
  };
}
