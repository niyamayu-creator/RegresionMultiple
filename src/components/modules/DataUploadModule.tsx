import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Play,
  Trash2,
  Upload,
} from 'lucide-react';
import { DatasetSummary, EconomicSector } from '../../types/analytics';

const SECTORS: EconomicSector[] = [
  'Restaurantes',
  'Comercio',
  'Manufactura',
  'Agricultura',
  'Transporte',
  'Servicios',
  'Tecnología',
  'Construcción',
  'Salud',
  'Educación',
  'Otro',
];

interface DataUploadModuleProps {
  sector: EconomicSector;
  onChangeSector: (sector: EconomicSector) => void;
  dataset: DatasetSummary | null;
  onUploadFile: (file: File) => Promise<void>;
  onLoadDemo: () => void;
  onRemoveDuplicates: () => void;
  onContinueToEDA: () => void;
}

export const DataUploadModule: React.FC<DataUploadModuleProps> = ({
  sector,
  onChangeSector,
  dataset,
  onUploadFile,
  onLoadDemo,
  onRemoveDuplicates,
  onContinueToEDA,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await onUploadFile(files[0]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo procesar el archivo.');
    } finally {
      setIsLoading(false);
    }
  };

  const numericValidCols = dataset?.columns.filter((c) => c.isNumeric && !c.hasZeroVariance) ?? [];
  const hasEnoughCols = numericValidCols.length >= 2;
  const hasEnoughRows = (dataset?.rowCount ?? 0) >= 8;

  const displayedRows = dataset
    ? showAllRows
      ? dataset.rows.slice(0, 50)
      : dataset.rows.slice(0, 2)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Módulo 1. Configuración y Carga de Datos
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Define el sector económico y carga tu archivo Excel (.xlsx, .xls) o CSV. Todo el
            procesamiento ocurre localmente en tu navegador.
          </p>
        </div>
        {dataset && (
          <button
            type="button"
            onClick={onContinueToEDA}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
          >
            Continuar a Análisis Exploratorio
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Step 1: Sector + Upload */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <h2 className="text-base font-semibold text-slate-900">1. Sector económico</h2>
          <p className="mt-1 text-xs text-slate-500">
            Contextualiza automáticamente las sugerencias, interpretaciones de coeficientes y
            conclusiones de negocio.
          </p>

          <div className="mt-4">
            <label htmlFor="sector-select" className="block text-xs font-medium text-slate-700">
              Selecciona el sector económico
            </label>
            <select
              id="sector-select"
              value={sector}
              onChange={(e) => onChangeSector(e.target.value as EconomicSector)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="text-xs font-semibold text-slate-900">Dataset de demostración opcional</h3>
            <p className="mt-1 text-xs text-slate-500">
              Basado en 186 días de venta del script base R (Mao&apos;s Bowls): incluye{' '}
              <span className="font-mono">Bowl Price</span>, <span className="font-mono">Bowls</span>,{' '}
              <span className="font-mono">Soda</span> y <span className="font-mono">Beer</span>.
            </p>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                onLoadDemo();
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100"
            >
              <Play className="h-3.5 w-3.5 text-indigo-600" />
              Cargar dataset de demostración (MAOSBASE)
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <h2 className="text-base font-semibold text-slate-900">2. Cargar archivo Excel o CSV</h2>
          <p className="mt-1 text-xs text-slate-500">
            Arrastra y suelta tu archivo o haz clic para seleccionarlo desde tu equipo.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              void handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            className={`mt-4 flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-slate-300 bg-slate-50/60 hover:border-indigo-400 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Upload className="h-8 w-8 text-indigo-600" />
            <p className="mt-3 text-sm font-medium text-slate-900">
              {isLoading ? 'Procesando archivo...' : 'Arrastra tu archivo aquí o haz clic para examinar'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Formatos compatibles: Excel (.xlsx, .xls) y CSV (.csv) con encabezados en la primera fila
            </p>
          </div>

          {errorMsg && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Dataset Profile */}
      {dataset && (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Archivo</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={dataset.fileName}>
                {dataset.fileName}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {dataset.isDemo ? 'Dataset de demostración' : `${(dataset.fileSizeBytes / 1024).toFixed(1)} KB`}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Registros</p>
              <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                {dataset.rowCount}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Observaciones totales</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Variables</p>
              <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                {dataset.columnCount}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {numericValidCols.length} numéricas utilizables
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Valores faltantes</p>
              <p
                className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
                  dataset.totalMissing > 0 ? 'text-amber-600' : 'text-emerald-700'
                }`}
              >
                {dataset.totalMissing}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {dataset.totalMissing === 0 ? 'Base completa' : 'Requiere revisión al modelar'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Registros duplicados</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p
                  className={`font-mono text-xl font-semibold tabular-nums ${
                    dataset.duplicateRowCount > 0 ? 'text-amber-600' : 'text-slate-900'
                  }`}
                >
                  {dataset.duplicateRowCount}
                </p>
                {dataset.duplicateRowCount > 0 && (
                  <button
                    type="button"
                    onClick={onRemoveDuplicates}
                    className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
                    title="Eliminar filas duplicadas"
                  >
                    <Trash2 className="h-3 w-3" />
                    Limpiar
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">Filas idénticas</p>
            </div>
          </div>

          {/* Statistical Readiness Banner */}
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${
              hasEnoughCols && hasEnoughRows
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            {hasEnoughCols && hasEnoughRows ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            )}
            <div>
              <p className="font-semibold">
                {hasEnoughCols && hasEnoughRows
                  ? 'Validación inicial aprobada para regresión lineal'
                  : 'Advertencia de suficiencia estadística'}
              </p>
              <p className="mt-0.5">
                {!hasEnoughRows
                  ? `El dataset tiene solo ${dataset.rowCount} registros; se recomiendan al menos 8 observaciones para dividir en entrenamiento y prueba.`
                  : !hasEnoughCols
                  ? 'Se requieren al menos 2 variables numéricas con varianza distinta de cero para construir modelos de regresión.'
                  : `Se detectaron ${numericValidCols.length} variables numéricas válidas y ${dataset.rowCount} observaciones. Puedes avanzar al Análisis Exploratorio.`}
              </p>
            </div>
          </div>

          {/* Interactive First 2 Rows Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Vista previa de registros ({showAllRows ? `primeras ${displayedRows.length} filas` : 'primeras 2 filas'})
                </h2>
                <p className="text-xs text-slate-500">
                  Inspección directa de las primeras observaciones leídas del archivo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllRows((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {showAllRows ? 'Mostrar solo las primeras 2 filas' : `Expandir vista (${Math.min(50, dataset.rowCount)} filas)`}
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-2.5 font-medium">#</th>
                    {dataset.columns.map((col) => (
                      <th key={col.name} className="border-b border-slate-200 px-3 py-2.5 font-medium whitespace-nowrap">
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-mono text-slate-400 tabular-nums">{idx + 1}</td>
                      {dataset.columns.map((col) => {
                        const val = row[col.name];
                        return (
                          <td
                            key={col.name}
                            className={`px-3 py-2 whitespace-nowrap ${
                              col.isNumeric ? 'font-mono tabular-nums text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            {val === null || val === undefined ? (
                              <span className="text-amber-600">NA</span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detected Variable Types Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Estructura y tipos de variables detectados
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Equivalente al comando <span className="font-mono">str()</span> en RStudio: verifica tipos, valores únicos y datos faltantes por columna.
            </p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Variable</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Tipo detectado</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-right font-medium">Válidos</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-right font-medium">Faltantes</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-right font-medium">Únicos</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataset.columns.map((col) => (
                    <tr key={col.name} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 font-medium text-slate-900">{col.name}</td>
                      <td className="px-3 py-2.5 text-slate-600">{col.typeLabel}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                        {col.validCount}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                          col.missingCount > 0 ? 'font-semibold text-amber-700' : 'text-slate-600'
                        }`}
                      >
                        {col.missingCount}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                        {col.uniqueCount}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {!col.isNumeric
                          ? 'No numérica (excluida de OLS)'
                          : col.hasZeroVariance
                          ? 'Varianza cero (constante)'
                          : col.missingCount > 0
                          ? 'Apta (requiere omitir NA)'
                          : 'Apta para regresión'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
