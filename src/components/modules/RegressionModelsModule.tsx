import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import {
  EconomicSector,
  ModelId,
  RegressionModelResult,
  SplitConfig,
  SplitResult,
} from '../../types/analytics';

interface RegressionModelsModuleProps {
  sector: EconomicSector;
  models: RegressionModelResult[];
  splitConfig: SplitConfig;
  splitResult: SplitResult;
  onContinueToDiagnostics: () => void;
}

export const RegressionModelsModule: React.FC<RegressionModelsModuleProps> = ({
  sector,
  models,
  splitConfig,
  splitResult,
  onContinueToDiagnostics,
}) => {
  const [selectedId, setSelectedId] = useState<ModelId>(models[1]?.id ?? models[0]?.id ?? 'model0');
  const activeModel = models.find((m) => m.id === selectedId) ?? models[0];

  if (!activeModel) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Configura y confirma las variables en el módulo anterior para construir los modelos.
      </div>
    );
  }

  const significantVars = activeModel.coefficients.filter((c) => !c.isIntercept && c.significant);
  const nonSignificantVars = activeModel.coefficients.filter(
    (c) => !c.isIntercept && !c.significant
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Módulo 5. Construcción de Modelos de Regresión
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Entrenados sobre Data Train ({splitResult.trainRows.length} registros ·{' '}
            {splitConfig.chronological ? 'división cronológica' : `semilla ${splitConfig.seed}`}).
            Data Test ({splitResult.testRows.length} registros) reservado para evaluación final.
          </p>
        </div>
        <button
          type="button"
          onClick={onContinueToDiagnostics}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
        >
          Ir a Diagnóstico de Supuestos
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Model Selector Tabs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {models.map((m) => {
          const isActive = m.id === activeModel.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                isActive
                  ? 'border-indigo-600 bg-indigo-50/60'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <p className="text-xs font-medium text-indigo-700">{m.shortLabel}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{m.name}</p>
              <div className="mt-2 flex items-center gap-3 font-mono text-xs text-slate-600 tabular-nums">
                <span>R² adj: {(m.adjRSquared * 100).toFixed(1)}%</span>
                <span>·</span>
                <span>AIC: {m.aic.toFixed(1)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Equation & Global Fit Metrics */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{activeModel.name}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{activeModel.description}</p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            n = {activeModel.nTrain} · gl = {activeModel.dfResidual}
          </span>
        </div>

        {/* Equation box */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-medium text-slate-500">Ecuación matemática estimada</p>
          <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900 tabular-nums">
            {activeModel.equation}
          </p>
        </div>

        {/* Global Fit KPIs */}
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] text-slate-500">R cuadrado (R²)</p>
            <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
              {(activeModel.rSquared * 100).toFixed(2)}%
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] text-slate-500">R² ajustado</p>
            <p className="mt-1 font-mono text-base font-semibold text-indigo-700 tabular-nums">
              {(activeModel.adjRSquared * 100).toFixed(2)}%
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] text-slate-500">Estadístico F</p>
            <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
              {activeModel.fStatistic.toFixed(2)}
            </p>
            <p className="font-mono text-[10px] text-slate-500 tabular-nums">
              p = {activeModel.fPValue < 0.0001 ? '< 0.0001' : activeModel.fPValue.toFixed(4)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] text-slate-500">Error Est. Residual</p>
            <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
              {activeModel.residualStdError.toFixed(3)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] text-slate-500">AIC</p>
            <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
              {activeModel.aic.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] text-slate-500">BIC</p>
            <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
              {activeModel.bic.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Coefficients Table (R summary + confint 95%) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">
          Tabla de coeficientes e intervalos de confianza al 95%
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Códigos de significancia: *** p &lt; 0.001 · ** p &lt; 0.01 · * p &lt; 0.05 · . p &lt; 0.1
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-right text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2.5 text-left font-medium">Término</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Coeficiente</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Error Est.</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Estadístico t</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Valor p</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">IC 95% Inf.</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">IC 95% Sup.</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">VIF</th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-left font-medium">Signif.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {activeModel.coefficients.map((c) => (
                <tr key={c.term} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 text-left font-sans font-semibold text-slate-900">
                    {c.term}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">
                    {c.estimate.toFixed(4)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{c.stdError.toFixed(4)}</td>
                  <td className="px-3 py-2.5 text-slate-700">{c.tStat.toFixed(3)}</td>
                  <td
                    className={`px-3 py-2.5 font-semibold ${
                      c.significant ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {c.pValue < 0.0001 ? '< 0.0001' : c.pValue.toFixed(4)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{c.ciLower.toFixed(4)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{c.ciUpper.toFixed(4)}</td>
                  <td
                    className={`px-3 py-2.5 ${
                      c.vif !== null && c.vif > 10
                        ? 'font-semibold text-rose-700'
                        : c.vif !== null && c.vif > 5
                        ? 'font-semibold text-amber-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {c.vif !== null ? c.vif.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-left font-sans">
                    {c.significant ? (
                      <span className="font-semibold text-emerald-700">
                        Sí {c.significanceCode}
                      </span>
                    ) : (
                      <span className="text-slate-400">No {c.significanceCode}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warnings & Significance Summary + Coefficient Interpretations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <h3 className="text-base font-semibold text-slate-900">
            Interpretación de coeficientes en el sector {sector}
          </h3>
          <div className="mt-4 divide-y divide-slate-100">
            {activeModel.coefficients.map((c) => (
              <div key={c.term} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900">{c.term}</span>
                  <span className="font-mono text-slate-600 tabular-nums">
                    β = {c.estimate.toFixed(4)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {c.sectorInterpretation}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-indigo-600" />
              <h3 className="text-base font-semibold text-slate-900">
                Significancia estadística
              </h3>
            </div>
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <p className="font-medium text-emerald-800">
                  Variables significativas (p &lt; 0.05):
                </p>
                <p className="mt-0.5 text-slate-600">
                  {significantVars.length > 0
                    ? significantVars.map((v) => `${v.term} (p=${v.pValue < 0.0001 ? '<0.0001' : v.pValue.toFixed(4)})`).join(', ')
                    : 'Ninguna variable predictora alcanzó significancia al 5%.'}
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-700">
                  Variables sin significancia individual (p ≥ 0.05):
                </p>
                <p className="mt-0.5 text-slate-600">
                  {nonSignificantVars.length > 0
                    ? nonSignificantVars.map((v) => `${v.term} (p=${v.pValue.toFixed(4)})`).join(', ')
                    : 'Todas las variables predictoras del modelo son estadísticamente significativas.'}
                </p>
              </div>
            </div>
          </div>

          {activeModel.warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-950">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="space-y-1.5">
                  <p className="font-semibold">Advertencias estadísticas del modelo</p>
                  <ul className="list-disc space-y-1 pl-4">
                    {activeModel.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-xs text-emerald-900">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold">Sin alertas de colinealidad o falta de significancia</p>
                  <p className="mt-1">
                    Todas las variables predictoras mantienen VIF controlado y significancia
                    estadística individual.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stepwise Trace if Model 2 */}
      {activeModel.stepwiseTrace && activeModel.stepwiseTrace.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">
            Trazabilidad de selección Stepwise (AIC bidireccional)
          </h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">Paso</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">Acción</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">Variables activas</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">AIC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeModel.stepwiseTrace.map((t) => (
                  <tr key={t.step}>
                    <td className="px-3 py-2 font-mono tabular-nums">{t.step}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{t.action}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {t.predictors.length > 0 ? t.predictors.join(' + ') : '(Solo intercepto)'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-indigo-700">
                      {t.aic.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Best Subsets Table if Model 3 */}
      {activeModel.bestSubsetsTable && activeModel.bestSubsetsTable.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">
            Comparación de mejores subconjuntos por tamaño (Best Subsets · leaps::regsubsets)
          </h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-right text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">k</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">Predictores</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">R²</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">R² Adj.</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">Cp Mallows</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">AIC</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">BIC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {activeModel.bestSubsetsTable.map((row) => (
                  <tr
                    key={row.k}
                    className={row.isOptimal ? 'bg-indigo-50/70 font-semibold' : 'hover:bg-slate-50'}
                  >
                    <td className="px-3 py-2 text-left">{row.k}</td>
                    <td className="px-3 py-2 text-left font-sans text-slate-900">
                      {row.predictors.join(' + ')}
                      {row.isOptimal ? ' (Óptimo BIC)' : ''}
                    </td>
                    <td className="px-3 py-2">{(row.r2 * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2">{(row.adjR2 * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2">{row.mallowsCp.toFixed(2)}</td>
                    <td className="px-3 py-2">{row.aic.toFixed(2)}</td>
                    <td className="px-3 py-2 text-indigo-700">{row.bic.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
