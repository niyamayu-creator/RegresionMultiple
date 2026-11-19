import React from 'react';
import { AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DescriptiveStats,
  EconomicSector,
  RegressionModelResult,
  ScenarioComputedRow,
  ScenarioPresetKey,
} from '../../types/analytics';

interface ScenariosModuleProps {
  sector: EconomicSector;
  winningModel: RegressionModelResult;
  trainStats: DescriptiveStats[];
  computedScenarios: ScenarioComputedRow[];
  onUpdateScenarioInput: (
    scenarioKey: ScenarioPresetKey,
    variable: string,
    value: number
  ) => void;
  onResetScenarios: () => void;
  onContinueToReport: () => void;
}

const SCENARIO_COLORS: Record<ScenarioPresetKey, string> = {
  pesimista: '#e11d48',
  conservador: '#d97706',
  moderado: '#475569',
  optimista: '#059669',
  personalizado: '#4f46e5',
};

export const ScenariosModule: React.FC<ScenariosModuleProps> = ({
  sector,
  winningModel,
  trainStats,
  computedScenarios,
  onUpdateScenarioInput,
  onResetScenarios,
  onContinueToReport,
}) => {
  const baseRow = computedScenarios.find((s) => s.key === 'moderado');
  const chartData = computedScenarios.map((sc) => ({
    key: sc.key,
    name: sc.label.replace('Escenario ', '').replace(' (Base)', ' (Base)'),
    Predicción: Number(sc.predictedValue.toFixed(2)),
  }));

  const anyOutOfRange = computedScenarios.some((s) => s.outOfRangeVars.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Módulo 9. Simulación de Escenarios
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Simula cinco escenarios para <strong>{winningModel.target}</strong> usando{' '}
            <strong>{winningModel.name}</strong> y compara variaciones frente al escenario base.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetScenarios}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restablecer valores
          </button>
          <button
            type="button"
            onClick={onContinueToReport}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
          >
            Generar Informe Final
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {anyOutOfRange && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Advertencia de valores fuera del rango observado</p>
            <p className="mt-0.5">
              Uno o más escenarios utilizan valores que exceden el mínimo o máximo registrado en el
              entrenamiento. Interpreta esos resultados con cautela por tratarse de extrapolación.
            </p>
          </div>
        </div>
      )}

      {/* Interactive Scenario Editors */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {computedScenarios.map((sc) => (
          <div
            key={sc.key}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">{sc.label}</h2>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">{sc.description}</p>

              <div className="mt-4 space-y-2.5">
                {winningModel.predictors.map((pred) => {
                  const st = trainStats.find((s) => s.column === pred);
                  const val = sc.inputs[pred] ?? 0;
                  const outOfRange = st ? val < st.min || val > st.max : false;

                  return (
                    <div key={pred}>
                      <div className="flex items-center justify-between text-[11px]">
                        <label
                          htmlFor={`sc-${sc.key}-${pred}`}
                          className="truncate font-medium text-slate-700"
                          title={pred}
                        >
                          {pred}
                        </label>
                        {st && (
                          <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                            [{st.min.toFixed(1)}–{st.max.toFixed(1)}]
                          </span>
                        )}
                      </div>
                      <input
                        id={`sc-${sc.key}-${pred}`}
                        type="number"
                        step="any"
                        value={Number.isFinite(val) ? val : ''}
                        onChange={(e) => {
                          const parsed = Number(e.target.value);
                          if (Number.isFinite(parsed)) {
                            onUpdateScenarioInput(sc.key, pred, parsed);
                          }
                        }}
                        className={`mt-1 w-full rounded-md border px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:outline-none ${
                          outOfRange
                            ? 'border-amber-400 bg-amber-50/50 focus:border-amber-600'
                            : 'border-slate-300 focus:border-indigo-600'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-[11px] text-slate-500">Predicción ({winningModel.target})</p>
              <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {sc.predictedValue.toFixed(2)}
              </p>
              <p
                className={`font-mono text-[11px] font-medium tabular-nums ${
                  sc.key === 'moderado'
                    ? 'text-slate-500'
                    : sc.diffFromBase >= 0
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }`}
              >
                {sc.key === 'moderado'
                  ? 'Referencia base (0.0%)'
                  : `${sc.diffFromBase >= 0 ? '+' : ''}${sc.diffFromBase.toFixed(2)} (${
                      sc.pctChangeFromBase >= 0 ? '+' : ''
                    }${sc.pctChangeFromBase.toFixed(1)}%)`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Comparative Chart + Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <h2 className="text-base font-semibold text-slate-900">
            Comparativo visual de escenarios
          </h2>
          <p className="text-xs text-slate-500">
            Proyección estimada de {winningModel.target} frente a la línea base moderada.
          </p>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 16, left: -8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                {baseRow && (
                  <ReferenceLine
                    y={baseRow.predictedValue}
                    stroke="#475569"
                    strokeDasharray="4 4"
                  />
                )}
                <Bar dataKey="Predicción" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={SCENARIO_COLORS[entry.key as ScenarioPresetKey]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <h2 className="text-base font-semibold text-slate-900">
            Tabla comparativa de resultados ({sector})
          </h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-right text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-left font-medium">
                    Escenario
                  </th>
                  {winningModel.predictors.map((p) => (
                    <th key={p} className="border-b border-slate-200 px-3 py-2.5 font-medium">
                      {p}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-3 py-2.5 font-medium">
                    Predicción
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Dif. Base</th>
                  <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Var. %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {computedScenarios.map((sc) => (
                  <tr key={sc.key} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-left font-sans font-semibold text-slate-900">
                      {sc.label}
                      {sc.outOfRangeVars.length > 0 && (
                        <span className="ml-1.5 text-[10px] font-medium text-amber-700">
                          · Extrapolación
                        </span>
                      )}
                    </td>
                    {winningModel.predictors.map((p) => (
                      <td key={p} className="px-3 py-2.5 text-slate-700">
                        {(sc.inputs[p] ?? 0).toFixed(2)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      {sc.predictedValue.toFixed(2)}
                    </td>
                    <td
                      className={`px-3 py-2.5 ${
                        sc.key === 'moderado'
                          ? 'text-slate-500'
                          : sc.diffFromBase >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {sc.diffFromBase >= 0 && sc.key !== 'moderado' ? '+' : ''}
                      {sc.diffFromBase.toFixed(2)}
                    </td>
                    <td
                      className={`px-3 py-2.5 font-semibold ${
                        sc.key === 'moderado'
                          ? 'text-slate-500'
                          : sc.pctChangeFromBase >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {sc.pctChangeFromBase >= 0 && sc.key !== 'moderado' ? '+' : ''}
                      {sc.pctChangeFromBase.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sector Interpretations */}
          <div className="mt-4 space-y-2">
            {computedScenarios.map((sc) => (
              <p
                key={sc.key}
                className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700"
              >
                {sc.interpretation}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
