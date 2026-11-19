import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Filter,
  Info,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CorrelationPair,
  DatasetSummary,
  DescriptiveStats,
  EconomicSector,
} from '../../types/analytics';
import {
  computeHistogram,
  generateExploratoryNarrative,
} from '../../lib/stats/descriptive';
import { BoxplotChart } from '../charts/BoxplotChart';
import { CorrelationHeatmap } from '../charts/CorrelationHeatmap';

interface ExploratoryModuleProps {
  sector: EconomicSector;
  dataset: DatasetSummary;
  descriptiveStats: DescriptiveStats[];
  correlationMatrix: number[][];
  correlationPairs: CorrelationPair[];
  numericColumns: string[];
  excludedPredictors: string[];
  onToggleExcludePredictor: (col: string) => void;
  onContinueToVariables: () => void;
}

export const ExploratoryModule: React.FC<ExploratoryModuleProps> = ({
  sector,
  dataset,
  descriptiveStats,
  correlationMatrix,
  correlationPairs,
  numericColumns,
  excludedPredictors,
  onToggleExcludePredictor,
  onContinueToVariables,
}) => {
  const [selectedProducts, setSelectedProducts] = useState<string[]>(numericColumns);
  const [histVar, setHistVar] = useState<string>(numericColumns[0] ?? '');
  const [histBins, setHistBins] = useState<number>(10);
  const [scatterX, setScatterX] = useState<string>(numericColumns[0] ?? '');
  const [scatterY, setScatterY] = useState<string>(
    numericColumns[1] ?? numericColumns[0] ?? ''
  );

  // Sync if dataset changed
  const activeProducts = useMemo(() => {
    const valid = selectedProducts.filter((p) => numericColumns.includes(p));
    return valid.length > 0 ? valid : numericColumns;
  }, [selectedProducts, numericColumns]);

  const activeHistVar = numericColumns.includes(histVar)
    ? histVar
    : activeProducts[0] ?? numericColumns[0] ?? '';

  const activeScatterX = numericColumns.includes(scatterX)
    ? scatterX
    : activeProducts[0] ?? numericColumns[0] ?? '';
  const activeScatterY = numericColumns.includes(scatterY)
    ? scatterY
    : activeProducts[1] ?? activeProducts[0] ?? numericColumns[0] ?? '';

  const toggleProductFilter = (col: string) => {
    setSelectedProducts((prev) => {
      const current = prev.filter((p) => numericColumns.includes(p));
      if (current.includes(col)) {
        if (current.length <= 1) return current; // keep at least one
        return current.filter((p) => p !== col);
      }
      return [...current, col];
    });
  };

  const narrative = useMemo(
    () => generateExploratoryNarrative(sector, descriptiveStats, correlationPairs),
    [sector, descriptiveStats, correlationPairs]
  );

  const histogramData = useMemo(
    () => (activeHistVar ? computeHistogram(dataset.rows, activeHistVar, histBins) : []),
    [dataset.rows, activeHistVar, histBins]
  );

  const { scatterPoints, trendLinePoints, scatterR } = useMemo(() => {
    if (!activeScatterX || !activeScatterY) {
      return { scatterPoints: [], trendLinePoints: [], scatterR: 0 };
    }
    const pts: Array<{ x: number; y: number; rowIndex: number }> = [];
    dataset.rows.forEach((r, idx) => {
      const xv = r[activeScatterX];
      const yv = r[activeScatterY];
      if (typeof xv === 'number' && Number.isFinite(xv) && typeof yv === 'number' && Number.isFinite(yv)) {
        pts.push({ x: xv, y: yv, rowIndex: idx + 1 });
      }
    });

    if (pts.length < 2) {
      return { scatterPoints: pts, trendLinePoints: [], scatterR: 0 };
    }

    const n = pts.length;
    const meanX = pts.reduce((s, p) => s + p.x, 0) / n;
    const meanY = pts.reduce((s, p) => s + p.y, 0) / n;
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (const p of pts) {
      const dx = p.x - meanX;
      const dy = p.y - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    const slope = denX > 0 ? num / denX : 0;
    const intercept = meanY - slope * meanX;
    const r = Math.sqrt(denX * denY) > 0 ? num / Math.sqrt(denX * denY) : 0;

    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const linePts = [
      { x: minX, trendY: intercept + slope * minX },
      { x: maxX, trendY: intercept + slope * maxX },
    ];

    return { scatterPoints: pts, trendLinePoints: linePts, scatterR: r };
  }, [dataset.rows, activeScatterX, activeScatterY]);

  const filteredStats = descriptiveStats.filter((s) => activeProducts.includes(s.column));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Módulo 2. Análisis Exploratorio de Datos
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Estadísticos descriptivos, distribuciones, diagramas de caja, dispersión y análisis de
            correlaciones para el sector {sector}.
          </p>
        </div>
        <button
          type="button"
          onClick={onContinueToVariables}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
        >
          Ir a Selección de Variables
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Product / Variable Interactive Filter */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <Filter className="h-4 w-4 text-indigo-600" />
            <span>Filtrar visualizaciones por producto / variable:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedProducts(numericColumns)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeProducts.length === numericColumns.length
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todas ({numericColumns.length})
            </button>
            {numericColumns.map((col) => {
              const active = activeProducts.includes(col);
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => {
                    toggleProductFilter(col);
                    setHistVar(col);
                  }}
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {active && <Check className="h-3 w-3" />}
                  {col}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sector Narrative Interpretation */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">
              Interpretación exploratoria ({sector})
            </h2>
            <p className="text-sm leading-relaxed text-slate-700">{narrative.summaryParagraph}</p>
            <ul className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-slate-600 md:grid-cols-2">
              {narrative.variableInsights.map((line, i) => (
                <li key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Multicollinearity Warning & Variable Keep/Drop Decision */}
      {narrative.collinearityAlerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-base font-semibold text-amber-950">
                  Alerta de posible multicolinealidad (|r| &gt; 0.60)
                </h2>
                <p className="mt-1 text-xs text-amber-900">
                  Se detectaron correlaciones elevadas entre pares de variables. Si ambas actúan como
                  predictores, pueden inflar el VIF y distorsionar los errores estándar. Puedes
                  decidir desde aquí qué variables excluir del conjunto de predictores candidatos:
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {narrative.collinearityAlerts.map((pair) => (
                  <div
                    key={`${pair.varA}-${pair.varB}`}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-slate-900">
                      {pair.varA} ↔ {pair.varB}
                    </span>
                    <span className="font-mono font-semibold text-amber-700 tabular-nums">
                      r = {pair.r.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-1">
                <p className="mb-2 text-xs font-medium text-amber-950">
                  Decisión de variables a conservar o excluir como predictores:
                </p>
                <div className="flex flex-wrap gap-2">
                  {numericColumns.map((col) => {
                    const isExcluded = excludedPredictors.includes(col);
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => onToggleExcludePredictor(col)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          isExcluded
                            ? 'border-rose-300 bg-rose-50 text-rose-800 line-through'
                            : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50'
                        }`}
                      >
                        {col}: {isExcluded ? 'Excluida' : 'Conservar'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Descriptive Statistics Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Estadísticas descriptivas completas
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Equivalente a <span className="font-mono">summary()</span> y{' '}
          <span className="font-mono">psych::describe()</span> en RStudio.
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-right text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2.5 text-left font-medium">Variable</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">N</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Mín</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Q1 (25%)</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Mediana</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Media</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Q3 (75%)</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Máx</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Desv. Est.</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Rango</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Asimetría</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Curtosis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {filteredStats.map((s) => (
                <tr key={s.column} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 text-left font-sans font-semibold text-slate-900">
                    {s.column}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{s.n}</td>
                  <td className="px-3 py-2.5 text-slate-700">{s.min.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-slate-700">{s.q1.toFixed(2)}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">{s.median.toFixed(2)}</td>
                  <td className="px-3 py-2.5 font-semibold text-indigo-700">{s.mean.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-slate-700">{s.q3.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-slate-700">{s.max.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-slate-700">{s.stdDev.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-slate-700">{s.range.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-slate-700">{s.skewness.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-slate-700">{s.kurtosis.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Grid: Histogram + Boxplot */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Histogram */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Histograma de distribución</h2>
              <p className="text-xs text-slate-500">Frecuencia por intervalos para {activeHistVar}.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={activeHistVar}
                onChange={(e) => setHistVar(e.target.value)}
                aria-label="Variable del histograma"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              >
                {activeProducts.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={histBins}
                onChange={(e) => setHistBins(Number(e.target.value))}
                aria-label="Número de intervalos"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              >
                {[6, 8, 10, 12, 15].map((b) => (
                  <option key={b} value={b}>
                    {b} barras
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 10, right: 12, left: -12, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#475569' }}
                  angle={-25}
                  textAnchor="end"
                  height={48}
                />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  formatter={(val: unknown) => [`${val} registros`, 'Frecuencia']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Boxplot */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">Diagramas de caja comparativos</h2>
          <div className="mt-2">
            <BoxplotChart stats={descriptiveStats} selectedVariables={activeProducts} />
          </div>
        </div>
      </div>

      {/* Scatter Plot + Correlation Matrix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Scatter Plot */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Gráfico de dispersión bivariado
              </h2>
              <p className="text-xs text-slate-500">
                Correlación lineal observada:{' '}
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  r = {scatterR.toFixed(4)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <select
                value={activeScatterX}
                onChange={(e) => setScatterX(e.target.value)}
                aria-label="Eje X"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
              >
                {numericColumns.map((c) => (
                  <option key={c} value={c}>
                    X: {c}
                  </option>
                ))}
              </select>
              <select
                value={activeScatterY}
                onChange={(e) => setScatterY(e.target.value)}
                aria-label="Eje Y"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
              >
                {numericColumns.map((c) => (
                  <option key={c} value={c}>
                    Y: {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 12, right: 16, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={activeScatterX}
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  label={{
                    value: activeScatterX,
                    position: 'insideBottom',
                    offset: -8,
                    fontSize: 11,
                    fill: '#475569',
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={activeScatterY}
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value: unknown, name: unknown) => [
                    typeof value === 'number' ? value.toFixed(2) : String(value),
                    String(name === 'trendY' ? 'Tendencia OLS' : name),
                  ]}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Scatter
                  name={activeScatterY}
                  data={scatterPoints}
                  fill="#4f46e5"
                  fillOpacity={0.72}
                />
                <Line
                  data={trendLinePoints}
                  type="linear"
                  dataKey="trendY"
                  stroke="#0f172a"
                  strokeWidth={2}
                  dot={false}
                  activeDot={false}
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Correlation Matrix */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <h2 className="text-base font-semibold text-slate-900">Matriz de correlaciones</h2>
          <div className="mt-2">
            <CorrelationHeatmap
              variables={numericColumns}
              matrix={correlationMatrix}
              onSelectPair={(a, b) => {
                setScatterX(a);
                setScatterY(b);
              }}
            />
          </div>
        </div>
      </div>

      {/* Potential Relationships Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Relaciones potenciales identificadas entre variables
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Pares ordenados por intensidad de correlación lineal |r| y prueba de significancia t-Student.
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Par de variables</th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-right font-medium">Correlación (r)</th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-right font-medium">Valor p</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Intensidad y dirección</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {correlationPairs.map((pair) => {
                const strength =
                  pair.absR >= 0.7
                    ? 'Fuerte'
                    : pair.absR >= 0.4
                    ? 'Moderada'
                    : pair.absR >= 0.2
                    ? 'Débil'
                    : 'Muy débil';
                const dir = pair.r >= 0 ? 'positiva' : 'negativa';

                return (
                  <tr
                    key={`${pair.varA}-${pair.varB}`}
                    onClick={() => {
                      setScatterX(pair.varA);
                      setScatterY(pair.varB);
                    }}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {pair.varA} ↔ {pair.varB}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {pair.r.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                      {pair.pValue < 0.0001 ? '< 0.0001' : pair.pValue.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {strength} ({dir})
                    </td>
                    <td className="px-3 py-2.5">
                      {pair.isHighCollinearity ? (
                        <span className="font-medium text-amber-700">
                          |r| &gt; 0.60 · Posible multicolinealidad
                        </span>
                      ) : pair.pValue < 0.05 ? (
                        <span className="text-emerald-700">Relación lineal significativa</span>
                      ) : (
                        <span className="text-slate-500">Sin relación lineal significativa</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
