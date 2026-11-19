import React, { useState } from 'react';

interface CorrelationHeatmapProps {
  variables: string[];
  matrix: number[][];
  onSelectPair?: (varA: string, varB: string) => void;
}

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({
  variables,
  matrix,
  onSelectPair,
}) => {
  const [upperOnly, setUpperOnly] = useState<boolean>(true);
  const [hovered, setHovered] = useState<{ i: number; j: number } | null>(null);

  if (variables.length === 0) return null;

  const getCellStyle = (r: number, isDiag: boolean): React.CSSProperties => {
    if (isDiag) {
      return { backgroundColor: '#f1f5f9', color: '#475569' };
    }
    const abs = Math.min(1, Math.abs(r));
    if (r >= 0) {
      // Indigo intensity
      const alpha = 0.08 + abs * 0.72;
      return {
        backgroundColor: `rgba(79, 70, 229, ${alpha.toFixed(3)})`,
        color: abs > 0.52 ? '#ffffff' : '#1e293b',
      };
    } else {
      // Rose/Coral intensity for negative correlation
      const alpha = 0.08 + abs * 0.72;
      return {
        backgroundColor: `rgba(225, 29, 72, ${alpha.toFixed(3)})`,
        color: abs > 0.52 ? '#ffffff' : '#1e293b',
      };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Coeficiente de correlación de Pearson (r). Valores con |r| &gt; 0.60 se marcan con borde ámbar.
        </p>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setUpperOnly(true)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              upperOnly ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Triangular superior
          </button>
          <button
            type="button"
            onClick={() => setUpperOnly(false)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              !upperOnly ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Matriz completa
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-2 text-left font-medium text-slate-500">Variable</th>
              {variables.map((v) => (
                <th
                  key={v}
                  className="max-w-[110px] truncate p-2 text-center font-medium text-slate-700"
                  title={v}
                >
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variables.map((rowVar, i) => (
              <tr key={rowVar} className="border-t border-slate-100">
                <td className="max-w-[130px] truncate p-2 font-medium text-slate-700" title={rowVar}>
                  {rowVar}
                </td>
                {variables.map((colVar, j) => {
                  const hideLower = upperOnly && i > j;
                  if (hideLower) {
                    return <td key={colVar} className="p-1" />;
                  }
                  const val = matrix[i]?.[j] ?? 0;
                  const isDiag = i === j;
                  const isHigh = !isDiag && Math.abs(val) > 0.6;
                  const isHovered = hovered?.i === i && hovered?.j === j;

                  return (
                    <td key={colVar} className="p-1">
                      <button
                        type="button"
                        onMouseEnter={() => setHovered({ i, j })}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => {
                          if (!isDiag && onSelectPair) onSelectPair(rowVar, colVar);
                        }}
                        style={getCellStyle(val, isDiag)}
                        className={`flex h-10 w-full min-w-[62px] items-center justify-center rounded-md font-mono text-xs font-medium tabular-nums transition-transform ${
                          isHigh ? 'ring-2 ring-amber-400 ring-inset' : ''
                        } ${isHovered && !isDiag ? 'scale-[1.03]' : ''} ${
                          !isDiag && onSelectPair ? 'cursor-pointer' : 'cursor-default'
                        }`}
                        title={`${rowVar} vs ${colVar}: r = ${val.toFixed(4)}`}
                      >
                        {val.toFixed(2)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hovered && hovered.i !== hovered.j && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Relación entre <span className="font-semibold text-slate-900">{variables[hovered.i]}</span> y{' '}
          <span className="font-semibold text-slate-900">{variables[hovered.j]}</span>:{' '}
          <span className="font-mono font-semibold tabular-nums">
            r = {(matrix[hovered.i]?.[hovered.j] ?? 0).toFixed(4)}
          </span>
          {onSelectPair && ' · Haz clic para graficar este par en el diagrama de dispersión.'}
        </div>
      )}
    </div>
  );
};
