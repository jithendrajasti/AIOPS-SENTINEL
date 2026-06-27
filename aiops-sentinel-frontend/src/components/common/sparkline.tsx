"use client";

import { useId } from "react";

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "#38bdf8",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const id = useId();
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={area} fill={`url(#grad-${id})`} stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
