import React from 'react';
import { ArrowRight, CheckCircle2, Database, FileSpreadsheet, Play } from 'lucide-react';
import {
  DatasetSummary,
  EconomicSector,
  EvaluationComparison,
  NavSectionId,
  RegressionModelResult,
} from '../../types/analytics';

interface HomeDashboardProps {
  sector: EconomicSector;
  dataset: DatasetSummary | null;
  target: string;
  predictors: string[];
  winningModel: RegressionModelResult | null;
  evaluation: EvaluationComparison | null;
  onNavigate: (section: NavSectionId) => void;
  onLoadDemo: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  sector,
  dataset,
  target,
  predictors,
  winningModel,
  evaluation,
  onNavigate,
  onLoadDemo,
}) => {
  const winningMetrics = evaluation?.metrics.find(
    (m) => m.modelId === evaluation.winningModelId
  );

  const workflowSteps: Array<{
    step: number;
    title: string;
    detail: string;
    done: boolean;
    targetSection: NavSectionId;
    disabled?: boolean;
  }> = [
    {
      step: 1,
      title: 'Sector económico y carga de datos',
      detail: dataset
        ? `${dataset.fileName} (${dataset.rowCount} registros, sector ${sector})`
        : 'Carga un archivo Excel/CSV o inicia con el dataset de demostración',
      done: Boolean(dataset),
      targetSection: 'cargar',
    },
    {
      step: 2,
      title: 'Análisis exploratorio y correlaciones',
      detail: 'Estadísticos descriptivos, histogramas, cajas, dispersión y alertas |r| > 0.60',
      done: Boolean(dataset),
      targetSection: 'exploratorio',
      disabled: !dataset,
    },
    {
      step: 3,
      title: 'Selección de variable objetivo y predictores',
      detail:
        target && predictors.length > 0
          ? `Objetivo: ${target} · Predictores: ${predictors.length}`
          : 'Elige la variable dependiente Y y sus predictores X',
      done: Boolean(target && predictors.length > 0),
      targetSection: 'variables',
      disabled: !dataset,
    },
    {
      step: 4,
      title: 'Modelado y validación estadística',
      detail: winningModel
        ? `4 modelos entrenados · Ganador: ${winningModel.shortLabel}`
        : 'División Train/Test reproducible, Simple, Múltiple, Stepwise AIC y Best Subsets',
      done: Boolean(winningModel),
      targetSection: 'modelos',
      disabled: !winningModel,
    },
    {
      step: 5,
      title: 'Predicciones, escenarios e informe final',
      detail: 'Proyecciones con IC/IP 95%, simulación de 5 escenarios y exportación PDF/Excel',
      done: Boolean(winningModel),
      targetSection: 'escenarios',
      disabled: !winningModel,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          <div className="space-y-4 lg:col-span-8">
            <p className="text-xs font-medium text-indigo-700">
              Ciencia de Datos y Regresión Lineal Múltiple · Flujo RStudio
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              MLearning – Plataforma Inteligente de Predicción de Ventas
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Carga tu base de datos en Excel o CSV, explora relaciones estadísticas reales,
              entrena y compara modelos de regresión lineal simple, múltiple, Stepwise (AIC) y
              Best Subsets, diagnostica supuestos y simula escenarios comerciales.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('cargar')}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
              >
                <Database className="h-4 w-4" />
                {dataset ? 'Configurar o cambiar datos' : 'Cargar Excel o CSV'}
              </button>
              <button
                type="button"
                onClick={onLoadDemo}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Play className="h-4 w-4 text-indigo-600" />
                Probar dataset demo (Bowls, Soda y Beer)
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 lg:col-span-4">
            <h2 className="text-sm font-semibold text-slate-900">Estado actual de la sesión</h2>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <dt className="text-slate-500">Sector económico</dt>
                <dd className="font-semibold text-slate-900">{sector}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <dt className="text-slate-500">Dataset activo</dt>
                <dd className="max-w-[160px] truncate font-semibold text-slate-900">
                  {dataset ? dataset.fileName : 'Pendiente'}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <dt className="text-slate-500">Variable objetivo (Y)</dt>
                <dd className="font-semibold text-slate-900">{target || 'Sin confirmar'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Modelo ganador</dt>
                <dd className="font-semibold text-indigo-700">
                  {winningModel ? winningModel.shortLabel : 'Sin entrenar'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Active KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Registros en base</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {dataset ? dataset.rowCount.toLocaleString('es-ES') : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {dataset ? `${dataset.columnCount} variables detectadas` : 'Carga un archivo para iniciar'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">R² ajustado (Entrenamiento)</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {winningModel ? `${(winningModel.adjRSquared * 100).toFixed(2)}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {winningModel ? winningModel.shortLabel : 'Requiere selección de variables'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">RMSE en prueba (Test)</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {winningMetrics ? winningMetrics.rmse.toFixed(3) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {winningMetrics ? `Evaluado en ${winningMetrics.nTest} registros` : 'Evaluación fuera de muestra'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">MAE en prueba (Test)</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {winningMetrics ? winningMetrics.mae.toFixed(3) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {winningMetrics ? 'Error absoluto medio real' : 'Sin evaluación activa'}
          </p>
        </div>
      </section>

      {/* Guided Step-by-Step Pipeline */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Flujo de análisis guiado</h2>
            <p className="text-xs text-slate-500">
              Sigue la secuencia analítica completa desde la carga de datos hasta el informe ejecutivo.
            </p>
          </div>
          {winningModel && (
            <button
              type="button"
              onClick={() => onNavigate('informe')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-800 whitespace-nowrap"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Ir al informe final
            </button>
          )}
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          {workflowSteps.map((s) => (
            <div
              key={s.step}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                    s.done
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {s.done ? <CheckCircle2 className="h-4 w-4" /> : s.step}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{s.title}</h3>
                  <p className="text-xs text-slate-500">{s.detail}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={s.disabled}
                onClick={() => onNavigate(s.targetSection)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  s.disabled
                    ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                Abrir módulo
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
