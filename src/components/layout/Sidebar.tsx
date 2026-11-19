import React from 'react';
import {
  Activity,
  BarChart3,
  Check,
  Database,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Home,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { NavSectionId } from '../../types/analytics';

export interface NavItemConfig {
  id: NavSectionId;
  order: number;
  label: string;
  requiresDataset?: boolean;
  requiresModels?: boolean;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { id: 'inicio', order: 1, label: 'Inicio' },
  { id: 'cargar', order: 2, label: 'Cargar datos' },
  { id: 'exploratorio', order: 3, label: 'Análisis exploratorio', requiresDataset: true },
  { id: 'variables', order: 4, label: 'Selección de variables', requiresDataset: true },
  { id: 'modelos', order: 5, label: 'Modelos de regresión', requiresModels: true },
  { id: 'diagnostico', order: 6, label: 'Diagnóstico', requiresModels: true },
  { id: 'evaluacion', order: 7, label: 'Evaluación de modelos', requiresModels: true },
  { id: 'predicciones', order: 8, label: 'Predicciones', requiresModels: true },
  { id: 'escenarios', order: 9, label: 'Simulación de escenarios', requiresModels: true },
  { id: 'informe', order: 10, label: 'Informe final', requiresModels: true },
];

const ICONS: Record<NavSectionId, React.ComponentType<{ className?: string }>> = {
  inicio: Home,
  cargar: Database,
  exploratorio: BarChart3,
  variables: SlidersHorizontal,
  modelos: GitBranch,
  diagnostico: Activity,
  evaluacion: TrendingUp,
  predicciones: Sparkles,
  escenarios: FileSpreadsheet,
  informe: FileText,
};

interface SidebarProps {
  activeSection: NavSectionId;
  onSelectSection: (id: NavSectionId) => void;
  hasDataset: boolean;
  hasModels: boolean;
  completedSections: Set<NavSectionId>;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  hasDataset,
  hasModels,
  completedSections,
  mobileOpen,
  onCloseMobile,
}) => {
  const renderList = () => (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
      {NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.id];
        const isDisabled =
          (item.requiresDataset && !hasDataset) || (item.requiresModels && !hasModels);
        const isActive = activeSection === item.id;
        const isDone = completedSections.has(item.id);

        return (
          <button
            key={item.id}
            type="button"
            disabled={isDisabled}
            onClick={() => {
              onSelectSection(item.id);
              onCloseMobile();
            }}
            className={`group flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 ${
              isActive
                ? 'bg-slate-900 text-white'
                : isDisabled
                ? 'cursor-not-allowed text-slate-400'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive
                    ? 'text-indigo-300'
                    : isDisabled
                    ? 'text-slate-300'
                    : 'text-slate-500 group-hover:text-slate-700'
                }`}
              />
              <span className="truncate whitespace-nowrap">
                {item.order}. {item.label}
              </span>
            </span>
            {isDone && !isDisabled && (
              <Check
                className={`h-3.5 w-3.5 shrink-0 ${
                  isActive ? 'text-emerald-300' : 'text-emerald-600'
                }`}
                aria-label="Completado"
              />
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <button
            type="button"
            onClick={() => onSelectSection('inicio')}
            className="text-left focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              MLearning
            </span>
          </button>
        </div>
        {renderList()}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <span className="font-display text-base font-bold text-slate-900">MLearning</span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderList()}
          </aside>
        </div>
      )}
    </>
  );
};
