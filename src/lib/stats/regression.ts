import {
  CoefficientEstimate,
  DataRow,
  DescriptiveStats,
  DiagnosticSummary,
  EconomicSector,
  EvaluationComparison,
  ModelEvaluationMetrics,
  ModelId,
  PredictionRecord,
  RegressionModelResult,
  ResidualObservation,
  ScenarioComputedRow,
  ScenarioState,
  SplitConfig,
  SplitResult,
} from '../../types/analytics';
import {
  chiSqPValue,
  fPValue,
  normCdf,
  normInv,
  shapiroWilkTest,
  tInv,
  tTwoTailedPValue,
} from '../math/distributions';
import { invertMatrix, matVecMul, normalEquations, quadForm } from '../math/matrix';

/**
 * PRNG determinístico Mulberry32 para reproducibilidad exacta con semilla configurable.
 */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function splitDataset(
  rows: DataRow[],
  target: string,
  predictors: string[],
  config: SplitConfig
): SplitResult {
  const requiredCols = [target, ...predictors];
  const validEntries: Array<{ row: DataRow; origIndex: number }> = [];
  let omittedCount = 0;

  rows.forEach((row, idx) => {
    const allValid = requiredCols.every((col) => {
      const val = row[col];
      return typeof val === 'number' && Number.isFinite(val);
    });
    if (allValid) {
      validEntries.push({ row, origIndex: idx });
    } else {
      omittedCount++;
    }
  });

  const n = validEntries.length;
  const trainCount = Math.max(1, Math.min(n - 1, Math.floor(config.trainRatio * n)));

  if (config.chronological) {
    const trainSlice = validEntries.slice(0, trainCount);
    const testSlice = validEntries.slice(trainCount);
    return {
      trainRows: trainSlice.map((e) => e.row),
      testRows: testSlice.map((e) => e.row),
      trainIndices: trainSlice.map((e) => e.origIndex),
      testIndices: testSlice.map((e) => e.origIndex),
      omittedCount,
    };
  }

  // Fisher-Yates shuffle with seeded PRNG (replicating R sample.int)
  const indices = Array.from({ length: n }, (_, i) => i);
  const rand = mulberry32(config.seed || 920203);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }

  const trainIdxSet = new Set(indices.slice(0, trainCount));
  const trainSlice: Array<{ row: DataRow; origIndex: number }> = [];
  const testSlice: Array<{ row: DataRow; origIndex: number }> = [];

  validEntries.forEach((entry, i) => {
    if (trainIdxSet.has(i)) {
      trainSlice.push(entry);
    } else {
      testSlice.push(entry);
    }
  });

  return {
    trainRows: trainSlice.map((e) => e.row),
    testRows: testSlice.map((e) => e.row),
    trainIndices: trainSlice.map((e) => e.origIndex),
    testIndices: testSlice.map((e) => e.origIndex),
    omittedCount,
  };
}

function getSignificanceCode(p: number): '***' | '**' | '*' | '.' | '' {
  if (!Number.isFinite(p)) return '';
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  if (p < 0.1) return '.';
  return '';
}

function interpretCoefficientForSector(
  term: string,
  isIntercept: boolean,
  estimate: number,
  pValue: number,
  target: string,
  sector: EconomicSector
): string {
  if (isIntercept) {
    return `Valor base estimado de "${target}" (${estimate.toFixed(3)}) cuando todas las variables independientes toman valor cero en la operación del sector ${sector}.`;
  }
  const direction = estimate >= 0 ? 'incrementa' : 'disminuye';
  const absEst = Math.abs(estimate).toFixed(4);
  const sigText =
    pValue < 0.05
      ? 'Este efecto es estadísticamente significativo (p < 0.05)'
      : 'No muestra significancia estadística individual al 95% de confianza (p ≥ 0.05)';

  return `Por cada unidad adicional en "${term}", "${target}" ${direction} en promedio ${absEst} unidades, manteniendo constantes las demás variables del modelo en el sector ${sector}. ${sigText}.`;
}

function computePredictorVIFs(rows: DataRow[], predictors: string[]): Record<string, number> {
  const vifs: Record<string, number> = {};
  if (predictors.length <= 1) {
    predictors.forEach((p) => (vifs[p] = 1));
    return vifs;
  }

  for (const targetPred of predictors) {
    const others = predictors.filter((p) => p !== targetPred);
    const auxFit = fitRawOLS(rows, targetPred, others);
    if (!auxFit) {
      vifs[targetPred] = Infinity;
    } else {
      const denom = Math.max(1e-8, 1 - auxFit.rSquared);
      vifs[targetPred] = 1 / denom;
    }
  }
  return vifs;
}

interface RawOLSFit {
  beta: number[];
  rSquared: number;
  adjRSquared: number;
  rss: number;
  tss: number;
  aic: number;
  bic: number;
  sigma: number;
  xtxInv: number[][];
  fitted: number[];
  residuals: number[];
}

function fitRawOLS(rows: DataRow[], target: string, predictors: string[]): RawOLSFit | null {
  const n = rows.length;
  const p = predictors.length;
  const k = p + 1; // including intercept
  if (n <= k) return null;

  const X: number[][] = new Array(n);
  const y = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const row = rows[i];
    const yVal = row[target];
    if (typeof yVal !== 'number' || !Number.isFinite(yVal)) return null;
    y[i] = yVal;

    const xRow = new Array<number>(k);
    xRow[0] = 1;
    for (let j = 0; j < p; j++) {
      const xVal = row[predictors[j]];
      if (typeof xVal !== 'number' || !Number.isFinite(xVal)) return null;
      xRow[j + 1] = xVal;
    }
    X[i] = xRow;
  }

  const { xtx, xty } = normalEquations(X, y);
  const xtxInv = invertMatrix(xtx);
  if (!xtxInv) return null;

  const beta = matVecMul(xtxInv, xty);

  let ySum = 0;
  for (let i = 0; i < n; i++) ySum += y[i];
  const yMean = ySum / n;

  const fitted = new Array<number>(n);
  const residuals = new Array<number>(n);
  let rss = 0;
  let tss = 0;

  for (let i = 0; i < n; i++) {
    let yHat = 0;
    const xRow = X[i];
    for (let j = 0; j < k; j++) {
      yHat += beta[j] * xRow[j];
    }
    fitted[i] = yHat;
    const res = y[i] - yHat;
    residuals[i] = res;
    rss += res * res;
    const dy = y[i] - yMean;
    tss += dy * dy;
  }

  const dfResidual = n - k;
  const sigma2 = rss / dfResidual;
  const sigma = Math.sqrt(Math.max(0, sigma2));

  const rSquared = tss > 0 ? Math.max(0, Math.min(1, 1 - rss / tss)) : 0;
  const adjRSquared =
    tss > 0 ? 1 - ((1 - rSquared) * (n - 1)) / dfResidual : 0;

  // R's exact AIC(lm) and BIC(lm) for Gaussian likelihood:
  // logLik = -n/2 * (log(2*pi) + 1 + log(rss/n)), df_params = k + 1 (betas + sigma)
  const rssSafe = Math.max(rss, 1e-12);
  const negTwoLogLik = n * (Math.log(2 * Math.PI) + 1 + Math.log(rssSafe / n));
  const nParams = k + 1;
  const aic = negTwoLogLik + 2 * nParams;
  const bic = negTwoLogLik + Math.log(n) * nParams;

  return {
    beta,
    rSquared,
    adjRSquared,
    rss,
    tss,
    aic,
    bic,
    sigma,
    xtxInv,
    fitted,
    residuals,
  };
}

export function fitFullRegressionModel(
  id: ModelId,
  name: string,
  shortLabel: string,
  description: string,
  trainRows: DataRow[],
  target: string,
  predictors: string[],
  sector: EconomicSector
): RegressionModelResult | null {
  const raw = fitRawOLS(trainRows, target, predictors);
  if (!raw) return null;

  const n = trainRows.length;
  const p = predictors.length;
  const k = p + 1;
  const dfResidual = n - k;
  const dfModel = p;
  const tCrit = tInv(0.975, dfResidual);
  const vifs = computePredictorVIFs(trainRows, predictors);

  const terms = ['(Intercepto)', ...predictors];
  const sigma2 = raw.sigma * raw.sigma;

  const coefficients: CoefficientEstimate[] = terms.map((term, j) => {
    const isIntercept = j === 0;
    const estimate = raw.beta[j];
    const varianceEst = Math.max(0, sigma2 * raw.xtxInv[j][j]);
    const stdError = Math.sqrt(varianceEst);
    const tStat = stdError > 0 ? estimate / stdError : 0;
    const pValue = tTwoTailedPValue(tStat, dfResidual);
    const ciLower = estimate - tCrit * stdError;
    const ciUpper = estimate + tCrit * stdError;

    return {
      term,
      isIntercept,
      estimate,
      stdError,
      tStat,
      pValue,
      ciLower,
      ciUpper,
      vif: isIntercept ? null : vifs[term] ?? null,
      significant: pValue < 0.05,
      significanceCode: getSignificanceCode(pValue),
      sectorInterpretation: interpretCoefficientForSector(
        term,
        isIntercept,
        estimate,
        pValue,
        target,
        sector
      ),
    };
  });

  // F-statistic
  let fStatistic = 0;
  let fPValue = 1;
  if (dfModel > 0 && raw.rss > 0) {
    const msm = Math.max(0, raw.tss - raw.rss) / dfModel;
    const mse = raw.rss / dfResidual;
    fStatistic = mse > 0 ? msm / mse : 0;
    fPValue = fPValueFn(fStatistic, dfModel, dfResidual);
  }

  // Equation string
  const eqParts = [`${target} = ${raw.beta[0].toFixed(4)}`];
  predictors.forEach((pred, idx) => {
    const b = raw.beta[idx + 1];
    const sign = b >= 0 ? ' + ' : ' - ';
    eqParts.push(`${sign}${Math.abs(b).toFixed(4)}·(${pred})`);
  });
  const equation = eqParts.join('');

  // Diagnostic observation metrics (leverage, standardized residuals, Cook's distance, Q-Q)
  const observations: ResidualObservation[] = [];
  for (let i = 0; i < n; i++) {
    const xRow = [1, ...predictors.map((pred) => trainRows[i][pred] as number)];
    const h = Math.min(0.9999, Math.max(0, quadForm(xRow, raw.xtxInv)));
    const res = raw.residuals[i];
    const denom = raw.sigma * Math.sqrt(Math.max(1e-8, 1 - h));
    const stdRes = denom > 0 ? res / denom : 0;
    const cooksD =
      (stdRes * stdRes * h) / (k * Math.max(1e-8, 1 - h));

    observations.push({
      index: i + 1,
      actual: trainRows[i][target] as number,
      fitted: raw.fitted[i],
      residual: res,
      standardizedResidual: stdRes,
      sqrtAbsStdResidual: Math.sqrt(Math.abs(stdRes)),
      leverage: h,
      cooksDistance: cooksD,
      theoreticalQuantile: 0, // filled after sorting
    });
  }

  // Compute normal Q-Q theoretical quantiles based on rank of standardized residuals
  const sortedIndices = observations
    .map((_, idx) => idx)
    .sort((a, b) => observations[a].standardizedResidual - observations[b].standardizedResidual);
  sortedIndices.forEach((origIdx, rank) => {
    const prob = (rank + 1 - 0.375) / (n + 0.25);
    observations[origIdx].theoreticalQuantile = normInv(prob);
  });

  const warnings: string[] = [];
  const highVif = coefficients.filter((c) => c.vif !== null && c.vif > 5);
  if (highVif.length > 0) {
    warnings.push(
      `Posible multicolinealidad detectada en: ${highVif
        .map((c) => `${c.term} (VIF=${c.vif?.toFixed(2)})`)
        .join(', ')}.`
    );
  }
  const nonSig = coefficients.filter((c) => !c.isIntercept && !c.significant);
  if (nonSig.length > 0 && predictors.length > 1) {
    warnings.push(
      `Variables sin significancia estadística individual (p ≥ 0.05): ${nonSig
        .map((c) => c.term)
        .join(', ')}.`
    );
  }

  return {
    id,
    name,
    shortLabel,
    description,
    target,
    predictors,
    nTrain: n,
    dfResidual,
    dfModel,
    equation,
    coefficients,
    rSquared: raw.rSquared,
    adjRSquared: raw.adjRSquared,
    residualStdError: raw.sigma,
    fStatistic,
    fPValue,
    aic: raw.aic,
    bic: raw.bic,
    rss: raw.rss,
    tss: raw.tss,
    xtxInverse: raw.xtxInv,
    observations,
    warnings,
  };
}

function fPValueFn(fStat: number, df1: number, df2: number): number {
  return fPValue(fStat, df1, df2);
}

/**
 * Modelo 2: Stepwise Bidireccional por AIC (equivalente a MASS::stepAIC / stats::step(..., direction="both"))
 */
export function fitStepwiseAIC(
  trainRows: DataRow[],
  target: string,
  allPredictors: string[],
  sector: EconomicSector
): RegressionModelResult | null {
  if (allPredictors.length === 0) return null;

  let currentPredictors = [...allPredictors];
  let currentFit = fitRawOLS(trainRows, target, currentPredictors);
  if (!currentFit) return null;

  const trace: Array<{
    step: number;
    action: string;
    predictors: string[];
    aic: number;
  }> = [
    {
      step: 0,
      action: 'Modelo inicial completo',
      predictors: [...currentPredictors],
      aic: currentFit.aic,
    },
  ];

  let stepNum = 1;
  let improved = true;
  const maxSteps = allPredictors.length * 4;

  while (improved && stepNum <= maxSteps) {
    improved = false;
    let bestAIC = currentFit.aic - 1e-7;
    let bestCandidate: string[] | null = null;
    let bestAction = '';

    // Try dropping one predictor
    for (const pred of currentPredictors) {
      const candidate = currentPredictors.filter((p) => p !== pred);
      const fit = fitRawOLS(trainRows, target, candidate);
      if (fit && fit.aic < bestAIC) {
        bestAIC = fit.aic;
        bestCandidate = candidate;
        bestAction = `- ${pred}`;
      }
    }

    // Try adding one excluded predictor
    const excluded = allPredictors.filter((p) => !currentPredictors.includes(p));
    for (const pred of excluded) {
      const candidate = [...currentPredictors, pred];
      const fit = fitRawOLS(trainRows, target, candidate);
      if (fit && fit.aic < bestAIC) {
        bestAIC = fit.aic;
        bestCandidate = candidate;
        bestAction = `+ ${pred}`;
      }
    }

    if (bestCandidate !== null) {
      const nextFit = fitRawOLS(trainRows, target, bestCandidate);
      if (nextFit) {
        currentPredictors = bestCandidate;
        currentFit = nextFit;
        trace.push({
          step: stepNum,
          action: bestAction,
          predictors: [...currentPredictors],
          aic: currentFit.aic,
        });
        stepNum++;
        improved = true;
      }
    }
  }

  const result = fitFullRegressionModel(
    'model2',
    'Modelo 2: Stepwise (AIC)',
    'Stepwise AIC',
    'Selección automática bidireccional que minimiza el Criterio de Información de Akaike (AIC).',
    trainRows,
    target,
    currentPredictors,
    sector
  );

  if (result) {
    result.stepwiseTrace = trace;
  }
  return result;
}

/**
 * Modelo 3: Best Subsets (equivalente a leaps::regsubsets(..., method="exhaustive"))
 */
export function fitBestSubsets(
  trainRows: DataRow[],
  target: string,
  allPredictors: string[],
  sector: EconomicSector
): RegressionModelResult | null {
  const p = allPredictors.length;
  if (p === 0) return null;

  const fullFit = fitRawOLS(trainRows, target, allPredictors);
  if (!fullFit) return null;

  const n = trainRows.length;
  const fullMse = fullFit.rss / Math.max(1, n - p - 1);

  const bestBySize: Array<{
    k: number;
    predictors: string[];
    r2: number;
    adjR2: number;
    mallowsCp: number;
    aic: number;
    bic: number;
    isOptimal: boolean;
  }> = [];

  if (p <= 12) {
    // Exhaustive search over all 2^p - 1 non-empty subsets
    const bestPerK = new Map<
      number,
      {
        predictors: string[];
        fit: RawOLSFit;
      }
    >();

    const totalMasks = 1 << p;
    for (let mask = 1; mask < totalMasks; mask++) {
      const subset: string[] = [];
      for (let bit = 0; bit < p; bit++) {
        if ((mask & (1 << bit)) !== 0) {
          subset.push(allPredictors[bit]);
        }
      }
      const k = subset.length;
      const fit = fitRawOLS(trainRows, target, subset);
      if (!fit) continue;

      const prev = bestPerK.get(k);
      if (!prev || fit.rss < prev.fit.rss) {
        bestPerK.set(k, { predictors: subset, fit });
      }
    }

    for (let k = 1; k <= p; k++) {
      const entry = bestPerK.get(k);
      if (!entry) continue;
      const cp = fullMse > 0 ? entry.fit.rss / fullMse - (n - 2 * (k + 1)) : k + 1;
      bestBySize.push({
        k,
        predictors: entry.predictors,
        r2: entry.fit.rSquared,
        adjR2: entry.fit.adjRSquared,
        mallowsCp: cp,
        aic: entry.fit.aic,
        bic: entry.fit.bic,
        isOptimal: false,
      });
    }
  } else {
    // Forward best subset path when p > 12 (2^p would be too large)
    let current: string[] = [];
    const remaining = [...allPredictors];
    for (let k = 1; k <= p; k++) {
      let bestPred = remaining[0];
      let bestFit: RawOLSFit | null = null;
      for (const cand of remaining) {
        const fit = fitRawOLS(trainRows, target, [...current, cand]);
        if (fit && (!bestFit || fit.rss < bestFit.rss)) {
          bestFit = fit;
          bestPred = cand;
        }
      }
      if (!bestFit) break;
      current = [...current, bestPred];
      const idx = remaining.indexOf(bestPred);
      if (idx >= 0) remaining.splice(idx, 1);
      const cp = fullMse > 0 ? bestFit.rss / fullMse - (n - 2 * (k + 1)) : k + 1;
      bestBySize.push({
        k,
        predictors: [...current],
        r2: bestFit.rSquared,
        adjR2: bestFit.adjRSquared,
        mallowsCp: cp,
        aic: bestFit.aic,
        bic: bestFit.bic,
        isOptimal: false,
      });
    }
  }

  if (bestBySize.length === 0) return null;

  // Select optimal subset prioritizing lowest BIC, breaking close ties by highest adjR2
  let optimalIdx = 0;
  for (let i = 1; i < bestBySize.length; i++) {
    if (bestBySize[i].bic < bestBySize[optimalIdx].bic) {
      optimalIdx = i;
    }
  }
  bestBySize[optimalIdx].isOptimal = true;
  const optimalPredictors = bestBySize[optimalIdx].predictors;

  const result = fitFullRegressionModel(
    'model3',
    'Modelo 3: Best Subsets (BIC)',
    'Best Subsets',
    p <= 12
      ? 'Búsqueda exhaustiva de todos los subconjuntos posibles optimizando BIC y R² ajustado.'
      : 'Selección secuencial de mejores subconjuntos por tamaño k optimizando BIC.',
    trainRows,
    target,
    optimalPredictors,
    sector
  );

  if (result) {
    result.bestSubsetsTable = bestBySize;
  }
  return result;
}

/**
 * Diagnóstico estadístico completo (Módulo 6):
 * Durbin-Watson, Breusch-Pagan, Shapiro-Wilk y VIF.
 */
export function computeDiagnostics(
  model: RegressionModelResult,
  trainRows: DataRow[]
): DiagnosticSummary {
  const residuals = model.observations.map((o) => o.residual);
  const n = residuals.length;

  // 1. Durbin-Watson
  let diffSqSum = 0;
  let resSqSum = 0;
  for (let i = 0; i < n; i++) {
    resSqSum += residuals[i] * residuals[i];
    if (i > 0) {
      const d = residuals[i] - residuals[i - 1];
      diffSqSum += d * d;
    }
  }
  const dw = resSqSum > 0 ? diffSqSum / resSqSum : 2;
  // Normal approximation for DW p-value (approx mean=2, var ≈ 4/n)
  const dwSe = Math.sqrt(4 / Math.max(4, n));
  const dwZ = Math.abs(dw - 2) / dwSe;
  const dwP = 2 * (1 - normCdf(dwZ));
  const dwStatus: 'Adecuado' | 'Precaución' | 'Alerta' =
    dw >= 1.5 && dw <= 2.5 ? 'Adecuado' : dw >= 1.2 && dw <= 2.8 ? 'Precaución' : 'Alerta';
  const dwInterp =
    dwStatus === 'Adecuado'
      ? `DW = ${dw.toFixed(3)} está cerca de 2.0, lo que indica ausencia de autocorrelación relevante en los residuos.`
      : `DW = ${dw.toFixed(3)} se aleja de 2.0, sugiriendo posible autocorrelación serial en el orden de las observaciones.`;

  // 2. Breusch-Pagan test (auxiliary regression of squared residuals on predictors)
  let bpStat = 0;
  let bpP = 1;
  const p = model.predictors.length;
  if (p > 0 && n > p + 2) {
    const meanSq = resSqSum / n;
    const auxRows: DataRow[] = trainRows.map((r, i) => ({
      ...r,
      __sq_res__: residuals[i] * residuals[i] - meanSq,
    }));
    const auxFit = fitRawOLS(auxRows, '__sq_res__', model.predictors);
    if (auxFit) {
      bpStat = Math.max(0, n * auxFit.rSquared);
      bpP = chiSqPValue(bpStat, p);
    }
  }
  const bpStatus: 'Homocedasticidad' | 'Heterocedasticidad' =
    bpP >= 0.05 ? 'Homocedasticidad' : 'Heterocedasticidad';
  const bpInterp =
    bpStatus === 'Homocedasticidad'
      ? `p = ${bpP.toFixed(4)} (≥ 0.05): no se rechaza la varianza constante de los errores (homocedasticidad).`
      : `p = ${bpP.toFixed(4)} (< 0.05): existe evidencia de heterocedasticidad (varianza no constante de los residuos).`;

  // 3. Shapiro-Wilk test on residuals
  const sw = shapiroWilkTest(residuals);
  const swStatus: 'Normalidad' | 'Desviación de normalidad' =
    sw.pValue >= 0.05 ? 'Normalidad' : 'Desviación de normalidad';
  const swInterp =
    swStatus === 'Normalidad'
      ? `W = ${sw.w.toFixed(4)}, p = ${sw.pValue.toFixed(4)} (≥ 0.05): los residuos son consistentes con una distribución normal.`
      : `W = ${sw.w.toFixed(4)}, p = ${sw.pValue.toFixed(4)} (< 0.05): los residuos muestran desviación de la normalidad; verifique valores atípicos en el gráfico Q-Q.`;

  // 4. VIF summary
  const vifSummary = model.coefficients
    .filter((c) => !c.isIntercept && c.vif !== null)
    .map((c) => {
      const val = c.vif ?? 1;
      const status: 'Bajo (< 5)' | 'Moderado (5 - 10)' | 'Severo (> 10)' =
        val < 5 ? 'Bajo (< 5)' : val <= 10 ? 'Moderado (5 - 10)' : 'Severo (> 10)';
      return {
        variable: c.term,
        vif: val,
        status,
      };
    });

  const maxCooksD = Math.max(0, ...model.observations.map((o) => o.cooksDistance));
  const cooksThreshold = 4 / Math.max(1, n);
  const influentialCount = model.observations.filter(
    (o) => o.cooksDistance > Math.max(0.5, cooksThreshold)
  ).length;

  const issueMessages: string[] = [];
  const severeVifs = vifSummary.filter((v) => v.vif > 10);
  if (severeVifs.length > 0) {
    issueMessages.push(
      `Multicolinealidad severa (VIF > 10) en: ${severeVifs.map((v) => v.variable).join(', ')}.`
    );
  }
  if (bpP < 0.01) {
    issueMessages.push('Heterocedasticidad marcada detectada por Breusch-Pagan (p < 0.01).');
  }
  if (sw.pValue < 0.01 && n >= 15) {
    issueMessages.push('Desviación fuerte de normalidad en residuos (Shapiro-Wilk p < 0.01).');
  }
  if (dwStatus === 'Alerta') {
    issueMessages.push(`Posible autocorrelación marcada (Durbin-Watson = ${dw.toFixed(2)}).`);
  }

  return {
    modelId: model.id,
    durbinWatson: {
      statistic: dw,
      pValue: dwP,
      status: dwStatus,
      interpretation: dwInterp,
    },
    breuschPagan: {
      statistic: bpStat,
      df: p,
      pValue: bpP,
      status: bpStatus,
      interpretation: bpInterp,
    },
    shapiroWilk: {
      statistic: sw.w,
      pValue: sw.pValue,
      status: swStatus,
      interpretation: swInterp,
    },
    vifSummary,
    maxCooksD,
    influentialCount,
    hasSevereIssues: severeVifs.length > 0 || dwStatus === 'Alerta',
    issueMessages,
  };
}

export function predictSingleRow(
  model: RegressionModelResult,
  row: DataRow | Record<string, number>
): number {
  let yHat = model.coefficients[0]?.estimate ?? 0;
  for (let j = 0; j < model.predictors.length; j++) {
    const predName = model.predictors[j];
    const coef = model.coefficients[j + 1]?.estimate ?? 0;
    const xVal = Number(row[predName] ?? 0);
    yHat += coef * xVal;
  }
  return yHat;
}

/**
 * Evaluación exclusiva en conjunto de prueba (Módulo 7)
 */
export function evaluateModelsOnTest(
  models: RegressionModelResult[],
  diagnosticsMap: Record<ModelId, DiagnosticSummary>,
  testRows: DataRow[],
  target: string
): EvaluationComparison | null {
  if (models.length === 0 || testRows.length === 0) return null;

  const metrics: ModelEvaluationMetrics[] = models.map((model) => {
    const preds: Array<{
      index: number;
      actual: number;
      predicted: number;
      error: number;
      absError: number;
    }> = [];

    let sumAbs = 0;
    let sumSq = 0;
    let sumPct = 0;
    let pctCount = 0;
    let ySum = 0;

    testRows.forEach((row, idx) => {
      const actual = Number(row[target]);
      const predicted = predictSingleRow(model, row);
      const error = actual - predicted;
      const absError = Math.abs(error);

      preds.push({
        index: idx + 1,
        actual,
        predicted,
        error,
        absError,
      });

      sumAbs += absError;
      sumSq += error * error;
      ySum += actual;
      if (Math.abs(actual) > 1e-8) {
        sumPct += absError / Math.abs(actual);
        pctCount++;
      }
    });

    const nTest = testRows.length;
    const mae = sumAbs / nTest;
    const mse = sumSq / nTest;
    const rmse = Math.sqrt(mse);
    const mape = pctCount > 0 ? (sumPct / pctCount) * 100 : null;

    const yMean = ySum / nTest;
    const tssTest = preds.reduce((s, p) => s + (p.actual - yMean) ** 2, 0);
    const testR2 = tssTest > 0 ? 1 - sumSq / tssTest : 0;

    const diag = diagnosticsMap[model.id];
    const maxVif =
      diag && diag.vifSummary.length > 0
        ? Math.max(...diag.vifSummary.map((v) => v.vif))
        : 1;

    return {
      modelId: model.id,
      modelName: model.name,
      predictorsCount: model.predictors.length,
      nTest,
      mae,
      mse,
      rmse,
      mape,
      testR2,
      trainAdjR2: model.adjRSquared,
      aic: model.aic,
      bic: model.bic,
      hasSevereStatisticalIssues: diag?.hasSevereIssues ?? false,
      maxVif,
      compositeRankScore: 0,
      predictions: preds,
    };
  });

  // Compute balanced score: lower RMSE/MAE/MSE, higher adjR2, penalty for severe statistical issues or unnecessary complexity
  const minRmse = Math.min(...metrics.map((m) => m.rmse));
  const minMae = Math.min(...metrics.map((m) => m.mae));
  const minMse = Math.min(...metrics.map((m) => m.mse));

  metrics.forEach((m) => {
    const rmseNorm = minRmse > 0 ? m.rmse / minRmse : 1;
    const maeNorm = minMae > 0 ? m.mae / minMae : 1;
    const mseNorm = minMse > 0 ? m.mse / minMse : 1;
    const adjR2Bonus = Math.max(0, m.trainAdjR2) * 0.4;
    const issuePenalty = m.hasSevereStatisticalIssues ? 0.35 : 0;
    const parsimonyBonus = m.predictorsCount > 0 ? 0.01 * m.predictorsCount : 0;

    // Lower score = better
    m.compositeRankScore =
      0.4 * rmseNorm + 0.3 * maeNorm + 0.2 * mseNorm - adjR2Bonus + issuePenalty + parsimonyBonus;
  });

  const sorted = [...metrics].sort((a, b) => a.compositeRankScore - b.compositeRankScore);
  const winner = sorted[0];
  const runnerUp = sorted[1];

  const highestR2Model = [...metrics].sort((a, b) => b.trainAdjR2 - a.trainAdjR2)[0];
  const r2Note =
    highestR2Model.modelId !== winner.modelId
      ? ` Se evitó elegir "${highestR2Model.modelName}" únicamente por su R² ajustado en entrenamiento (${(highestR2Model.trainAdjR2 * 100).toFixed(2)}%), ya que presentó mayor error fuera de muestra o menor equilibrio estadístico.`
      : '';

  const selectionReason = `Se seleccionó "${winner.modelName}" como modelo óptimo al lograr el mejor desempeño predictivo en el conjunto de prueba (RMSE = ${winner.rmse.toFixed(3)}, MAE = ${winner.mae.toFixed(3)}, MSE = ${winner.mse.toFixed(3)}) combinado con un R² ajustado de ${(winner.trainAdjR2 * 100).toFixed(2)}% en entrenamiento${
    !winner.hasSevereStatisticalIssues
      ? ' y sin alertas críticas de multicolinealidad o supuestos estadísticos.'
      : ', ponderando sus alertas diagnósticas frente al resto.'
  }${
    runnerUp
      ? ` Superó a "${runnerUp.modelName}" (RMSE = ${runnerUp.rmse.toFixed(3)}) en capacidad de generalización.`
      : ''
  }${r2Note}`;

  return {
    metrics,
    winningModelId: winner.modelId,
    selectionReason,
  };
}

/**
 * Predicción puntual + intervalo de confianza y de predicción al 95% (Módulo 8)
 */
export function generatePredictionRecord(
  model: RegressionModelResult,
  inputs: Record<string, number>,
  descriptiveStats: DescriptiveStats[],
  sector: EconomicSector
): PredictionRecord {
  const xVec = [1, ...model.predictors.map((p) => Number(inputs[p] ?? 0))];
  const beta = model.coefficients.map((c) => c.estimate);
  let predictedValue = 0;
  for (let i = 0; i < xVec.length; i++) {
    predictedValue += xVec[i] * beta[i];
  }

  const leverageNew = Math.max(0, quadForm(xVec, model.xtxInverse));
  const tCrit = tInv(0.975, Math.max(1, model.dfResidual));
  const seMean = model.residualStdError * Math.sqrt(leverageNew);
  const sePred = model.residualStdError * Math.sqrt(1 + leverageNew);

  const ciLower = predictedValue - tCrit * seMean;
  const ciUpper = predictedValue + tCrit * seMean;
  const piLower = predictedValue - tCrit * sePred;
  const piUpper = predictedValue + tCrit * sePred;

  const outOfRangeVars: string[] = [];
  for (const pred of model.predictors) {
    const stat = descriptiveStats.find((s) => s.column === pred);
    const val = inputs[pred];
    if (stat && (val < stat.min || val > stat.max)) {
      outOfRangeVars.push(pred);
    }
  }

  const rangeWarning =
    outOfRangeVars.length > 0
      ? ` Advertencia: las variables ${outOfRangeVars.join(', ')} están fuera del rango observado en los datos históricos, por lo que esta proyección implica extrapolación.`
      : ' Todos los valores ingresados se encuentran dentro del rango histórico observado.';

  const interpretation = `Para el sector ${sector}, bajo las condiciones especificadas, el valor esperado de "${model.target}" es ${predictedValue.toFixed(2)} (con un intervalo de predicción al 95% entre ${piLower.toFixed(2)} y ${piUpper.toFixed(2)}).${rangeWarning}`;

  return {
    id: `pred_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    inputs: { ...inputs },
    predictedValue,
    ciLower,
    ciUpper,
    piLower,
    piUpper,
    outOfRangeVars,
    interpretation,
  };
}

/**
 * Construcción de los 5 escenarios iniciales basados en percentiles reales del entrenamiento (Módulo 9)
 */
export function buildInitialScenarios(
  model: RegressionModelResult,
  trainStats: DescriptiveStats[]
): ScenarioState[] {
  const getStat = (col: string) => trainStats.find((s) => s.column === col);
  const coefMap = new Map<string, number>();
  model.coefficients.forEach((c) => {
    if (!c.isIntercept) coefMap.set(c.term, c.estimate);
  });

  const makeInputs = (mode: 'pessimistic' | 'conservative' | 'moderate' | 'optimistic') => {
    const obj: Record<string, number> = {};
    for (const pred of model.predictors) {
      const st = getStat(pred);
      if (!st) {
        obj[pred] = 0;
        continue;
      }
      const coef = coefMap.get(pred) ?? 0;
      const roundVal = (v: number) => Number(v.toFixed(2));

      // Align optimistic/pessimistic direction with coefficient sign
      if (mode === 'moderate') {
        obj[pred] = roundVal(st.median);
      } else if (mode === 'conservative') {
        // Slightly below median in favorable direction
        const step = 0.25 * (st.q3 - st.q1);
        obj[pred] = roundVal(coef >= 0 ? st.median - step * 0.5 : st.median + step * 0.5);
      } else if (mode === 'pessimistic') {
        obj[pred] = roundVal(coef >= 0 ? st.q1 : st.q3);
      } else {
        // optimistic
        obj[pred] = roundVal(coef >= 0 ? st.q3 : st.q1);
      }
      obj[pred] = Math.max(st.min, Math.min(st.max, obj[pred]));
    }
    return obj;
  };

  return [
    {
      key: 'pesimista',
      label: 'Escenario pesimista',
      description: 'Condiciones desfavorables basadas en el cuartil adverso histórico de cada predictor.',
      inputs: makeInputs('pessimistic'),
    },
    {
      key: 'conservador',
      label: 'Escenario conservador',
      description: 'Desempeño cauteloso ligeramente por debajo del comportamiento típico histórico.',
      inputs: makeInputs('conservative'),
    },
    {
      key: 'moderado',
      label: 'Escenario moderado (Base)',
      description: 'Escenario de referencia construido con la mediana histórica de las variables.',
      inputs: makeInputs('moderate'),
    },
    {
      key: 'optimista',
      label: 'Escenario optimista',
      description: 'Condiciones favorables basadas en el cuartil superior de desempeño histórico.',
      inputs: makeInputs('optimistic'),
    },
    {
      key: 'personalizado',
      label: 'Escenario personalizado',
      description: 'Ajusta libremente cada variable para evaluar estrategias específicas.',
      inputs: makeInputs('moderate'),
    },
  ];
}

export function evaluateScenarios(
  scenarios: ScenarioState[],
  model: RegressionModelResult,
  trainStats: DescriptiveStats[],
  sector: EconomicSector
): ScenarioComputedRow[] {
  const baseScenario = scenarios.find((s) => s.key === 'moderado') ?? scenarios[0];
  const basePrediction = predictSingleRow(model, baseScenario.inputs);

  return scenarios.map((sc) => {
    const predictedValue = predictSingleRow(model, sc.inputs);
    const diffFromBase = predictedValue - basePrediction;
    const pctChangeFromBase =
      Math.abs(basePrediction) > 1e-8 ? (diffFromBase / Math.abs(basePrediction)) * 100 : 0;

    const outOfRangeVars: string[] = [];
    for (const pred of model.predictors) {
      const st = trainStats.find((s) => s.column === pred);
      const v = sc.inputs[pred];
      if (st && (v < st.min || v > st.max)) {
        outOfRangeVars.push(pred);
      }
    }

    const directionLabel =
      sc.key === 'moderado'
        ? 'referencia base'
        : diffFromBase >= 0
        ? `un aumento de ${diffFromBase.toFixed(2)} (+${pctChangeFromBase.toFixed(1)}%) frente al escenario base`
        : `una reducción de ${Math.abs(diffFromBase).toFixed(2)} (${pctChangeFromBase.toFixed(1)}%) frente al escenario base`;

    const rangeAlert =
      outOfRangeVars.length > 0
        ? ` Alerta de extrapolación en: ${outOfRangeVars.join(', ')}.`
        : '';

    const interpretation = `En el sector ${sector}, el ${sc.label.toLowerCase()} estima "${model.target}" en ${predictedValue.toFixed(2)}, representando ${directionLabel}.${rangeAlert}`;

    return {
      ...sc,
      predictedValue,
      diffFromBase,
      pctChangeFromBase,
      outOfRangeVars,
      interpretation,
    };
  });
}
