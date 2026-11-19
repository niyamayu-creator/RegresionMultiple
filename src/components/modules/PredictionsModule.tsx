import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Download,
  FileSpreadsheet,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  DescriptiveStats,
  EconomicSector,
  PredictionRecord,
  RegressionModelResult,
} from '../../types/analytics';
import {
  exportPredictionsToCSV,
  exportPredictionsToExcel,
} from '../../lib/data/fileHandlers';

interface PredictionsModuleProps {
  sector: EconomicSector;
  winningModel: RegressionModelResult;
  trainStats: DescriptiveStats[];
  predictions: PredictionRecord[];
  onGeneratePrediction: (inputs: Record<string, number>) => void;
  onClearPredictions: () => void;
  onContinueToScenarios: () => void;
}

export const PredictionsModule: React.FC<PredictionsModuleProps> = ({
  sector,
  winningModel,
  trainStats,
  predictions,
  onGeneratePrediction,
  onClearPredictions,
  onContinueToScenarios,
}) => {
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const pred of winningModel.predictors) {
      const st = trainStats.find((s) => s.column === pred);
      initial[pred] = st ? st.median.toFixed(2) : '0';
    }
    setFormValues(initial);
  }, [winningModel.id, winningModel.predictors.join('|')]);

  const parsedInputs: Record<string, number> = {};
  let hasInvalid = false;
  for (const pred of winningModel.predictors) {
    const num = Number(formValues[pred]);
    if (!Number.isFinite(num) || formValues[pred]?.trim() === '') {
      hasInvalid = true;
    } else {
      parsedInputs[pred] = num;
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasInvalid) return;
    onGeneratePrediction(parsedInputs);
  };

  const latest = predictions[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Módulo 8. Predicciones
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Estima nuevos valores para <strong>{winningModel.target}</strong> usando{' '}
            <strong>{winningModel.name}</strong> con intervalos de predicción al 95%.
          </p>
        </div>
        <button
          type="button"
          onClick={onContinueToScenarios}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
        >
          Ir a Simulación de Escenarios
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Input Form + Latest Result */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5"
        >
          <h2 className="text-base font-semibold text-slate-900">
            Introducir valores de predictores
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Se muestran los rangos mínimos y máximos observados durante el entrenamiento.
          </p>

          <div className="mt-4 space-y-4">
            {winningModel.predictors.map((pred) => {
              const st = trainStats.find((s) => s.column === pred);
              const valNum = Number(formValues[pred]);
              const isOutOfRange =
                st && Number.isFinite(valNum) && (valNum < st.min || valNum > st.max);

              return (
                <div key={pred}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <label htmlFor={`pred-${pred}`} className="font-medium text-slate-800">
                      {pred}
                    </label>
                    {st && (
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        Rango: [{st.min.toFixed(2)}, {st.max.toFixed(2)}]
                      </span>
                    )}
                  </div>
                  <input
                    id={`pred-${pred}`}
                    type="number"
                    step="any"
                    value={formValues[pred] ?? ''}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, [pred]: e.target.value }))
                    }
                    className={`mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm text-slate-900 focus:outline-none ${
                      isOutOfRange
                        ? 'border-amber-400 bg-amber-50/40 focus:border-amber-600'
                        : 'border-slate-300 focus:border-indigo-600'
                    }`}
                  />
                  {isOutOfRange && (
                    <p className="mt-1 text-[11px] text-amber-700">
                      Valor fuera del rango histórico (extrapolación).
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={hasInvalid}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:bg-slate-300"
          >
            <Sparkles className="h-4 w-4" />
            Calcular predicción
          </button>
        </form>

        {/* Latest Prediction Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <h2 className="text-base font-semibold text-slate-900">Resultado de la predicción</h2>
          {latest ? (
            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
                  <p className="text-xs font-medium text-indigo-800">
                    Valor predicho ({winningModel.target})
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {latest.predictedValue.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-600">Intervalo de Predicción 95%</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                    [{latest.piLower.toFixed(2)}, {latest.piUpper.toFixed(2)}]
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Para una observación individual</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-600">Intervalo de Confianza 95%</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                    [{latest.ciLower.toFixed(2)}, {latest.ciUpper.toFixed(2)}]
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Para la media esperada</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                <p className="font-semibold text-slate-900">Interpretación ({sector}):</p>
                <p className="mt-1">{latest.interpretation}</p>
              </div>

              {latest.outOfRangeVars.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Extrapolación detectada en: {latest.outOfRangeVars.join(', ')}. Los intervalos
                    se ensanchan automáticamente al alejarse de los datos de entrenamiento.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
              Ingresa valores en el formulario y presiona &quot;Calcular predicción&quot; para ver el
              resultado e intervalos al 95%.
            </div>
          )}
        </div>
      </div>

      {/* Prediction History + Export */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Historial de predicciones ({predictions.length})
            </h2>
            <p className="text-xs text-slate-500">
              Descarga las estimaciones generadas en Excel o CSV.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={predictions.length === 0}
              onClick={() =>
                exportPredictionsToCSV(predictions, winningModel.target, winningModel.predictors)
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar CSV
            </button>
            <button
              type="button"
              disabled={predictions.length === 0}
              onClick={() =>
                exportPredictionsToExcel(predictions, winningModel.target, winningModel.predictors)
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Descargar Excel
            </button>
            {predictions.length > 0 && (
              <button
                type="button"
                onClick={onClearPredictions}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpiar
              </button>
            )}
          </div>
        </div>

        {predictions.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-right text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">#</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">Hora</th>
                  {winningModel.predictors.map((p) => (
                    <th key={p} className="border-b border-slate-200 px-3 py-2 font-medium">
                      {p}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">
                    Predicción ({winningModel.target})
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">IP 95%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {predictions.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-left text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2 text-left text-slate-600">{p.createdAt}</td>
                    {winningModel.predictors.map((pred) => (
                      <td key={pred} className="px-3 py-2 text-slate-700">
                        {p.inputs[pred].toFixed(2)}
                      </td>
                    ))}
                    <td className="px-3 py-2 font-semibold text-indigo-700">
                      {p.predictedValue.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      [{p.piLower.toFixed(2)}, {p.piUpper.toFixed(2)}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-500">
            Aún no hay predicciones registradas en el historial.
          </p>
        )}
      </div>
    </div>
  );
};
