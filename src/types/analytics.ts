export type NavSectionId =
  | 'inicio'
  | 'cargar'
  | 'exploratorio'
  | 'variables'
  | 'modelos'
  | 'diagnostico'
  | 'evaluacion'
  | 'predicciones'
  | 'escenarios'
  | 'informe';

export type EconomicSector =
  | 'Comercio'
  | 'Restaurantes'
  | 'Manufactura'
  | 'Agricultura'
  | 'Transporte'
  | 'Servicios'
  | 'Tecnología'
  | 'Construcción'
  | 'Salud'
  | 'Educación'
  | 'Otro';

export type VariableType =
  | 'numeric_continuous'
  | 'numeric_discrete'
  | 'categorical'
  | 'datetime'
  | 'boolean';

export type DataRow = Record<string, string | number | boolean | null>;

export interface ColumnProfile {
  name: string;
  type: VariableType;
  typeLabel: string;
  totalCount: number;
  validCount: number;
  missingCount: number;
  uniqueCount: number;
  isNumeric: boolean;
  hasZeroVariance: boolean;
  sampleValues: Array<string | number | boolean | null>;
}

export interface DatasetSummary {
  fileName: string;
  fileSizeBytes: number;
  isDemo: boolean;
  rowCount: number;
  columnCount: number;
  totalMissing: number;
  duplicateRowCount: number;
  columns: ColumnProfile[];
  rows: DataRow[];
}

export interface DescriptiveStats {
  column: string;
  n: number;
  missing: number;
  min: number;
  q1: number;
  median: number;
  mean: number;
  q3: number;
  max: number;
  range: number;
  iqr: number;
  stdDev: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  lowerWhisker: number;
  upperWhisker: number;
  outliers: number[];
}

export interface CorrelationPair {
  varA: string;
  varB: string;
  r: number;
  absR: number;
  pValue: number;
  isHighCollinearity: boolean;
}

export interface TargetSuggestion {
  suggestedTarget: string;
  reason: string;
  confidenceLabel: 'Alta' | 'Media' | 'Baja';
  recommendedPredictors: string[];
}

export interface SplitConfig {
  trainRatio: number; // e.g. 0.70, 0.80
  seed: number;
  chronological: boolean;
  handleMissing: 'omit' | 'block';
}

export interface SplitResult {
  trainRows: DataRow[];
  testRows: DataRow[];
  trainIndices: number[];
  testIndices: number[];
  omittedCount: number;
}

export type ModelId = 'model0' | 'model1' | 'model2' | 'model3';

export interface CoefficientEstimate {
  term: string;
  isIntercept: boolean;
  estimate: number;
  stdError: number;
  tStat: number;
  pValue: number;
  ciLower: number;
  ciUpper: number;
  vif: number | null;
  significant: boolean;
  significanceCode: '***' | '**' | '*' | '.' | '';
  sectorInterpretation: string;
}

export interface ResidualObservation {
  index: number;
  actual: number;
  fitted: number;
  residual: number;
  standardizedResidual: number;
  sqrtAbsStdResidual: number;
  leverage: number;
  cooksDistance: number;
  theoreticalQuantile: number;
}

export interface RegressionModelResult {
  id: ModelId;
  name: string;
  shortLabel: string;
  description: string;
  target: string;
  predictors: string[];
  nTrain: number;
  dfResidual: number;
  dfModel: number;
  equation: string;
  coefficients: CoefficientEstimate[];
  rSquared: number;
  adjRSquared: number;
  residualStdError: number;
  fStatistic: number;
  fPValue: number;
  aic: number;
  bic: number;
  rss: number;
  tss: number;
  xtxInverse: number[][];
  observations: ResidualObservation[];
  warnings: string[];
  stepwiseTrace?: Array<{
    step: number;
    action: string;
    predictors: string[];
    aic: number;
  }>;
  bestSubsetsTable?: Array<{
    k: number;
    predictors: string[];
    r2: number;
    adjR2: number;
    mallowsCp: number;
    aic: number;
    bic: number;
    isOptimal: boolean;
  }>;
}

export interface DiagnosticSummary {
  modelId: ModelId;
  durbinWatson: {
    statistic: number;
    pValue: number;
    status: 'Adecuado' | 'Precaución' | 'Alerta';
    interpretation: string;
  };
  breuschPagan: {
    statistic: number;
    df: number;
    pValue: number;
    status: 'Homocedasticidad' | 'Heterocedasticidad';
    interpretation: string;
  };
  shapiroWilk: {
    statistic: number;
    pValue: number;
    status: 'Normalidad' | 'Desviación de normalidad';
    interpretation: string;
  };
  vifSummary: Array<{
    variable: string;
    vif: number;
    status: 'Bajo (< 5)' | 'Moderado (5 - 10)' | 'Severo (> 10)';
  }>;
  maxCooksD: number;
  influentialCount: number;
  hasSevereIssues: boolean;
  issueMessages: string[];
}

export interface ModelEvaluationMetrics {
  modelId: ModelId;
  modelName: string;
  predictorsCount: number;
  nTest: number;
  mae: number;
  mse: number;
  rmse: number;
  mape: number | null;
  testR2: number;
  trainAdjR2: number;
  aic: number;
  bic: number;
  hasSevereStatisticalIssues: boolean;
  maxVif: number;
  compositeRankScore: number;
  predictions: Array<{
    index: number;
    actual: number;
    predicted: number;
    error: number;
    absError: number;
  }>;
}

export interface EvaluationComparison {
  metrics: ModelEvaluationMetrics[];
  winningModelId: ModelId;
  selectionReason: string;
}

export interface PredictionRecord {
  id: string;
  createdAt: string;
  inputs: Record<string, number>;
  predictedValue: number;
  ciLower: number;
  ciUpper: number;
  piLower: number;
  piUpper: number;
  outOfRangeVars: string[];
  interpretation: string;
}

export type ScenarioPresetKey =
  | 'pesimista'
  | 'conservador'
  | 'moderado'
  | 'optimista'
  | 'personalizado';

export interface ScenarioState {
  key: ScenarioPresetKey;
  label: string;
  description: string;
  inputs: Record<string, number>;
}

export interface ScenarioComputedRow extends ScenarioState {
  predictedValue: number;
  diffFromBase: number;
  pctChangeFromBase: number;
  outOfRangeVars: string[];
  interpretation: string;
}
