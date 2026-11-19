import React, { useState } from 'react';
import { ArrowRight, Award, CheckCircle2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EvaluationComparison, ModelId } from '../../types/analytics';

interface EvaluationModuleProps {
  evaluation: EvaluationComparison;
  target: string;
  selectedWinningModelId: ModelId;
  onSelectWinningModel: (id: ModelId) => void;
  onContinueToPredictions: () => void;
}

export const EvaluationModule: React.FC<EvaluationModuleProps> = ({
  evaluation,
  target,
  selectedWinningModelId,
  onSelectWinningModel,
  onContinueToPredictions,
}) => {
  const [inspectModelId, setInspectModelId] = useState<ModelId>(selectedWinningModelId);

  const errorChartData = evaluation.metrics.map((m) => ({
    name: m.modelName.replace('Modelo ', 'M').split(':')[0],
    fullName: m.modelName,
    RMSE: Number(m.rmse.toFixed(4)),
    MAE: Number(m.mae.toFixed(4)),
    MSE: Number(m.mse.toFixed(4)),
  }));

  const inspected =
    evaluation.metrics.find((m) => m.modelId === inspectModelId) ?? evaluation.metrics[0];

  const actualVsPredData =
    inspected?.predictions.slice(0, 60).map((p) => ({
      caso: `#${p.index}`,
      Real: Number(p.actual.toFixed(2)),
      Predicho: Number(p.predicted.toFixed(2)),
    })) ?? [];

  const recommendedModel = evaluation.metrics.find(
    (m) => m.modelId === evaluation.winningModelId
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Módulo 7. Evaluación y Comparación en Prueba (Data Test)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Métricas predictivas calculadas exclusivamente sobre los {inspected?.nTest ?? 0}{' '}
            registros de validación fuera de muestra.
          </p>
        </div>
        <button
          type="button"
          onClick={onContinueToPredictions}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
        >
          Generar Predicciones
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Winning Model Selection Explanation */}
      {recommendedModel && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-6">
          <div className="flex items-start gap-3">
            <Award className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-emerald-800">
                Modelo recomendado automáticamente
              </p>
              <h2 className="text-lg font-bold text-slate-900">{recommendedModel.modelName}</h2>
              <p className="text-xs leading-relaxed text-slate-700">
                {evaluation.selectionReason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Comparative Metrics Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Tabla comparativa de desempeño (Data Test)
            </h2>
            <p className="text-xs text-slate-500">
              Haz clic en &quot;Activar&quot; si deseas cambiar el modelo usado para predicciones y escenarios.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-right text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2.5 text-left font-medium">Modelo</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Predictores</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">MAE (Test)</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">MSE (Test)</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">RMSE (Test)</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">R² Adj. (Train)</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-medium">VIF Máx.</th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-left font-medium">Supuestos</th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-center font-medium">Activo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {evaluation.metrics.map((m) => {
                const isSelected = m.modelId === selectedWinningModelId;
                const isRecommended = m.modelId === evaluation.winningModelId;
                return (
                  <tr
                    key={m.modelId}
                    className={isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}
                  >
                    <td className="px-3 py-2.5 text-left font-sans">
                      <span className="font-semibold text-slate-900">{m.modelName}</span>
                      {isRecommended && (
                        <span className="ml-2 text-[11px] font-medium text-emerald-700">
                          · Recomendado
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{m.predictorsCount}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{m.mae.toFixed(3)}</td>
                    <td className="px-3 py-2.5 text-slate-700">{m.mse.toFixed(3)}</td>
                    <td className="px-3 py-2.5 font-semibold text-indigo-700">
                      {m.rmse.toFixed(3)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {(m.trainAdjR2 * 100).toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{m.maxVif.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-left font-sans">
                      {m.hasSevereStatisticalIssues ? (
                        <span className="font-medium text-rose-700">Alertas severas</span>
                      ) : (
                        <span className="text-emerald-700">Sin alertas graves</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center font-sans">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          En uso
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectWinningModel(m.modelId);
                            setInspectModelId(m.modelId);
                          }}
                          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Activar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts: Error Comparison + Real vs Predicted */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">
            Comparación de errores de predicción (RMSE y MAE)
          </h3>
          <p className="text-xs text-slate-500">Menor altura indica mayor precisión predictiva en prueba.</p>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={errorChartData} margin={{ top: 10, right: 16, left: -8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="RMSE" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="MAE" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Valor real vs. predicho en prueba ({target})
              </h3>
              <p className="text-xs text-slate-500">
                Muestra hasta 60 registros del conjunto de validación.
              </p>
            </div>
            <select
              value={inspectModelId}
              onChange={(e) => setInspectModelId(e.target.value as ModelId)}
              aria-label="Modelo inspeccionado"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
            >
              {evaluation.metrics.map((m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.modelName}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={actualVsPredData} margin={{ top: 10, right: 16, left: -8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="caso" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="Real"
                  stroke="#0f172a"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="Predicho"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
