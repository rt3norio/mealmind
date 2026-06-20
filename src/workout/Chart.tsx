import type { SeriesPoint } from './helpers';
import { fmtShort, fmtW } from './helpers';

/**
 * Lightweight SVG line chart — no chart library, keeps the PWA lean.
 * Plots one series on its own scale (loads of different units are charted
 * separately so we never compare placa with kg).
 */
export default function Chart({
  points,
  unit,
  color = 'var(--brand)',
}: {
  points: SeriesPoint[];
  unit: string;
  color?: string;
}) {
  if (points.length === 0) return null;

  const W = 320;
  const H = 168;
  const padL = 36;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const record = Math.max(...vals);
  const n = points.length;

  const x = (i: number) => (n === 1 ? (W - padL - padR) / 2 + padL : padL + (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  const yRecord = y(record);

  return (
    <div className="wk-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Gráfico de evolução">
        {/* y bounds */}
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--line)" strokeWidth={1} />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--line)" strokeWidth={1} />
        <text x={padL - 5} y={padT + 4} textAnchor="end" className="wk-axis">{fmtW(max)}</text>
        <text x={padL - 5} y={H - padB} textAnchor="end" className="wk-axis">{fmtW(min)}</text>

        {/* record reference line */}
        {n > 1 && record !== min && (
          <line
            x1={padL}
            y1={yRecord}
            x2={W - padR}
            y2={yRecord}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.45}
          />
        )}

        {/* the series */}
        <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={3} fill={color} />
        ))}

        {/* x bounds (first / last date) */}
        <text x={x(0)} y={H - 8} textAnchor="start" className="wk-axis">{fmtShort(points[0].date)}</text>
        {n > 1 && (
          <text x={x(n - 1)} y={H - 8} textAnchor="end" className="wk-axis">
            {fmtShort(points[n - 1].date)}
          </text>
        )}
      </svg>
      <p className="wk-chart-cap sub">
        Recorde <strong>{fmtW(record)} {unit}</strong> · {n} {n === 1 ? 'sessão' : 'sessões'}
      </p>
    </div>
  );
}
