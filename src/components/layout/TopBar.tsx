import React from 'react';
import { Menu } from 'lucide-react';
import { EconomicSector, NavSectionId } from '../../types/analytics';
import { NAV_ITEMS } from './Sidebar';

interface TopBarProps {
  activeSection: NavSectionId;
  sector: EconomicSector;
  fileName: string | null;
  hasModels: boolean;
  onOpenMobileMenu: () => void;
  onNavigate: (id: NavSectionId) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  sector,
  fileName,
  hasModels,
  onOpenMobileMenu,
  onNavigate,
}) => {
  const currentItem = NAV_ITEMS.find((n) => n.id === activeSection);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-8 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
      {/* Zone 1: Mobile Menu Trigger + Breadcrumb */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="Abrir navegación"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="font-medium text-slate-500 whitespace-nowrap hidden sm:inline">
            Plataforma de Predicción
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="truncate font-semibold text-slate-900">
            {currentItem?.label ?? 'Inicio'}
          </span>
        </div>
      </div>

      {/* Zone 2: Clean unboxed metadata */}
      <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap shrink-0">
        <span>Sector: {sector}</span>
        <span aria-hidden="true">·</span>
        <span className="max-w-[240px] truncate">
          {fileName ? `Base: ${fileName}` : 'Sin archivo cargado'}
        </span>
      </div>

      {/* Zone 3: Single Primary Action */}
      <div className="flex items-center shrink-0">
        {activeSection !== 'cargar' && !fileName ? (
          <button
            type="button"
            onClick={() => onNavigate('cargar')}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
          >
            Cargar datos
          </button>
        ) : hasModels && activeSection !== 'informe' ? (
          <button
            type="button"
            onClick={() => onNavigate('informe')}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Ver informe final
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('cargar')}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            Cambiar dataset
          </button>
        )}
      </div>
    </header>
  );
};
