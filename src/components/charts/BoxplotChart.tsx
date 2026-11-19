import React, { useState } from 'react';
import { DescriptiveStats } from '../../types/analytics';

interface BoxplotChartProps {
  stats: DescriptiveStats[];
  selectedVariables: string[];
}

export const BoxplotChart: React.FC<BoxplotChartProps> = ({ stats, selectedVariables }) => {
  const [hoveredVar, setHoveredVar] = useState<string | null>(null);
  const [normalizeScale, setNormalizeScale] = useState<boolean>(false);

  const visibleStats = stats.filter((s) => selectedVariables.includes(s.column));

  if (visibleStats.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
        Selecciona al menos una variable o producto para visualizar el diagrama de caja.
      </div>
    );
  }

  const width = 680;
  const height = 280;
  const padLeft = 56;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const mapVal = (val: number, s: DescriptiveStats, globalMin: number, globalMax: number) => {
    if (normalizeScale) {
      const span = s.max - s.min || 1;
      return (val - s.min) / span;
    }
    const span = globalMax - globalMin || 1;
    return (val - globalMin) / span;
  };

  const globalMin = Math.min(...visibleStats.map((s) => s.min));
  const globalMax = Math.max(...visibleStats.map((s) => s.max));

  const yFromNorm = (norm: number) => padTop + plotH * (1 - norm);

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const hoveredStat = visibleStats.find((s) => s.column === hoveredVar) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Muestra mínimo, Q1, mediana, Q3, máximo y valores atípicos (criterio 1.5 × IQR).
        </p>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setNormalizeScale(false)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              !normalizeScale
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Escala original
          </button>
          <button
            type="button"
            onClick={() => setNormalizeScale(true)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              normalizeScale
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Escala normalizada (0–100%)
          </button>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[460px] select-none"
          role="img"
          aria-label="Diagrama de caja por variable"
        >
          {/* Grid lines */}
          {ticks.map((t) => {
            const yPos = yFromNorm(t);
            const labelVal = normalizeScale
              ? `${Math.round(t * 100)}%`
              : (globalMin + t * (globalMax - globalMin || 1)).toFixed(1);
            return (
              <g key={t}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={width - padRight}
                  y2={yPos}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  className="fill-slate-500 font-mono text-[10px] tabular-nums"
                >
                  {labelVal}
                </text>
              </g>
            );
          })}

          {visibleStats.map((s, idx) => {
            const colStep = plotW / visibleStats.length;
            const cx = padLeft + colStep * (idx + 0.5);
            const boxW = Math.min(44, colStep * 0.45);

            const yMinW = yFromNorm(mapVal(s.lowerWhisker, s, globalMin, globalMax));
            const yMaxW = yFromNorm(mapVal(s.upperWhisker, s, globalMin, globalMax));
            const yQ1 = yFromNorm(mapVal(s.q1, s, globalMin, globalMax));
            const yMed = yFromNorm(mapVal(s.median, s, globalMin, globalMax));
            const yQ3 = yFromNorm(mapVal(s.q3, s, globalMin, globalMax));
            const isActive = hoveredVar === s.column;

            return (
              <g
                key={s.column}
                onMouseEnter={() => setHoveredVar(s.column)}
                onMouseLeave={() => setHoveredVar(null)}
                className="cursor-pointer"
              >
                {/* Invisible hit zone */}
                <rect
                  x={cx - colStep / 2}
                  y={padTop}
                  width={colStep}
                  height={plotH}
                  fill="transparent"
                />
                {/* Whisker vertical line */}
                <line
                  x1={cx}
                  y1={yMaxW}
                  x2={cx}
                  y2={yMinW}
                  stroke={isActive ? '#3730a3' : '#475569'}
                  strokeWidth={1.5}
                />
                {/* Top & bottom caps */}
                <line
                  x1={cx - boxW * 0.35}
                  y1={yMaxW}
                  x2={cx + boxW * 0.35}
                  y2={yMaxW}
                  stroke={isActive ? '#3730a3' : '#475569'}
                  strokeWidth={1.5}
                />
                <line
                  x1={cx - boxW * 0.35}
                  y1={yMinW}
                  x2={cx + boxW * 0.35}
                  y2={yMinW}
                  stroke={isActive ? '#3730a3' : '#475569'}
                  strokeWidth={1.5}
                />
                {/* IQR Box */}
                <rect
                  x={cx - boxW / 2}
                  y={Math.min(yQ3, yQ1)}
                  width={boxW}
                  height={Math.max(2, Math.abs(yQ1 - yQ3))}
                  rx={3}
                  fill={isActive ? '#c7d2fe' : '#e0e7ff'}
                  stroke={isActive ? '#4338ca' : '#4f46e5'}
                  strokeWidth={1.5}
                />
                {/* Median line */}
                <line
                  x1={cx - boxW / 2}
                  y1={yMed}
                  x2={cx + boxW / 2}
                  y2={yMed}
                  stroke="#1e1b4b"
                  strokeWidth={2.5}
                />
                {/* Outliers */}
                {s.outliers.slice(0, 20).map((outVal, oi) => {
                  const oy = yFromNorm(mapVal(outVal, s, globalMin, globalMax));
                  return (
                    <circle
                      key={oi}
                      cx={cx}
                      cy={oy}
                      r={3}
                      fill="#f59e0b"
                      stroke="#b45309"
                      strokeWidth={1}
                    />
                  );
                })}
                {/* Label */}
                <text
                  x={cx}
                  y={height - 16}
                  textAnchor="middle"
                  className={`text-[11px] font-medium ${
                    isActive ? 'fill-indigo-700' : 'fill-slate-700'
                  }`}
                >
                  {s.column.length > 14 ? `${s.column.slice(0, 12)}…` : s.column}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hoveredStat && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 tabular-nums">
          <span className="font-semibold text-slate-900">{hoveredStat.column}</span>
          <span>Mín: {hoveredStat.min.toFixed(2)}</span>
          <span>Q1: {hoveredStat.q1.toFixed(2)}</span>
          <span>Mediana: {hoveredStat.median.toFixed(2)}</span>
          <span>Q3: {hoveredStat.q3.toFixed(2)}</span>
          <span>Máx: {hoveredStat.max.toFixed(2)}</span>
          <span>Atípicos: {hoveredStat.outliers.length}</span>
        </div>
      )}
    </div>
  );
};
