import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CorrelationPair,
  DatasetSummary,
  EconomicSector,
  SplitConfig,
  TargetSuggestion,
} from '../../types/analytics';

interface VariableSelectionModuleProps {
  sector: EconomicSector;
  dataset: DatasetSummary;
  suggestion: TargetSuggestion | null;
  target: string;
  targetConfirmed: boolean;
  predictors: string[];
  simplePredictor: string;
  excludedPredictors: string[];
  correlationPairs: CorrelationPair[];
  splitConfig: SplitConfig;
  onSelectTarget: (col: string, confirm?: boolean) => void;
  onConfirmSuggestion: () => void;
  onTogglePredictor: (col: string) => void;
  onChangeSimplePredictor: (col: string) => void;
  onChangeSplitConfig: (config: SplitConfig) => void;
  onBuildModels: () => void;
}

export const VariableSelectionModule: React.FC<VariableSelectionModuleProps> = ({
  sector,
  dataset,
  suggestion,
  target,
  targetConfirmed,
  predictors,
  simplePredictor,
  excludedPredictors,
  correlationPairs,
  splitConfig,
  onSelectTarget,
  onConfirmSuggestion,
  onTogglePredictor,
  onChangeSimplePredictor,
  onChangeSplitConfig,
  onBuildModels,
}) => {
  const numericCols = dataset.columns.filter((c) => c.isNumeric && !c.hasZeroVariance);
  const selectedCols = target ? [target, ...predictors] : [];

  // Count complete rows across selected variables
  const completeRowsCount =
    selectedCols.length > 0
      ? dataset.rows.filter((r) =>
          selectedCols.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number))
        ).length
      : dataset.rowCount;
  const incompleteRowsCount = dataset.rowCount - completeRowsCount;

  const missingInSelected = dataset.columns
    .filter((c) => selectedCols.includes(c.name) && c.missingCount > 0)
    .map((c) => `${c.name} (${c.missingCount})`);

  const highPredictorPairs = correlationPairs.filter(
    (p) => p.isHighCollinearity && predictors.includes(p.varA) && predictors.includes(p.varB)
  );

  const trainCount = Math.max(
    1,
    Math.min(completeRowsCount - 1, Math.floor(splitConfig.trainRatio * completeRowsCount))
  );
  const testCount = Math.max(0, completeRowsCount - trainCount);

  const validationErrors: string[] = [];
  if (!target || !targetConfirmed) {
    validationErrors.push('Debes seleccionar y confirmar la variable dependiente (Y).');
  }
  if (predictors.length === 0) {
    validationErrors.push('Selecciona al menos 1 variable independiente (X).');
  }
  if (completeRowsCount <= predictors.length + 3) {
    validationErrors.push(
      `No hay suficientes registros completos (${completeRowsCount}) para estimar ${predictors.length} predictores con división entrenamiento/prueba.`
    );
  }
  if (missingInSelected.length > 0 && splitConfig.handleMissing === 'block') {
    validationErrors.push(
      `Existen valores faltantes en: ${missingInSelected.join(', ')}. Habilita la omisión de filas incompletas o limpia tu archivo.`
    );
  }
  if (trainCount <= predictors.length + 1 || testCount < 1) {
    validationErrors.push(
      'La proporción de división deja muy pocos registros en entrenamiento o prueba.'
    );
  }

  const canBuild = validationErrors.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Módulos 3 y 4. Selección de Variables y División de Datos
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Define la variable objetivo (Y), las variables independientes (X) y la partición
            reproducible Entrenamiento / Prueba.
          </p>
        </div>
        <button
          type="button"
          disabled={!canBuild}
          onClick={onBuildModels}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 ${
            canBuild
              ? 'bg-indigo-600 hover:bg-indigo-700'
              : 'cursor-not-allowed bg-slate-300'
          }`}
        >
          Construir modelos de regresión
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Automatic Target Recommendation (Requires User Confirmation) */}
      {suggestion && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-indigo-700">
                  Sugerencia automática · Confianza {suggestion.confidenceLabel} · Sector {sector}
                </p>
                <h2 className="text-base font-semibold text-slate-900">
                  Variable objetivo recomendada: {suggestion.suggestedTarget}
                </h2>
                <p className="text-xs leading-relaxed text-slate-700">{suggestion.reason}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onConfirmSuggestion}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="h-4 w-4" />
              {target === suggestion.suggestedTarget && targetConfirmed
                ? 'Sugerencia confirmada'
                : 'Confirmar variable sugerida'}
            </button>
          </div>
        </div>
      )}

      {/* Variable Selection Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Dependent Variable (Y) */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <h2 className="text-base font-semibold text-slate-900">
            1. Variable dependiente a predecir (Y)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Selecciona una variable numérica con varianza para modelar y confirmar tu selección.
          </p>

          <div className="mt-4 space-y-2">
            {dataset.columns.map((col) => {
              const disabled = !col.isNumeric || col.hasZeroVariance;
              const isSelected = target === col.name;
              return (
                <button
                  key={col.name}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectTarget(col.name, true)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors ${
                    isSelected && targetConfirmed
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-950'
                      : isSelected
                      ? 'border-amber-400 bg-amber-50 text-amber-950'
                      : disabled
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="font-semibold">{col.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {col.typeLabel} · {col.validCount} válidos
                      {col.missingCount > 0 ? ` · ${col.missingCount} faltantes` : ''}
                    </p>
                  </div>
                  <span className="font-medium whitespace-nowrap">
                    {isSelected && targetConfirmed
                      ? 'Confirmada'
                      : isSelected
                      ? 'Pendiente confirmar'
                      : disabled
                      ? 'No apta'
                      : 'Elegir'}
                  </span>
                </button>
              );
            })}
          </div>

          {target && !targetConfirmed && (
            <button
              type="button"
              onClick={() => onSelectTarget(target, true)}
              className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              Confirmar "{target}" como variable dependiente
            </button>
          )}
        </div>

        {/* Independent Variables (X) */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                2. Variables independientes / predictoras (X)
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Selecciona las variables explicativas para el modelo múltiple, Stepwise y Best Subsets.
              </p>
            </div>
            <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
              {predictors.length} seleccionadas
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {numericCols
              .filter((c) => c.name !== target)
              .map((col) => {
                const isSelected = predictors.includes(col.name);
                const wasExcludedInEDA = excludedPredictors.includes(col.name);
                const corrWithTarget = correlationPairs.find(
                  (p) =>
                    (p.varA === target && p.varB === col.name) ||
                    (p.varB === target && p.varA === col.name)
                );

                return (
                  <label
                    key={col.name}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-xs transition-colors ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onTogglePredictor(col.name)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{col.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {corrWithTarget
                          ? `r con ${target}: ${corrWithTarget.r.toFixed(3)}`
                          : col.typeLabel}
                        {col.missingCount > 0 ? ` · ${col.missingCount} NA` : ''}
                      </p>
                      {wasExcludedInEDA && (
                        <p className="mt-1 text-[11px] font-medium text-amber-700">
                          Marcada para exclusión en análisis exploratorio
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
          </div>

          {/* Simple Regression Model 0 Predictor */}
          {predictors.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <label
                htmlFor="simple-pred-select"
                className="block text-xs font-medium text-slate-700"
              >
                Predictor para Modelo 0 (Regresión Lineal Simple):
              </label>
              <select
                id="simple-pred-select"
                value={predictors.includes(simplePredictor) ? simplePredictor : predictors[0]}
                onChange={(e) => onChangeSimplePredictor(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 sm:max-w-sm"
              >
                {predictors.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}

          {highPredictorPairs.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Entre los predictores activos existen correlaciones altas (|r| &gt; 0.60):{' '}
                {highPredictorPairs.map((p) => `${p.varA}↔${p.varB} (${p.r.toFixed(2)})`).join(', ')}.
                Los modelos Stepwise, Best Subsets y la prueba VIF evaluarán si conviene reducir variables.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Module 4: Data Split Configuration */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900">
            Módulo 4. Configuración de División Entrenamiento / Prueba
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Replicación de <span className="font-mono">set.seed()</span> y partición Train/Test del flujo RStudio.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Proportion */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Proporción Train / Test ({Math.round(splitConfig.trainRatio * 100)}% /{' '}
              {Math.round((1 - splitConfig.trainRatio) * 100)}%)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[0.7, 0.75, 0.8, 0.85].map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => onChangeSplitConfig({ ...splitConfig, trainRatio: ratio })}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    Math.abs(splitConfig.trainRatio - ratio) < 0.005
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {Math.round(ratio * 100)}/{Math.round((1 - ratio) * 100)}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0.5}
              max={0.9}
              step={0.05}
              value={splitConfig.trainRatio}
              onChange={(e) =>
                onChangeSplitConfig({ ...splitConfig, trainRatio: Number(e.target.value) })
              }
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Seed & Chronological mode */}
          <div className="space-y-2">
            <label htmlFor="seed-input" className="block text-xs font-medium text-slate-700">
              Semilla aleatoria (Reproducibilidad)
            </label>
            <input
              id="seed-input"
              type="number"
              disabled={splitConfig.chronological}
              value={splitConfig.seed}
              onChange={(e) =>
                onChangeSplitConfig({
                  ...splitConfig,
                  seed: Number.parseInt(e.target.value || '920203', 10),
                })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
            />
            <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={splitConfig.chronological}
                onChange={(e) =>
                  onChangeSplitConfig({ ...splitConfig, chronological: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              División cronológica (sin mezclar filas, ideal para series temporales)
            </label>
          </div>

          {/* Train / Test Counts */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-600">Registros resultantes</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-slate-500">Data Train</p>
                <p className="font-mono text-xl font-semibold text-indigo-700 tabular-nums">
                  {trainCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Data Test</p>
                <p className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
                  {testCount}
                </p>
              </div>
            </div>
            {incompleteRowsCount > 0 && (
              <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-amber-800">
                {incompleteRowsCount} fila(s) con valores faltantes en las variables elegidas.
                <label className="mt-1 flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={splitConfig.handleMissing === 'omit'}
                    onChange={(e) =>
                      onChangeSplitConfig({
                        ...splitConfig,
                        handleMissing: e.target.checked ? 'omit' : 'block',
                      })
                    }
                  />
                  Omitir filas con NA automáticamente
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Validation Status */}
      {validationErrors.length > 0 ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
          <p className="font-semibold">Requisitos pendientes antes de construir los modelos:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex items-center gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Validación estadística aprobada: <strong>{target}</strong> ~{' '}
              <strong>{predictors.join(' + ')}</strong> ({trainCount} entrenamiento / {testCount}{' '}
              prueba).
            </span>
          </div>
          <button
            type="button"
            onClick={onBuildModels}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
          >
            Construir y comparar los 4 modelos
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
