import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DiagnosticSummary,
  ModelId,
  RegressionModelResult,
} from '../../types/analytics';

interface DiagnosticsModuleProps {
  models: RegressionModelResult[];
  diagnostics: Record<ModelId, DiagnosticSummary>;
  onContinueToEvaluation: () => void;
}

export const DiagnosticsModule: React.FC<DiagnosticsModuleProps> = ({
  models,
  diagnostics,
  onContinueToEvaluation,
}) => {
  const [selectedId, setSelectedId] = useState<ModelId>(models[1]?.id ?? models[0]?.id ?? 'model0');
  const activeModel = models.find((m) => m.id === selectedId) ?? models[0];
  const diag = activeModel ? diagnostics[activeModel.id] : undefined;

  const { qqData, qqLine } = useMemo(() => {
    if (!activeModel) return { qqData: [], qqLine: [] };
    const pts = [...activeModel.observations]
      .sort((a, b) => a.theoreticalQuantile - b.theoreticalQuantile)
      .map((o) => ({
        x: Number(o.theoreticalQuantile.toFixed(4)),
        y: Number(o.standardizedResidual.toFixed(4)),
        index: o.index,
      }));
    if (pts.length < 2) return { qqData: pts, qqLine: [] };
    const minQ = pts[0].x;
    const maxQ = pts[pts.length - 1].x;
    return {
      qqData: pts,
      qqLine: [
        { x: minQ, lineY: minQ },
        { x: maxQ, lineY: maxQ },
      ],
    };
  }, [activeModel]);

  if (!activeModel || !diag) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Construye los modelos de regresión para visualizar los diagnósticos estadísticos.
      </div>
    );
  }

  const residVsFittedData = activeModel.observations.map((o) => ({
    fitted: Number(o.fitted.toFixed(3)),
    residual: Number(o.residual.toFixed(3)),
    index: o.index,
  }));

  const scaleLocationData = activeModel.observations.map((o) => ({
    fitted: Number(o.fitted.toFixed(3)),
    sqrtAbs: Number(o.sqrtAbsStdResidual.toFixed(4)),
    index: o.index,
  }));

  const leverageData = activeModel.observations.map((o) => ({
    leverage: Number(o.leverage.toFixed(4)),
    stdRes: Number(o.standardizedResidual.toFixed(4)),
    cooksD: Number(o.cooksDistance.toFixed(4)),
    index: o.index,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Módulo 6. Diagnóstico de Modelos
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Verificación de linealidad, normalidad, homocedasticidad, independencia de errores y
            multicolinealidad.
          </p>
        </div>
        <button
          type="button"
          onClick={onContinueToEvaluation}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
        >
          Ir a Evaluación en Prueba
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Model switcher */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 w-fit">
        {models.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedId(m.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              m.id === activeModel.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {m.shortLabel}
          </button>
        ))}
      </div>

      {/* Statistical Tests Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Durbin-Watson */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Prueba Durbin-Watson</h2>
            <span
              className={`text-xs font-medium ${
                diag.durbinWatson.status === 'Adecuado'
                  ? 'text-emerald-700'
                  : diag.durbinWatson.status === 'Precaución'
                  ? 'text-amber-700'
                  : 'text-rose-700'
              }`}
            >
              {diag.durbinWatson.status}
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            DW = {diag.durbinWatson.statistic.toFixed(3)}
          </p>
          <p className="font-mono text-xs text-slate-500 tabular-nums">
            p ≈ {diag.durbinWatson.pValue.toFixed(4)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            {diag.durbinWatson.interpretation}
          </p>
        </div>

        {/* Breusch-Pagan */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Prueba Breusch-Pagan</h2>
            <span
              className={`text-xs font-medium ${
                diag.breuschPagan.status === 'Homocedasticidad'
                  ? 'text-emerald-700'
                  : 'text-amber-700'
              }`}
            >
              {diag.breuschPagan.status}
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            BP = {diag.breuschPagan.statistic.toFixed(3)}
          </p>
          <p className="font-mono text-xs text-slate-500 tabular-nums">
            gl = {diag.breuschPagan.df} · p = {diag.breuschPagan.pValue.toFixed(4)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            {diag.breuschPagan.interpretation}
          </p>
        </div>

        {/* Shapiro-Wilk */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Prueba Shapiro-Wilk</h2>
            <span
              className={`text-xs font-medium ${
                diag.shapiroWilk.status === 'Normalidad' ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {diag.shapiroWilk.status}
            </span>
          </div>
          <p className="mt-2 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            W = {diag.shapiroWilk.statistic.toFixed(4)}
          </p>
          <p className="font-mono text-xs text-slate-500 tabular-nums">
            p = {diag.shapiroWilk.pValue < 0.0001 ? '< 0.0001' : diag.shapiroWilk.pValue.toFixed(4)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            {diag.shapiroWilk.interpretation}
          </p>
        </div>
      </div>

      {/* VIF & Cook's Distance */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Factor de Inflación de la Varianza (VIF) e Influencia (Cook&apos;s D)
            </h2>
            <p className="text-xs text-slate-500">
              VIF &lt; 5 indica colinealidad baja; entre 5 y 10 moderada; &gt; 10 severa. Distancia de
              Cook máxima observada:{' '}
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {diag.maxCooksD.toFixed(4)}
              </span>{' '}
              ({diag.influentialCount} puntos potencialmente influyentes).
            </p>
          </div>
          {diag.hasSevereIssues ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              Requiere atención estadística
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Sin problemas críticos
            </span>
          )}
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 font-medium">Variable predictora</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right font-medium">VIF</th>
                <th className="border-b border-slate-200 px-3 py-2 font-medium">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diag.vifSummary.map((v) => (
                <tr key={v.variable}>
                  <td className="px-3 py-2 font-medium text-slate-900">{v.variable}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {v.vif.toFixed(3)}
                  </td>
                  <td
                    className={`px-3 py-2 font-medium ${
                      v.status === 'Bajo (< 5)'
                        ? 'text-emerald-700'
                        : v.status === 'Moderado (5 - 10)'
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {v.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4 Diagnostic Plots (replicating R plot(lm)) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Residuals vs Fitted */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            1. Residuos frente a valores ajustados
          </h3>
          <p className="text-xs text-slate-500">
            Debe mostrar dispersión aleatoria alrededor de 0 sin patrones curvos o en embudo.
          </p>
          <div className="mt-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, left: -8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="fitted"
                  name="Ajustado"
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  label={{ value: 'Valores ajustados', position: 'insideBottom', offset: -8, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="residual"
                  name="Residuo"
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <ReferenceLine y={0} stroke="#0f172a" strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                />
                <Scatter data={residVsFittedData} fill="#4f46e5" fillOpacity={0.75} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Normal Q-Q Plot */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">2. Gráfico Q-Q de normalidad</h3>
          <p className="text-xs text-slate-500">
            Los residuos estandarizados deben alinearse sobre la diagonal de referencia normal.
          </p>
          <div className="mt-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 10, right: 16, left: -8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Cuantil teórico"
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  label={{ value: 'Cuantiles teóricos N(0,1)', position: 'insideBottom', offset: -8, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Residuo est."
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Scatter name="Observación" data={qqData} fill="#0f766e" fillOpacity={0.78} />
                <Line
                  data={qqLine}
                  dataKey="lineY"
                  type="linear"
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Scale-Location */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">3. Escala-Localización</h3>
          <p className="text-xs text-slate-500">
            Raíz de residuos estandarizados absolutos vs. ajustados para verificar homocedasticidad.
          </p>
          <div className="mt-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, left: -8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="fitted"
                  name="Ajustado"
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  label={{ value: 'Valores ajustados', position: 'insideBottom', offset: -8, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="sqrtAbs"
                  name="√|Residuo est.|"
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Scatter data={scaleLocationData} fill="#d97706" fillOpacity={0.75} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Residuals vs Leverage */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">4. Residuos frente a Leverage</h3>
          <p className="text-xs text-slate-500">
            Identifica observaciones con alto apalancamiento y posible influencia extrema sobre la recta.
          </p>
          <div className="mt-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, left: -8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="leverage"
                  name="Leverage (h)"
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  label={{ value: 'Leverage (h_ii)', position: 'insideBottom', offset: -8, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="stdRes"
                  name="Residuo est."
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <ReferenceLine y={0} stroke="#0f172a" strokeDasharray="4 4" />
                <ReferenceLine y={2} stroke="#cbd5e1" strokeDasharray="2 2" />
                <ReferenceLine y={-2} stroke="#cbd5e1" strokeDasharray="2 2" />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Scatter data={leverageData} fill="#be123c" fillOpacity={0.75} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
