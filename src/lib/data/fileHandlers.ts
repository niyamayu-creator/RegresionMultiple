import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CorrelationPair,
  DataRow,
  DatasetSummary,
  DescriptiveStats,
  DiagnosticSummary,
  EconomicSector,
  EvaluationComparison,
  PredictionRecord,
  RegressionModelResult,
  ScenarioComputedRow,
  SplitConfig,
  SplitResult,
} from '../../types/analytics';
import { profileDataset } from '../stats/descriptive';

/**
 * Dataset de demostración opcional basado en el script R (MAOSBASE.xlsx: 186 días de venta).
 * Variables: Bowl Price, Bowls, Soda, Beer.
 */
export function buildDemoMaosDataset(): DatasetSummary {
  const rows: DataRow[] = [];
  // Deterministic PRNG for reproducible demo data
  let seed = 920203;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const randNorm = () => {
    const u1 = Math.max(1e-7, nextRand());
    const u2 = nextRand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  for (let day = 1; day <= 186; day++) {
    // Seasonal/weekend wave + price promotions
    const isWeekendBoost = day % 7 === 5 || day % 7 === 6 ? 1 : 0;
    const priceChoices = [9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5];
    const bowlPrice = priceChoices[Math.floor(nextRand() * priceChoices.length)];

    // Daily foot traffic driver -> Soda & Beer sales
    const trafficFactor = 1 + 0.22 * isWeekendBoost + 0.14 * randNorm();
    const soda = Math.max(18, Math.round(58 * trafficFactor + 7 * randNorm()));
    const beer = Math.max(8, Math.round(28 * trafficFactor + 5 * randNorm() + 0.12 * soda));

    // Bowls driven negatively by Bowl Price and positively by Soda & Beer + noise
    const expectedBowls =
      215 - 11.2 * bowlPrice + 0.95 * soda + 0.72 * beer + 9.5 * isWeekendBoost + 8.5 * randNorm();
    const bowls = Math.max(45, Math.round(expectedBowls));

    rows.push({
      'Bowl Price': Number(bowlPrice.toFixed(2)),
      Bowls: bowls,
      Soda: soda,
      Beer: beer,
    });
  }

  return profileDataset(rows, 'MAOSBASE_Demo_186_dias.xlsx', 14280, true);
}

export async function parseUploadedFile(file: File): Promise<DatasetSummary> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new Error(`Error al leer el archivo CSV: ${parsed.errors[0].message}`);
    }

    const cleanRows = normalizeParsedRows(parsed.data);
    if (cleanRows.length === 0) {
      throw new Error('El archivo CSV no contiene registros válidos.');
    }
    return profileDataset(cleanRows, file.name, file.size, false);
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('El archivo Excel no contiene hojas de cálculo.');
    }
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: null,
      raw: true,
    });

    const cleanRows = normalizeParsedRows(jsonRows);
    if (cleanRows.length === 0) {
      throw new Error('La primera hoja del archivo Excel no contiene registros válidos.');
    }
    return profileDataset(cleanRows, file.name, file.size, false);
  }

  throw new Error('Formato de archivo no soportado. Por favor sube un archivo .xlsx, .xls o .csv.');
}

function normalizeParsedRows(raw: Record<string, unknown>[]): DataRow[] {
  if (raw.length === 0) return [];
  const allKeys = Array.from(
    new Set(
      raw.flatMap((row) =>
        Object.keys(row).filter((k) => k && !k.startsWith('__EMPTY'))
      )
    )
  );

  return raw
    .filter((r) => allKeys.some((k) => r[k] !== null && r[k] !== undefined && String(r[k]).trim() !== ''))
    .map((r) => {
      const out: DataRow = {};
      for (const k of allKeys) {
        const v = r[k];
        if (v === undefined || v === null) {
          out[k] = null;
        } else if (typeof v === 'number' || typeof v === 'boolean') {
          out[k] = v;
        } else {
          out[k] = String(v);
        }
      }
      return out;
    });
}

export function exportPredictionsToCSV(
  predictions: PredictionRecord[],
  target: string,
  predictors: string[]
) {
  const rows = predictions.map((p, idx) => {
    const row: Record<string, string | number> = {
      '#': idx + 1,
      Hora: p.createdAt,
    };
    predictors.forEach((pred) => {
      row[pred] = p.inputs[pred];
    });
    row[`Predicción (${target})`] = Number(p.predictedValue.toFixed(4));
    row['IC 95% Inferior'] = Number(p.ciLower.toFixed(4));
    row['IC 95% Superior'] = Number(p.ciUpper.toFixed(4));
    row['IP 95% Inferior'] = Number(p.piLower.toFixed(4));
    row['IP 95% Superior'] = Number(p.piUpper.toFixed(4));
    row['Observación'] = p.outOfRangeVars.length > 0 ? `Fuera de rango: ${p.outOfRangeVars.join(', ')}` : 'Dentro de rango';
    return row;
  });

  const csv = Papa.unparse(rows);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `MLearning_Predicciones_${target}.csv`);
}

export function exportPredictionsToExcel(
  predictions: PredictionRecord[],
  target: string,
  predictors: string[]
) {
  const rows = predictions.map((p, idx) => {
    const row: Record<string, string | number> = {
      '#': idx + 1,
      Hora: p.createdAt,
    };
    predictors.forEach((pred) => {
      row[pred] = p.inputs[pred];
    });
    row[`Predicción (${target})`] = Number(p.predictedValue.toFixed(4));
    row['IC 95% Inferior'] = Number(p.ciLower.toFixed(4));
    row['IC 95% Superior'] = Number(p.ciUpper.toFixed(4));
    row['IP 95% Inferior'] = Number(p.piLower.toFixed(4));
    row['IP 95% Superior'] = Number(p.piUpper.toFixed(4));
    row['Interpretación'] = p.interpretation;
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Predicciones');
  XLSX.writeFile(wb, `MLearning_Predicciones_${target}.xlsx`);
}

export interface ReportExportPayload {
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
  diagnostics: Record<string, DiagnosticSummary>;
  evaluation: EvaluationComparison;
  winningModel: RegressionModelResult;
  predictions: PredictionRecord[];
  scenarios: ScenarioComputedRow[];
  conclusions: string[];
}

export function exportFullReportExcel(payload: ReportExportPayload) {
  const wb = XLSX.utils.book_new();

  // 1. Resumen Ejecutivo
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['MLearning – Plataforma Inteligente de Predicción de Ventas'],
    ['Informe Analítico de Regresión Lineal Múltiple'],
    [],
    ['Sector Económico', payload.sector],
    ['Archivo Analizado', payload.dataset.fileName],
    ['Registros Totales', payload.dataset.rowCount],
    ['Variables Totales', payload.dataset.columnCount],
    ['Valores Faltantes', payload.dataset.totalMissing],
    ['Registros Duplicados', payload.dataset.duplicateRowCount],
    ['Variable Dependiente (Y)', payload.target],
    ['Variables Independientes (X)', payload.predictors.join(', ')],
    ['División Train / Test', `${Math.round(payload.splitConfig.trainRatio * 100)}% / ${Math.round((1 - payload.splitConfig.trainRatio) * 100)}%`],
    ['Registros Entrenamiento', payload.splitResult.trainRows.length],
    ['Registros Prueba', payload.splitResult.testRows.length],
    ['Semilla / Modo', payload.splitConfig.chronological ? 'Cronológico' : `Semilla ${payload.splitConfig.seed}`],
    ['Modelo Ganador', payload.winningModel.name],
    ['Ecuación Final', payload.winningModel.equation],
    ['Justificación de Selección', payload.evaluation.selectionReason],
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumen');

  // 2. Descriptivos
  const descRows = payload.descriptiveStats.map((s) => ({
    Variable: s.column,
    N: s.n,
    Faltantes: s.missing,
    Mínimo: Number(s.min.toFixed(4)),
    Q1: Number(s.q1.toFixed(4)),
    Mediana: Number(s.median.toFixed(4)),
    Media: Number(s.mean.toFixed(4)),
    Q3: Number(s.q3.toFixed(4)),
    Máximo: Number(s.max.toFixed(4)),
    Desv_Est: Number(s.stdDev.toFixed(4)),
    Rango: Number(s.range.toFixed(4)),
    Asimetría: Number(s.skewness.toFixed(4)),
    Curtosis: Number(s.kurtosis.toFixed(4)),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(descRows), 'Descriptivos');

  // 3. Correlaciones
  const corrRows = payload.correlationPairs.map((c) => ({
    Variable_A: c.varA,
    Variable_B: c.varB,
    Correlación_r: Number(c.r.toFixed(4)),
    Valor_p: Number(c.pValue.toFixed(5)),
    Alerta_Multicolinealidad: c.isHighCollinearity ? 'Sí (|r| > 0.60)' : 'No',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(corrRows), 'Correlaciones');

  // 4. Evaluación comparativa
  const evalRows = payload.evaluation.metrics.map((m) => ({
    Modelo: m.modelName,
    Predictores: m.predictorsCount,
    MAE_Test: Number(m.mae.toFixed(4)),
    MSE_Test: Number(m.mse.toFixed(4)),
    RMSE_Test: Number(m.rmse.toFixed(4)),
    R2_Adj_Train: Number(m.trainAdjR2.toFixed(4)),
    AIC: Number(m.aic.toFixed(2)),
    BIC: Number(m.bic.toFixed(2)),
    VIF_Max: Number(m.maxVif.toFixed(2)),
    Seleccionado: m.modelId === payload.evaluation.winningModelId ? 'GANADOR' : '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evalRows), 'Comparación_Modelos');

  // 5. Coeficientes del Modelo Ganador
  const coefRows = payload.winningModel.coefficients.map((c) => ({
    Término: c.term,
    Coeficiente: Number(c.estimate.toFixed(6)),
    Error_Estándar: Number(c.stdError.toFixed(6)),
    Estadístico_t: Number(c.tStat.toFixed(4)),
    Valor_p: Number(c.pValue.toFixed(6)),
    IC_95_Inf: Number(c.ciLower.toFixed(4)),
    IC_95_Sup: Number(c.ciUpper.toFixed(4)),
    VIF: c.vif !== null ? Number(c.vif.toFixed(3)) : '-',
    Significativo: c.significant ? 'Sí (p < 0.05)' : 'No',
    Interpretación: c.sectorInterpretation,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(coefRows), 'Modelo_Final');

  // 6. Escenarios
  const scenRows = payload.scenarios.map((sc) => {
    const r: Record<string, string | number> = {
      Escenario: sc.label,
    };
    payload.winningModel.predictors.forEach((p) => {
      r[p] = sc.inputs[p];
    });
    r[`Predicción (${payload.target})`] = Number(sc.predictedValue.toFixed(2));
    r['Diferencia vs Base'] = Number(sc.diffFromBase.toFixed(2));
    r['Variación %'] = `${sc.pctChangeFromBase.toFixed(2)}%`;
    r['Interpretación'] = sc.interpretation;
    return r;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scenRows), 'Escenarios');

  // 7. Predicciones
  if (payload.predictions.length > 0) {
    const predRows = payload.predictions.map((p, i) => {
      const r: Record<string, string | number> = { '#': i + 1, Hora: p.createdAt };
      payload.winningModel.predictors.forEach((pred) => {
        r[pred] = p.inputs[pred];
      });
      r[`Predicción (${payload.target})`] = Number(p.predictedValue.toFixed(2));
      r['IP 95% Inferior'] = Number(p.piLower.toFixed(2));
      r['IP 95% Superior'] = Number(p.piUpper.toFixed(2));
      return r;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(predRows), 'Predicciones');
  }

  XLSX.writeFile(wb, `MLearning_Informe_${payload.sector}_${payload.target}.xlsx`);
}

export function exportFullReportPDF(payload: ReportExportPayload) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  const addSectionTitle = (title: string) => {
    if (y > 265) {
      doc.addPage();
      y = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, 14, y);
    y += 2;
    doc.setDrawColor(203, 213, 225);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;
  };

  const addParagraph = (text: string, fontSize = 9.5) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(text, pageWidth - 28);
    if (y + lines.length * 4.5 > 280) {
      doc.addPage();
      y = 18;
    }
    doc.text(lines, 14, y);
    y += lines.length * 4.5 + 3;
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('MLearning – Plataforma Inteligente de Predicción de Ventas', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Informe Ejecutivo y Estadístico · Sector: ${payload.sector} · Fecha: ${new Date().toLocaleDateString('es-ES')}`,
    14,
    y
  );
  y += 8;

  // 1-2. Sector & Dataset
  addSectionTitle('1 y 2. Sector Económico y Descripción de la Base de Datos');
  addParagraph(
    `Archivo: ${payload.dataset.fileName} | Registros: ${payload.dataset.rowCount} | Variables: ${payload.dataset.columnCount} | Valores faltantes: ${payload.dataset.totalMissing} | Duplicados: ${payload.dataset.duplicateRowCount}.`
  );

  // 3. Exploratorio
  addSectionTitle('3. Estadísticas Descriptivas');
  autoTable(doc, {
    startY: y,
    head: [['Variable', 'N', 'Mín', 'Mediana', 'Media', 'Máx', 'Desv. Est.', 'Asimetría']],
    body: payload.descriptiveStats.map((s) => [
      s.column,
      s.n,
      s.min.toFixed(2),
      s.median.toFixed(2),
      s.mean.toFixed(2),
      s.max.toFixed(2),
      s.stdDev.toFixed(2),
      s.skewness.toFixed(2),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  // 4-5. Variables y Metodología
  addSectionTitle('4 y 5. Variables Seleccionadas y Metodología');
  addParagraph(
    `Variable dependiente (Y): ${payload.target}. Variables independientes (X): ${payload.predictors.join(', ')}. División de datos: ${payload.splitResult.trainRows.length} registros en entrenamiento (${Math.round(payload.splitConfig.trainRatio * 100)}%) y ${payload.splitResult.testRows.length} en prueba (${Math.round((1 - payload.splitConfig.trainRatio) * 100)}%), ${payload.splitConfig.chronological ? 'división cronológica' : `muestreo aleatorio con semilla ${payload.splitConfig.seed}`}.`
  );

  // 6-10. Comparación de modelos
  addSectionTitle('6, 7 y 10. Comparación de Modelos y Métricas en Prueba');
  autoTable(doc, {
    startY: y,
    head: [['Modelo', 'MAE', 'MSE', 'RMSE', 'R² Adj (Train)', 'AIC', 'BIC']],
    body: payload.evaluation.metrics.map((m) => [
      m.modelId === payload.evaluation.winningModelId ? `${m.modelName} *` : m.modelName,
      m.mae.toFixed(3),
      m.mse.toFixed(3),
      m.rmse.toFixed(3),
      `${(m.trainAdjR2 * 100).toFixed(2)}%`,
      m.aic.toFixed(1),
      m.bic.toFixed(1),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  // 8-11. Modelo seleccionado y coeficientes
  addSectionTitle('8, 9 y 11. Modelo Seleccionado, Ecuación y Coeficientes');
  addParagraph(`Modelo seleccionado: ${payload.winningModel.name}`);
  addParagraph(`Ecuación: ${payload.winningModel.equation}`);
  addParagraph(payload.evaluation.selectionReason);

  autoTable(doc, {
    startY: y,
    head: [['Término', 'Coeficiente', 'Error Est.', 't', 'Valor p', 'IC 95%', 'VIF']],
    body: payload.winningModel.coefficients.map((c) => [
      c.term,
      c.estimate.toFixed(4),
      c.stdError.toFixed(4),
      c.tStat.toFixed(2),
      c.pValue < 0.0001 ? '< 0.0001' : c.pValue.toFixed(4),
      `[${c.ciLower.toFixed(2)}, ${c.ciUpper.toFixed(2)}]`,
      c.vif !== null ? c.vif.toFixed(2) : '-',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  // 12. Predicciones recientes
  addSectionTitle('12. Predicciones Generadas');
  if (payload.predictions.length === 0) {
    addParagraph('No se registraron predicciones puntuales adicionales en esta sesión.');
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', ...payload.winningModel.predictors, `Predicción (${payload.target})`, 'IP 95%']],
      body: payload.predictions.slice(0, 10).map((p, idx) => [
        idx + 1,
        ...payload.winningModel.predictors.map((pr) => p.inputs[pr].toFixed(2)),
        p.predictedValue.toFixed(2),
        `[${p.piLower.toFixed(2)}, ${p.piUpper.toFixed(2)}]`,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  }

  // 13. Simulación de escenarios
  addSectionTitle('13. Simulación de Escenarios');
  autoTable(doc, {
    startY: y,
    head: [['Escenario', ...payload.winningModel.predictors, `Est. ${payload.target}`, 'Dif. Base', 'Var. %']],
    body: payload.scenarios.map((sc) => [
      sc.label,
      ...payload.winningModel.predictors.map((p) => sc.inputs[p].toFixed(2)),
      sc.predictedValue.toFixed(2),
      sc.diffFromBase.toFixed(2),
      `${sc.pctChangeFromBase.toFixed(1)}%`,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  // 14. Conclusiones
  addSectionTitle('14. Conclusiones y Recomendaciones de Negocio');
  payload.conclusions.forEach((c) => addParagraph(`• ${c}`));

  doc.save(`MLearning_Informe_${payload.sector}_${payload.target}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
