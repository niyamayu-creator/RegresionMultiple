import React, { useMemo, useState } from 'react';
import {
  DatasetSummary,
  DescriptiveStats,
  DiagnosticSummary,
  EconomicSector,
  EvaluationComparison,
  ModelId,
  NavSectionId,
  PredictionRecord,
  RegressionModelResult,
  ScenarioPresetKey,
  ScenarioState,
  SplitConfig,
  SplitResult,
} from './types/analytics';
import {
  buildDemoMaosDataset,
  parseUploadedFile,
} from './lib/data/fileHandlers';
import {
  computeCorrelationMatrix,
  computeDescriptiveStats,
  removeDuplicateRows,
  suggestTargetVariable,
} from './lib/stats/descriptive';
import {
  buildInitialScenarios,
  computeDiagnostics,
  evaluateModelsOnTest,
  evaluateScenarios,
  fitBestSubsets,
  fitFullRegressionModel,
  fitStepwiseAIC,
  generatePredictionRecord,
  splitDataset,
} from './lib/stats/regression';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { HomeDashboard } from './components/modules/HomeDashboard';
import { DataUploadModule } from './components/modules/DataUploadModule';
import { ExploratoryModule } from './components/modules/ExploratoryModule';
import { VariableSelectionModule } from './components/modules/VariableSelectionModule';
import { RegressionModelsModule } from './components/modules/RegressionModelsModule';
import { DiagnosticsModule } from './components/modules/DiagnosticsModule';
import { EvaluationModule } from './components/modules/EvaluationModule';
import { PredictionsModule } from './components/modules/PredictionsModule';
import { ScenariosModule } from './components/modules/ScenariosModule';
import { FinalReportModule } from './components/modules/FinalReportModule';

interface ModelingState {
  splitResult: SplitResult;
  trainStats: DescriptiveStats[];
  models: RegressionModelResult[];
  diagnostics: Record<ModelId, DiagnosticSummary>;
  evaluation: EvaluationComparison;
}

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSectionId>('inicio');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [sector, setSector] = useState<EconomicSector>('Restaurantes');
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);

  const [excludedPredictors, setExcludedPredictors] = useState<string[]>([]);
  const [target, setTarget] = useState<string>('');
  const [targetConfirmed, setTargetConfirmed] = useState<boolean>(false);
  const [predictors, setPredictors] = useState<string[]>([]);
  const [simplePredictor, setSimplePredictor] = useState<string>('');

  const [splitConfig, setSplitConfig] = useState<SplitConfig>({
    trainRatio: 0.7,
    seed: 920203,
    chronological: false,
    handleMissing: 'omit',
  });

  const [modeling, setModeling] = useState<ModelingState | null>(null);
  const [selectedWinningModelId, setSelectedWinningModelId] = useState<ModelId>('model1');
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioState[]>([]);
  const [buildError, setBuildError] = useState<string | null>(null);

  // Derived EDA artifacts
  const numericColumns = useMemo(
    () => dataset?.columns.filter((c) => c.isNumeric && !c.hasZeroVariance).map((c) => c.name) ?? [],
    [dataset]
  );

  const descriptiveStats = useMemo(
    () => (dataset ? computeDescriptiveStats(dataset.rows, dataset.columns) : []),
    [dataset]
  );

  const { matrix: correlationMatrix, pairs: correlationPairs } = useMemo(
    () => computeCorrelationMatrix(dataset?.rows ?? [], numericColumns),
    [dataset, numericColumns]
  );

  const targetSuggestion = useMemo(
    () => (dataset ? suggestTargetVariable(sector, dataset.columns, correlationPairs) : null),
    [dataset, sector, correlationPairs]
  );

  const initializeDatasetState = (loaded: DatasetSummary, activeSector: EconomicSector) => {
    setDataset(loaded);
    setModeling(null);
    setPredictions([]);
    setScenarios([]);
    setExcludedPredictors([]);
    setBuildError(null);

    const numCols = loaded.columns
      .filter((c) => c.isNumeric && !c.hasZeroVariance)
      .map((c) => c.name);
    const { pairs } = computeCorrelationMatrix(loaded.rows, numCols);
    const suggestion = suggestTargetVariable(activeSector, loaded.columns, pairs);

    if (suggestion) {
      // Suggest target WITHOUT confirming until user confirms
      setTarget(suggestion.suggestedTarget);
      setTargetConfirmed(false);
      const candPreds = suggestion.recommendedPredictors;
      setPredictors(candPreds);

      // Default simple predictor: highest |r| with target (matches Bowl Price in demo if correlated)
      const bestSimple =
        pairs
          .filter(
            (p) =>
              (p.varA === suggestion.suggestedTarget && candPreds.includes(p.varB)) ||
              (p.varB === suggestion.suggestedTarget && candPreds.includes(p.varA))
          )
          .sort((a, b) => b.absR - a.absR)[0];

      if (candPreds.includes('Bowl Price')) {
        setSimplePredictor('Bowl Price');
      } else if (bestSimple) {
        setSimplePredictor(
          bestSimple.varA === suggestion.suggestedTarget ? bestSimple.varB : bestSimple.varA
        );
      } else {
        setSimplePredictor(candPreds[0] ?? '');
      }
    } else {
      setTarget('');
      setTargetConfirmed(false);
      setPredictors([]);
      setSimplePredictor('');
    }
  };

  const handleUploadFile = async (file: File) => {
    const loaded = await parseUploadedFile(file);
    initializeDatasetState(loaded, sector);
  };

  const handleLoadDemo = () => {
    const demoSector: EconomicSector = 'Restaurantes';
    setSector(demoSector);
    const demoData = buildDemoMaosDataset();
    initializeDatasetState(demoData, demoSector);
    setActiveSection('cargar');
  };

  const handleRemoveDuplicates = () => {
    if (!dataset) return;
    const cleaned = removeDuplicateRows(dataset);
    initializeDatasetState(cleaned, sector);
  };

  const handleToggleExcludePredictor = (col: string) => {
    setExcludedPredictors((prev) => {
      const next = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col];
      // Reflect decision on active predictor list if col isn't target
      if (col !== target) {
        setPredictors((curr) =>
          next.includes(col)
            ? curr.filter((p) => p !== col)
            : curr.includes(col)
            ? curr
            : [...curr, col]
        );
      }
      return next;
    });
  };

  const handleSelectTarget = (col: string, confirm = true) => {
    setTarget(col);
    setTargetConfirmed(confirm);
    const available = numericColumns.filter(
      (c) => c !== col && !excludedPredictors.includes(c)
    );
    setPredictors(available);
    if (!available.includes(simplePredictor)) {
      setSimplePredictor(available[0] ?? '');
    }
    setModeling(null);
  };

  const handleConfirmSuggestion = () => {
    if (!targetSuggestion) return;
    handleSelectTarget(targetSuggestion.suggestedTarget, true);
  };

  const handleTogglePredictor = (col: string) => {
    setPredictors((prev) => {
      const next = prev.includes(col) ? prev.filter((p) => p !== col) : [...prev, col];
      if (!next.includes(simplePredictor)) {
        setSimplePredictor(next[0] ?? '');
      }
      return next;
    });
    setModeling(null);
  };

  const handleBuildModels = () => {
    if (!dataset || !target || !targetConfirmed || predictors.length === 0) return;
    setBuildError(null);

    const splitResult = splitDataset(dataset.rows, target, predictors, splitConfig);
    if (splitResult.trainRows.length <= predictors.length + 1) {
      setBuildError(
        'No hay suficientes observaciones en entrenamiento para estimar todos los coeficientes.'
      );
      return;
    }

    const trainStats = computeDescriptiveStats(splitResult.trainRows, dataset.columns);
    const activeSimplePred = predictors.includes(simplePredictor)
      ? simplePredictor
      : predictors[0];

    const m0 = fitFullRegressionModel(
      'model0',
      'Modelo 0: Regresión Lineal Simple',
      'Lineal Simple',
      `Regresión lineal simple usando exclusivamente "${activeSimplePred}" como predictor de "${target}".`,
      splitResult.trainRows,
      target,
      [activeSimplePred],
      sector
    );

    const m1 = fitFullRegressionModel(
      'model1',
      'Modelo 1: Regresión Lineal Múltiple',
      'Lineal Múltiple',
      `Modelo completo incorporando todas las ${predictors.length} variables predictoras seleccionadas.`,
      splitResult.trainRows,
      target,
      predictors,
      sector
    );

    const m2 = fitStepwiseAIC(splitResult.trainRows, target, predictors, sector);
    const m3 = fitBestSubsets(splitResult.trainRows, target, predictors, sector);

    const builtModels = [m0, m1, m2, m3].filter(
      (m): m is RegressionModelResult => m !== null
    );

    if (builtModels.length === 0) {
      setBuildError(
        'No fue posible ajustar los modelos debido a colinealidad exacta o matriz singular en las variables seleccionadas.'
      );
      return;
    }

    const diagRecord: Partial<Record<ModelId, DiagnosticSummary>> = {};
    for (const model of builtModels) {
      diagRecord[model.id] = computeDiagnostics(model, splitResult.trainRows);
    }
    const diagnostics = diagRecord as Record<ModelId, DiagnosticSummary>;

    const evaluation = evaluateModelsOnTest(
      builtModels,
      diagnostics,
      splitResult.testRows,
      target
    );

    if (!evaluation) {
      setBuildError('No hay suficientes datos de prueba para evaluar los modelos.');
      return;
    }

    const winnerModel =
      builtModels.find((m) => m.id === evaluation.winningModelId) ?? builtModels[0];

    setModeling({
      splitResult,
      trainStats,
      models: builtModels,
      diagnostics,
      evaluation,
    });
    setSelectedWinningModelId(winnerModel.id);
    setPredictions([]);
    setScenarios(buildInitialScenarios(winnerModel, trainStats));
    setActiveSection('modelos');
  };

  const winningModel = useMemo(() => {
    if (!modeling) return null;
    return (
      modeling.models.find((m) => m.id === selectedWinningModelId) ?? modeling.models[0] ?? null
    );
  }, [modeling, selectedWinningModelId]);

  const handleSelectWinningModel = (id: ModelId) => {
    setSelectedWinningModelId(id);
    if (modeling) {
      const m = modeling.models.find((mod) => mod.id === id);
      if (m) {
        setScenarios(buildInitialScenarios(m, modeling.trainStats));
      }
    }
  };

  const handleGeneratePrediction = (inputs: Record<string, number>) => {
    if (!winningModel || !modeling) return;
    const record = generatePredictionRecord(
      winningModel,
      inputs,
      modeling.trainStats,
      sector
    );
    setPredictions((prev) => [record, ...prev]);
  };

  const handleUpdateScenarioInput = (
    scenarioKey: ScenarioPresetKey,
    variable: string,
    value: number
  ) => {
    setScenarios((prev) =>
      prev.map((sc) =>
        sc.key === scenarioKey
          ? { ...sc, inputs: { ...sc.inputs, [variable]: value } }
          : sc
      )
    );
  };

  const handleResetScenarios = () => {
    if (!winningModel || !modeling) return;
    setScenarios(buildInitialScenarios(winningModel, modeling.trainStats));
  };

  const computedScenarios = useMemo(() => {
    if (!winningModel || !modeling || scenarios.length === 0) return [];
    return evaluateScenarios(scenarios, winningModel, modeling.trainStats, sector);
  }, [scenarios, winningModel, modeling, sector]);

  const completedSections = useMemo(() => {
    const done = new Set<NavSectionId>();
    done.add('inicio');
    if (dataset) {
      done.add('cargar');
      done.add('exploratorio');
    }
    if (dataset && target && targetConfirmed && predictors.length > 0) {
      done.add('variables');
    }
    if (modeling) {
      done.add('modelos');
      done.add('diagnostico');
      done.add('evaluacion');
      done.add('informe');
    }
    if (predictions.length > 0) {
      done.add('predicciones');
    }
    if (computedScenarios.length > 0) {
      done.add('escenarios');
    }
    return done;
  }, [dataset, target, targetConfirmed, predictors.length, modeling, predictions.length, computedScenarios.length]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        hasDataset={Boolean(dataset)}
        hasModels={Boolean(modeling)}
        completedSections={completedSections}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeSection={activeSection}
          sector={sector}
          fileName={dataset?.fileName ?? null}
          hasModels={Boolean(modeling)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigate={setActiveSection}
        />

        <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {buildError && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900">
              {buildError}
            </div>
          )}

          {activeSection === 'inicio' && (
            <HomeDashboard
              sector={sector}
              dataset={dataset}
              target={targetConfirmed ? target : ''}
              predictors={predictors}
              winningModel={winningModel}
              evaluation={modeling?.evaluation ?? null}
              onNavigate={setActiveSection}
              onLoadDemo={handleLoadDemo}
            />
          )}

          {activeSection === 'cargar' && (
            <DataUploadModule
              sector={sector}
              onChangeSector={(s) => {
                setSector(s);
                setModeling(null);
              }}
              dataset={dataset}
              onUploadFile={handleUploadFile}
              onLoadDemo={handleLoadDemo}
              onRemoveDuplicates={handleRemoveDuplicates}
              onContinueToEDA={() => setActiveSection('exploratorio')}
            />
          )}

          {activeSection === 'exploratorio' && dataset && (
            <ExploratoryModule
              sector={sector}
              dataset={dataset}
              descriptiveStats={descriptiveStats}
              correlationMatrix={correlationMatrix}
              correlationPairs={correlationPairs}
              numericColumns={numericColumns}
              excludedPredictors={excludedPredictors}
              onToggleExcludePredictor={handleToggleExcludePredictor}
              onContinueToVariables={() => setActiveSection('variables')}
            />
          )}

          {activeSection === 'variables' && dataset && (
            <VariableSelectionModule
              sector={sector}
              dataset={dataset}
              suggestion={targetSuggestion}
              target={target}
              targetConfirmed={targetConfirmed}
              predictors={predictors}
              simplePredictor={simplePredictor}
              excludedPredictors={excludedPredictors}
              correlationPairs={correlationPairs}
              splitConfig={splitConfig}
              onSelectTarget={handleSelectTarget}
              onConfirmSuggestion={handleConfirmSuggestion}
              onTogglePredictor={handleTogglePredictor}
              onChangeSimplePredictor={setSimplePredictor}
              onChangeSplitConfig={(cfg) => {
                setSplitConfig(cfg);
                setModeling(null);
              }}
              onBuildModels={handleBuildModels}
            />
          )}

          {activeSection === 'modelos' && modeling && (
            <RegressionModelsModule
              sector={sector}
              models={modeling.models}
              splitConfig={splitConfig}
              splitResult={modeling.splitResult}
              onContinueToDiagnostics={() => setActiveSection('diagnostico')}
            />
          )}

          {activeSection === 'diagnostico' && modeling && (
            <DiagnosticsModule
              models={modeling.models}
              diagnostics={modeling.diagnostics}
              onContinueToEvaluation={() => setActiveSection('evaluacion')}
            />
          )}

          {activeSection === 'evaluacion' && modeling && (
            <EvaluationModule
              evaluation={modeling.evaluation}
              target={target}
              selectedWinningModelId={selectedWinningModelId}
              onSelectWinningModel={handleSelectWinningModel}
              onContinueToPredictions={() => setActiveSection('predicciones')}
            />
          )}

          {activeSection === 'predicciones' && modeling && winningModel && (
            <PredictionsModule
              sector={sector}
              winningModel={winningModel}
              trainStats={modeling.trainStats}
              predictions={predictions}
              onGeneratePrediction={handleGeneratePrediction}
              onClearPredictions={() => setPredictions([])}
              onContinueToScenarios={() => setActiveSection('escenarios')}
            />
          )}

          {activeSection === 'escenarios' && modeling && winningModel && (
            <ScenariosModule
              sector={sector}
              winningModel={winningModel}
              trainStats={modeling.trainStats}
              computedScenarios={computedScenarios}
              onUpdateScenarioInput={handleUpdateScenarioInput}
              onResetScenarios={handleResetScenarios}
              onContinueToReport={() => setActiveSection('informe')}
            />
          )}

          {activeSection === 'informe' && dataset && modeling && winningModel && (
            <FinalReportModule
              sector={sector}
              dataset={dataset}
              descriptiveStats={descriptiveStats}
              correlationPairs={correlationPairs}
              target={target}
              predictors={predictors}
              simplePredictor={simplePredictor}
              splitConfig={splitConfig}
              splitResult={modeling.splitResult}
              models={modeling.models}
              diagnostics={modeling.diagnostics}
              evaluation={modeling.evaluation}
              winningModel={winningModel}
              predictions={predictions}
              scenarios={computedScenarios}
            />
          )}
        </main>
      </div>
    </div>
  );
}
