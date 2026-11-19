import {
  ColumnProfile,
  CorrelationPair,
  DataRow,
  DatasetSummary,
  DescriptiveStats,
  EconomicSector,
  TargetSuggestion,
  VariableType,
} from '../../types/analytics';
import { tTwoTailedPValue } from '../math/distributions';

export function isMissingValue(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'number') return Number.isNaN(val) || !Number.isFinite(val);
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    return trimmed === '' || trimmed === 'na' || trimmed === 'null' || trimmed === 'nan' || trimmed === 'n/a';
  }
  return false;
}

export function parseNumericValue(val: unknown): number | null {
  if (isMissingValue(val)) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'boolean') return null;
  if (typeof val === 'string') {
    // Handle comma decimals or currency symbols if consistent
    let cleaned = val.trim().replace(/[$€£%\s]/g, '');
    // If string looks like "1,234.56" remove thousands commas; if "12,5" treat comma as dot
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, '');
    } else if (/^-?\d+,\d+$/.test(cleaned)) {
      cleaned = cleaned.replace(',', '.');
    }
    if (cleaned === '' || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(cleaned)) {
      return null;
    }
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function isLikelyDateString(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  if (s.length < 6 || /^\d+(\.\d+)?$/.test(s)) return false;
  if (!/[-/T:]/.test(s)) return false;
  const parsed = Date.parse(s);
  return !Number.isNaN(parsed);
}

const TYPE_LABELS: Record<VariableType, string> = {
  numeric_continuous: 'Numérica continua',
  numeric_discrete: 'Numérica discreta',
  categorical: 'Categórica / Texto',
  datetime: 'Fecha / Temporal',
  boolean: 'Booleana',
};

export function profileDataset(
  rawRows: DataRow[],
  fileName: string,
  fileSizeBytes: number,
  isDemo = false
): DatasetSummary {
  const rowCount = rawRows.length;
  const columnNames = rowCount > 0 ? Object.keys(rawRows[0]) : [];
  const columnCount = columnNames.length;

  // Normalize rows so numeric strings are parsed cleanly where appropriate per column
  const columns: ColumnProfile[] = [];
  const normalizedRows: DataRow[] = rawRows.map((r) => ({ ...r }));

  let totalMissing = 0;

  for (const colName of columnNames) {
    const rawValues = rawRows.map((r) => r[colName]);
    const nonMissing = rawValues.filter((v) => !isMissingValue(v));
    const missingCount = rowCount - nonMissing.length;
    totalMissing += missingCount;

    let numericCount = 0;
    let integerCount = 0;
    let boolCount = 0;
    let dateCount = 0;

    for (const v of nonMissing) {
      if (typeof v === 'boolean' || v === 'true' || v === 'false') {
        boolCount++;
      } else {
        const num = parseNumericValue(v);
        if (num !== null) {
          numericCount++;
          if (Number.isInteger(num)) integerCount++;
        } else if (isLikelyDateString(v)) {
          dateCount++;
        }
      }
    }

    let type: VariableType = 'categorical';
    const validN = nonMissing.length;

    if (validN > 0) {
      if (boolCount / validN >= 0.9) {
        type = 'boolean';
      } else if (numericCount / validN >= 0.85) {
        type = integerCount === numericCount ? 'numeric_discrete' : 'numeric_continuous';
      } else if (dateCount / validN >= 0.8) {
        type = 'datetime';
      } else {
        type = 'categorical';
      }
    }

    const isNumeric = type === 'numeric_continuous' || type === 'numeric_discrete';

    // Normalize values in normalizedRows
    const uniqueSet = new Set<string>();
    const numericVals: number[] = [];

    for (let i = 0; i < rowCount; i++) {
      const orig = rawRows[i][colName];
      if (isMissingValue(orig)) {
        normalizedRows[i][colName] = null;
      } else if (isNumeric) {
        const parsed = parseNumericValue(orig);
        normalizedRows[i][colName] = parsed;
        if (parsed !== null) {
          numericVals.push(parsed);
          uniqueSet.add(String(parsed));
        }
      } else {
        const strVal = String(orig).trim();
        normalizedRows[i][colName] = strVal;
        uniqueSet.add(strVal);
      }
    }

    let hasZeroVariance = false;
    if (isNumeric && numericVals.length > 0) {
      const first = numericVals[0];
      hasZeroVariance = numericVals.every((v) => Math.abs(v - first) < 1e-12);
    } else if (uniqueSet.size <= 1) {
      hasZeroVariance = true;
    }

    columns.push({
      name: colName,
      type,
      typeLabel: TYPE_LABELS[type],
      totalCount: rowCount,
      validCount: isNumeric ? numericVals.length : validN,
      missingCount: isNumeric ? rowCount - numericVals.length : missingCount,
      uniqueCount: uniqueSet.size,
      isNumeric,
      hasZeroVariance,
      sampleValues: normalizedRows.slice(0, 3).map((r) => r[colName]),
    });
  }

  // Recompute totalMissing accurately after numeric coercion
  totalMissing = columns.reduce((acc, c) => acc + c.missingCount, 0);

  // Detect duplicate rows
  const seen = new Set<string>();
  let duplicateRowCount = 0;
  for (const row of normalizedRows) {
    const sig = columnNames.map((c) => JSON.stringify(row[c])).join('|');
    if (seen.has(sig)) {
      duplicateRowCount++;
    } else {
      seen.add(sig);
    }
  }

  return {
    fileName,
    fileSizeBytes,
    isDemo,
    rowCount,
    columnCount,
    totalMissing,
    duplicateRowCount,
    columns,
    rows: normalizedRows,
  };
}

export function removeDuplicateRows(summary: DatasetSummary): DatasetSummary {
  const columnNames = summary.columns.map((c) => c.name);
  const seen = new Set<string>();
  const uniqueRows: DataRow[] = [];
  for (const row of summary.rows) {
    const sig = columnNames.map((c) => JSON.stringify(row[c])).join('|');
    if (!seen.has(sig)) {
      seen.add(sig);
      uniqueRows.push(row);
    }
  }
  return profileDataset(uniqueRows, summary.fileName, summary.fileSizeBytes, summary.isDemo);
}

export function quantileSorted(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const pos = (n - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function computeDescriptiveStats(
  rows: DataRow[],
  columns: ColumnProfile[]
): DescriptiveStats[] {
  const numericCols = columns.filter((c) => c.isNumeric);
  const stats: DescriptiveStats[] = [];

  for (const col of numericCols) {
    const values: number[] = [];
    for (const row of rows) {
      const v = row[col.name];
      if (typeof v === 'number' && Number.isFinite(v)) {
        values.push(v);
      }
    }

    const n = values.length;
    const missing = rows.length - n;
    if (n === 0) continue;

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[n - 1];
    const q1 = quantileSorted(sorted, 0.25);
    const median = quantileSorted(sorted, 0.5);
    const q3 = quantileSorted(sorted, 0.75);
    const iqr = q3 - q1;
    const range = max - min;
    const mean = values.reduce((s, v) => s + v, 0) / n;

    let m2 = 0;
    let m3 = 0;
    let m4 = 0;
    for (const v of values) {
      const d = v - mean;
      const d2 = d * d;
      m2 += d2;
      m3 += d2 * d;
      m4 += d2 * d2;
    }

    const variance = n > 1 ? m2 / (n - 1) : 0;
    const stdDev = Math.sqrt(variance);

    // Sample skewness & excess kurtosis (matching psych::describe type 3 / G1 & G2)
    let skewness = 0;
    let kurtosis = 0;
    if (stdDev > 0 && n >= 3) {
      const popStd = Math.sqrt(m2 / n);
      const g1 = (m3 / n) / Math.pow(popStd, 3);
      skewness = (Math.sqrt(n * (n - 1)) / (n - 2)) * g1;
    }
    if (stdDev > 0 && n >= 4) {
      const popVar = m2 / n;
      const m4n = m4 / n;
      kurtosis =
        ((n - 1) / ((n - 2) * (n - 3))) *
        ((n + 1) * (m4n / (popVar * popVar) - 3) + 6);
    }

    const lowFence = q1 - 1.5 * iqr;
    const highFence = q3 + 1.5 * iqr;
    const nonOutliers = sorted.filter((v) => v >= lowFence && v <= highFence);
    const lowerWhisker = nonOutliers.length > 0 ? nonOutliers[0] : min;
    const upperWhisker = nonOutliers.length > 0 ? nonOutliers[nonOutliers.length - 1] : max;
    const outliers = sorted.filter((v) => v < lowFence || v > highFence);

    stats.push({
      column: col.name,
      n,
      missing,
      min,
      q1,
      median,
      mean,
      q3,
      max,
      range,
      iqr,
      stdDev,
      variance,
      skewness,
      kurtosis,
      lowerWhisker,
      upperWhisker,
      outliers,
    });
  }

  return stats;
}

export interface HistogramBin {
  label: string;
  x0: number;
  x1: number;
  count: number;
  frequencyPct: number;
}

export function computeHistogram(
  rows: DataRow[],
  column: string,
  requestedBins?: number
): HistogramBin[] {
  const values = rows
    .map((r) => r[column])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [
      {
        label: min.toFixed(2),
        x0: min,
        x1: max,
        count: values.length,
        frequencyPct: 100,
      },
    ];
  }

  const binsCount =
    requestedBins ?? Math.min(18, Math.max(6, Math.ceil(1 + 3.322 * Math.log10(values.length))));
  const width = (max - min) / binsCount;

  const counts = new Array<number>(binsCount).fill(0);
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= binsCount) idx = binsCount - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }

  return counts.map((count, i) => {
    const x0 = min + i * width;
    const x1 = min + (i + 1) * width;
    const fmt = (num: number) => (Math.abs(num) >= 100 ? num.toFixed(0) : num.toFixed(1));
    return {
      label: `${fmt(x0)}–${fmt(x1)}`,
      x0,
      x1,
      count,
      frequencyPct: (count / values.length) * 100,
    };
  });
}

export function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denom = Math.sqrt(denX * denY);
  if (denom === 0) return 0;
  return Math.max(-1, Math.min(1, num / denom));
}

export function computeCorrelationMatrix(
  rows: DataRow[],
  numericColNames: string[]
): {
  matrix: number[][];
  pairs: CorrelationPair[];
} {
  const k = numericColNames.length;
  const matrix: number[][] = Array.from({ length: k }, () => new Array(k).fill(1));
  const pairs: CorrelationPair[] = [];

  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const colA = numericColNames[i];
      const colB = numericColNames[j];
      const xs: number[] = [];
      const ys: number[] = [];
      for (const row of rows) {
        const a = row[colA];
        const b = row[colB];
        if (typeof a === 'number' && Number.isFinite(a) && typeof b === 'number' && Number.isFinite(b)) {
          xs.push(a);
          ys.push(b);
        }
      }
      const r = pearsonCorrelation(xs, ys);
      const n = xs.length;
      let pValue = 1;
      if (n > 2 && Number.isFinite(r)) {
        if (Math.abs(r) >= 0.9999999) {
          pValue = 0;
        } else {
          const tStat = r * Math.sqrt((n - 2) / (1 - r * r));
          pValue = tTwoTailedPValue(tStat, n - 2);
        }
      }
      const safeR = Number.isFinite(r) ? r : 0;
      matrix[i][j] = safeR;
      matrix[j][i] = safeR;

      pairs.push({
        varA: colA,
        varB: colB,
        r: safeR,
        absR: Math.abs(safeR),
        pValue,
        isHighCollinearity: Math.abs(safeR) > 0.6,
      });
    }
  }

  pairs.sort((a, b) => b.absR - a.absR);
  return { matrix, pairs };
}

export function generateExploratoryNarrative(
  sector: EconomicSector,
  stats: DescriptiveStats[],
  pairs: CorrelationPair[]
): {
  summaryParagraph: string;
  variableInsights: string[];
  collinearityAlerts: CorrelationPair[];
} {
  if (stats.length === 0) {
    return {
      summaryParagraph: 'No se encontraron variables numéricas suficientes para generar el análisis exploratorio.',
      variableInsights: [],
      collinearityAlerts: [],
    };
  }

  const skewedCols = stats.filter((s) => Math.abs(s.skewness) > 1);
  const highPairs = pairs.filter((p) => p.absR > 0.6);
  const moderatePairs = pairs.filter((p) => p.absR >= 0.3 && p.absR <= 0.6);

  const sectorContextMap: Record<EconomicSector, string> = {
    Restaurantes: 'en la operación gastronómica y demanda diaria de alimentos y bebidas',
    Comercio: 'en la rotación de inventario, ticket promedio y volumen comercial',
    Manufactura: 'en los volúmenes de producción, eficiencia operativa y costos unitarios',
    Agricultura: 'en los rendimientos de cosecha, insumos y comercialización agrícola',
    Transporte: 'en la demanda de rutas, carga movilizada y tarifas operativas',
    Servicios: 'en la contratación de servicios, facturación y capacidad instalada',
    Tecnología: 'en la adopción de producto, suscripciones e ingresos recurrentes',
    Construcción: 'en el avance de obra, metraje, insumos y presupuestos ejecutados',
    Salud: 'en la atención de pacientes, servicios clínicos y demanda asistencial',
    Educación: 'en la matrícula, retención estudiantil y programas académicos',
    Otro: 'en la actividad operativa y comercial de la organización',
  };

  const contextPhrase = sectorContextMap[sector] || sectorContextMap.Otro;

  const summaryParagraph = `En el contexto del sector ${sector} (${contextPhrase}), se analizaron ${stats.length} variables numéricas. ${
    skewedCols.length > 0
      ? `Las variables ${skewedCols.map((s) => `"${s.column}"`).join(', ')} presentan asimetría pronunciada (|asimetría| > 1), lo que sugiere valores extremos o días atípicos de alta/baja demanda.`
      : 'Las distribuciones muestran una dispersión equilibrada sin asimetrías severas.'
  } ${
    highPairs.length > 0
      ? `Se detectaron ${highPairs.length} pares con correlación lineal fuerte (|r| > 0.60), que pueden indicar tanto relaciones predictivas valiosas como posible multicolinealidad entre predictores.`
      : moderatePairs.length > 0
      ? `Se observaron ${moderatePairs.length} relaciones moderadas (0.30 ≤ |r| ≤ 0.60) que aportan señal explicativa sin evidenciar colinealidad crítica por pares.`
      : 'Las correlaciones bivariadas son bajas, por lo que conviene evaluar el aporte conjunto en regresión múltiple.'
  }`;

  const variableInsights = stats.map((s) => {
    const cv = s.mean !== 0 ? (s.stdDev / Math.abs(s.mean)) * 100 : 0;
    const outlierMsg =
      s.outliers.length > 0
        ? `Presenta ${s.outliers.length} valor(es) atípico(s) según el criterio IQR.`
        : 'Sin valores atípicos extremos según criterio IQR.';
    return `${s.column}: promedio de ${s.mean.toFixed(2)} (mediana ${s.median.toFixed(2)}), rango entre ${s.min.toFixed(2)} y ${s.max.toFixed(2)}, con variabilidad relativa del ${cv.toFixed(1)}%. ${outlierMsg}`;
  });

  return {
    summaryParagraph,
    variableInsights,
    collinearityAlerts: highPairs,
  };
}

export function suggestTargetVariable(
  sector: EconomicSector,
  columns: ColumnProfile[],
  pairs: CorrelationPair[]
): TargetSuggestion | null {
  const candidates = columns.filter((c) => c.isNumeric && !c.hasZeroVariance && c.validCount >= 5);
  if (candidates.length === 0) return null;

  const sectorKeywords: Record<EconomicSector, string[]> = {
    Restaurantes: ['bowls', 'ventas', 'sales', 'platos', 'pedidos', 'ingresos', 'revenue', 'ordenes', 'tickets'],
    Comercio: ['ventas', 'sales', 'ingresos', 'revenue', 'unidades', 'facturacion', 'demanda'],
    Manufactura: ['produccion', 'unidades', 'ventas', 'output', 'rendimiento', 'ingresos'],
    Agricultura: ['rendimiento', 'cosecha', 'produccion', 'toneladas', 'ventas', 'ingresos'],
    Transporte: ['viajes', 'pasajeros', 'carga', 'ingresos', 'ventas', 'tarifa', 'demanda'],
    Servicios: ['ingresos', 'facturacion', 'ventas', 'contratos', 'clientes', 'horas'],
    Tecnología: ['ingresos', 'mrr', 'arr', 'ventas', 'usuarios', 'conversiones', 'suscripciones'],
    Construcción: ['avance', 'ventas', 'ingresos', 'presupuesto', 'metros', 'unidades'],
    Salud: ['consultas', 'pacientes', 'ingresos', 'atenciones', 'procedimientos', 'ventas'],
    Educación: ['matricula', 'estudiantes', 'ingresos', 'inscripciones', 'retencion'],
    Otro: ['ventas', 'sales', 'ingresos', 'revenue', 'demanda', 'cantidad', 'total'],
  };

  const keywords = sectorKeywords[sector] || sectorKeywords.Otro;

  // Score each candidate by domain keyword match + average |r| with other variables
  let bestCol = candidates[0];
  let bestScore = -1;
  let matchedKeyword: string | null = null;

  for (const col of candidates) {
    const lower = col.name.toLowerCase();
    let keywordScore = 0;
    let localKeyword: string | null = null;

    for (let idx = 0; idx < keywords.length; idx++) {
      const kw = keywords[idx];
      if (lower === kw || lower.includes(kw)) {
        keywordScore = 2.0 - idx * 0.08;
        localKeyword = kw;
        break;
      }
    }

    // Penalize obvious price/cost/id variables as target unless nothing else matches
    if (/(precio|price|costo|cost|id|dia|day|fecha|index|semana|mes|anio|year)/.test(lower)) {
      keywordScore -= 0.7;
    }

    // Average correlation magnitude with other numeric columns
    const related = pairs.filter((p) => p.varA === col.name || p.varB === col.name);
    const avgAbsR =
      related.length > 0 ? related.reduce((s, p) => s + p.absR, 0) / related.length : 0;

    const totalScore = keywordScore + avgAbsR;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestCol = col;
      matchedKeyword = localKeyword;
    }
  }

  const otherPredictors = candidates
    .filter((c) => c.name !== bestCol.name)
    .map((c) => c.name);

  const relatedToBest = pairs
    .filter((p) => p.varA === bestCol.name || p.varB === bestCol.name)
    .sort((a, b) => b.absR - a.absR);

  const topCorrelated = relatedToBest
    .slice(0, 2)
    .map((p) => {
      const other = p.varA === bestCol.name ? p.varB : p.varA;
      return `${other} (r = ${p.r.toFixed(2)})`;
    })
    .join(' y ');

  const reason = matchedKeyword
    ? `Para el sector ${sector}, "${bestCol.name}" coincide directamente con el indicador principal de desempeño o demanda ("${matchedKeyword}") y ${
        topCorrelated
          ? `presenta sus relaciones lineales más claras con ${topCorrelated}.`
          : 'cuenta con variabilidad numérica apta para modelado predictivo.'
      }`
    : `En el análisis exploratorio del sector ${sector}, "${bestCol.name}" muestra la mayor capacidad explicativa conjunta frente al resto de variables numéricas${
        topCorrelated ? ` (destacando ${topCorrelated})` : ''
      }, convirtiéndola en la candidata más sólida como variable dependiente.`;

  return {
    suggestedTarget: bestCol.name,
    reason,
    confidenceLabel: matchedKeyword ? 'Alta' : relatedToBest[0]?.absR > 0.35 ? 'Media' : 'Baja',
    recommendedPredictors: otherPredictors,
  };
}
