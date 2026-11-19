import React, { useMemo } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import {
  CorrelationPair,
  DatasetSummary,
  DescriptiveStats,
  DiagnosticSummary,
  EconomicSector,
  EvaluationComparison,
  ModelId,
  PredictionRecord,
  RegressionModelResult,
  ScenarioComputedRow,
  SplitConfig,
  SplitResult,
} from '../../types/analytics';
import {
  exportFullReportExcel,
  exportFullReportPDF,
} from '../../lib/data/fileHandlers';

interface FinalReportModuleProps {
  sector: EconomicSector;
  dataset: DatasetSummary;
  descriptiveStats: DescriptiveStats[];
  correlationPairs: CorrelationPair[];
  target: string;
  predictors: string[];
  simplePredictor: string;
  splitConfig: SplitConfig;
  splitResult: SplitResult;
  models: RegressionModelResult[];
  diagnostics: Record<ModelId, DiagnosticSummary>;
  evaluation: EvaluationComparison;
  winningModel: RegressionModelResult;
  predictions: PredictionRecord[];
  scenarios: ScenarioComputedRow[];
}

export const FinalReportModule: React.FC<FinalReportModuleProps> = ({
  sector,
  dataset,
  descriptiveStats,
  correlationPairs,
  target,
  predictors,
  simplePredictor,
  splitConfig,
  splitResult,
  models,
  diagnostics,
  evaluation,
  winningModel,
  predictions,
  scenarios,
}) => {
  const winningMetrics = evaluation.metrics.find((m) => m.modelId === winningModel.id);
  const winningDiag = diagnostics[winningModel.id];

  const conclusions = useMemo(() => {
    const sigPredictors = winningModel.coefficients.filter((c) => !c.isIntercept && c.significant);
    const strongestCoef = [...sigPredictors].sort(
      (a, b) => Math.abs(b.tStat) - Math.abs(a.tStat)
    )[0];

    const optRow = scenarios.find((s) => s.key === 'optimista');
    const pesRow = scenarios.find((s) => s.key === 'pesimista');
    const highCorr = correlationPairs.filter((p) => p.isHighCollinearity);

    const list: string[] = [
      `Para el sector ${sector}, el modelo seleccionado (${winningModel.name}) explica el ${(winningModel.adjRSquared * 100).toFixed(2)}% de la variabilidad ajustada de "${target}" en entrenamiento y alcanza un RMSE de ${winningMetrics?.rmse.toFixed(3) ?? 'N/A'} y MAE de ${winningMetrics?.mae.toFixed(3) ?? 'N/A'} sobre datos de prueba independientes.`,
    ];

    if (strongestCoef) {
      list.push(
        `El predictor con mayor peso estadístico es "${strongestCoef.term}" (β = ${strongestCoef.estimate.toFixed(4)}, t = ${strongestCoef.tStat.toFixed(2)}, p ${strongestCoef.pValue < 0.0001 ? '< 0.0001' : `= ${strongestCoef.pValue.toFixed(4)}`}), por lo que las decisiones operativas sobre esta palanca tienen el impacto más directo sobre "${target}".`
      );
    }

    if (highCorr.length > 0) {
      list.push(
        `Se identificaron ${highCorr.length} relaciones con correlación superior a |0.60| en el análisis exploratorio; monitorear el VIF (máximo observado: ${winningMetrics?.maxVif.toFixed(2) ?? '1.00'}) evita sobreajustar los coeficientes al incorporar nuevas variables.`
      );
    }

    if (winningDiag) {
      list.push(
        `En validación de supuestos: Durbin-Watson = ${winningDiag.durbinWatson.statistic.toFixed(2)} (${winningDiag.durbinWatson.status}), Breusch-Pagan p = ${winningDiag.breuschPagan.pValue.toFixed(4)} (${winningDiag.breuschPagan.status}) y Shapiro-Wilk p = ${winningDiag.shapiroWilk.pValue.toFixed(4)} (${winningDiag.shapiroWilk.status}).`
      );
    }

    if (optRow && pesRow) {
      list.push(
        `La simulación de escenarios proyecta una brecha estratégica entre ${pesRow.predictedValue.toFixed(2)} (escenario pesimista) y ${optRow.predictedValue.toFixed(2)} (escenario optimista), facilitando la planeación de inventarios, precios y capacidad en el sector ${sector}.`
      );
    }

    return list;
  }, [sector, winningModel, winningMetrics, winningDiag, scenarios, correlationPairs, target]);

  const handleExportExcel = () => {
    exportFullReportExcel({
      sector,
      dataset,
      descriptiveStats,
      correlationPairs,
      target,
      predictors,
      simplePredictor,
      splitConfig,
      splitResult,
      models,
      diagnostics,
      evaluation,
      winningModel,
      predictions,
      scenarios,
      conclusions,
    });
  };

  const handleExportPDF = () => {
    exportFullReportPDF({
      sector,
      dataset,
      descriptiveStats,
      correlationPairs,
      target,
      predictors,
      simplePredictor,
      splitConfig,
      splitResult,
      models,
      diagnostics,
      evaluation,
      winningModel,
      predictions,
      scenarios,
      conclusions,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header + Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Módulo 10. Informe Final Ejecutivo y Técnico
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Consolidado completo de las 14 secciones analíticas listo para exportar a PDF y Excel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            Exportar informe Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <FileDown className="h-4 w-4" />
            Exportar informe PDF
          </button>
        </div>
      </div>

      {/* Report Document Container */}
      <article className="space-y-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        {/* 1 & 2 */}
        <section className="space-y-3 border-b border-slate-100 pb-6">
          <h2 className="text-base font-semibold text-slate-900">
            1. Sector económico analizado y 2. Descripción de la base de datos
          </h2>
          <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <p className="text-slate-500">Sector</p>
              <p className="mt-0.5 font-semibold text-slate-900">{sector}</p>
            </div>
            <div>
              <p className="text-slate-500">Archivo</p>
              <p className="mt-0.5 truncate font-semibold text-slate-900">{dataset.fileName}</p>
            </div>
            <div>
              <p className="text-slate-500">Registros</p>
              <p className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
                {dataset.rowCount}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Variables</p>
              <p className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
                {dataset.columnCount}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Faltantes</p>
              <p className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
                {dataset.totalMissing}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Duplicados</p>
              <p className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
                {dataset.duplicateRowCount}
              </p>
            </div>
          </div>
        </section>

        {/* 3. EDA */}
        <section className="space-y-3 border-b border-slate-100 pb-6">
          <h2 className="text-base font-semibold text-slate-900">3. Análisis exploratorio</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-right text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">Variable</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">Mín</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">Mediana</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">Media</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">Máx</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">Desv. Est.</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">Asimetría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {descriptiveStats.map((s) => (
                  <tr key={s.column}>
                    <td className="px-3 py-2 text-left font-sans font-semibold text-slate-900">
                      {s.column}
                    </td>
                    <td className="px-3 py-2">{s.min.toFixed(2)}</td>
                    <td className="px-3 py-2">{s.median.toFixed(2)}</td>
                    <td className="px-3 py-2">{s.mean.toFixed(2)}</td>
                    <td className="px-3 py-2">{s.max.toFixed(2)}</td>
                    <td className="px-3 py-2">{s.stdDev.toFixed(2)}</td>
                    <td className="px-3 py-2">{s.skewness.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4 & 5 */}
        <section className="space-y-2 border-b border-slate-100 pb-6 text-xs text-slate-700">
          <h2 className="text-base font-semibold text-slate-900">
            4. Variables seleccionadas y 5. Metodología utilizada
          </h2>
          <p>
            <strong>Variable dependiente (Y):</strong> {target}.{' '}
            <strong>Variables independientes (X):</strong> {predictors.join(', ')} (Modelo simple con{' '}
            {simplePredictor}).
          </p>
          <p>
            <strong>Metodología:</strong> Se replicó el flujo estadístico de regresión lineal
            mediante Mínimos Cuadrados Ordinarios (OLS), particionando la base en{' '}
            {splitResult.trainRows.length} registros de entrenamiento (
            {Math.round(splitConfig.trainRatio * 100)}%) y {splitResult.testRows.length} de prueba (
            {Math.round((1 - splitConfig.trainRatio) * 100)}%),{' '}
            {splitConfig.chronological
              ? 'respetando el orden cronológico.'
              : `con muestreo aleatorio reproducible (semilla ${splitConfig.seed}).`}
          </p>
        </section>

        {/* 6, 7 & 10 */}
        <section className="space-y-3 border-b border-slate-100 pb-6">
          <h2 className="text-base font-semibold text-slate-900">
            6. Modelos construidos, 7. Estadísticas de regresión y 10. Comparación de métricas
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-right text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">Modelo</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">MAE</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">MSE</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">RMSE</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">R² Adj (Train)</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">AIC</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">BIC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {evaluation.metrics.map((m) => (
                  <tr
                    key={m.modelId}
                    className={m.modelId === winningModel.id ? 'bg-indigo-50/50 font-semibold' : ''}
                  >
                    <td className="px-3 py-2 text-left font-sans text-slate-900">
                      {m.modelName} {m.modelId === winningModel.id ? '(Seleccionado)' : ''}
                    </td>
                    <td className="px-3 py-2">{m.mae.toFixed(3)}</td>
                    <td className="px-3 py-2">{m.mse.toFixed(3)}</td>
                    <td className="px-3 py-2">{m.rmse.toFixed(3)}</td>
                    <td className="px-3 py-2">{(m.trainAdjR2 * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2">{m.aic.toFixed(1)}</td>
                    <td className="px-3 py-2">{m.bic.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 8, 9 & 11 */}
        <section className="space-y-3 border-b border-slate-100 pb-6">
          <h2 className="text-base font-semibold text-slate-900">
            8. Ecuación del modelo final, 9. Interpretación de coeficientes y 11. Modelo seleccionado
          </h2>
          <p className="text-xs leading-relaxed text-slate-700">{evaluation.selectionReason}</p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs font-semibold text-slate-900">
            {winningModel.equation}
          </div>
          <ul className="space-y-1.5 text-xs text-slate-700">
            {winningModel.coefficients.map((c) => (
              <li key={c.term}>
                <strong>{c.term}</strong> (β = {c.estimate.toFixed(4)}, p ={' '}
                {c.pValue < 0.0001 ? '< 0.0001' : c.pValue.toFixed(4)}): {c.sectorInterpretation}
              </li>
            ))}
          </ul>
        </section>

        {/* 12 & 13 */}
        <section className="space-y-3 border-b border-slate-100 pb-6">
          <h2 className="text-base font-semibold text-slate-900">
            12. Predicciones y 13. Simulación de escenarios
          </h2>
          <p className="text-xs text-slate-600">
            Predicciones puntuales registradas en sesión: {predictions.length}. Resumen de los 5
            escenarios simulados:
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-right text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">
                    Escenario
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">
                    Estimación ({target})
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">Dif. Base</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-medium">Var. %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {scenarios.map((sc) => (
                  <tr key={sc.key}>
                    <td className="px-3 py-2 text-left font-sans font-semibold text-slate-900">
                      {sc.label}
                    </td>
                    <td className="px-3 py-2 font-semibold">{sc.predictedValue.toFixed(2)}</td>
                    <td className="px-3 py-2">{sc.diffFromBase.toFixed(2)}</td>
                    <td className="px-3 py-2">{sc.pctChangeFromBase.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 14. Conclusions */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            14. Conclusiones y recomendaciones de negocio
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-slate-700">
            {conclusions.map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
};
