import { twaAngles, twsValues, type PolarTable } from '../store/polar';

type PolarDiagramProps = {
  table: PolarTable;
  size?: number;
};

const angleToRadians = (angle: number) => ((angle - 90) * Math.PI) / 180;

const interpolateSpeed = (angle: number, angles: readonly number[], values: number[]) => {
  if (angle <= angles[0]) return values[0];
  if (angle >= angles[angles.length - 1]) return values[values.length - 1];

  for (let i = 0; i < angles.length - 1; i += 1) {
    const lowerAngle = angles[i];
    const upperAngle = angles[i + 1];
    if (angle >= lowerAngle && angle <= upperAngle) {
      const lowerValue = values[i];
      const upperValue = values[i + 1];
      const t = upperAngle === lowerAngle ? 0 : (angle - lowerAngle) / (upperAngle - lowerAngle);
      return lowerValue + (upperValue - lowerValue) * t;
    }
  }

  return values[values.length - 1];
};

const buildPath = (angles: number[], speeds: number[], radius: number, center: number) => {
  const points: string[] = [];
  const step = 2;

  for (let angle = 0; angle <= 180; angle += step) {
    const speed = interpolateSpeed(angle, angles, speeds);
    points.push(`${angle}:${speed}`);
  }

  for (let angle = 180 + step; angle <= 360; angle += step) {
    const mirrored = 360 - angle;
    const speed = interpolateSpeed(mirrored, angles, speeds);
    points.push(`${angle}:${speed}`);
  }

  const path = points
    .map((entry, index) => {
      const [angleString, speedString] = entry.split(':');
      const angle = Number(angleString);
      const speed = Number(speedString);
      const r = (speed / radius) * center;
      const radians = angleToRadians(angle);
      const x = center + r * Math.cos(radians);
      const y = center + r * Math.sin(radians);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return `${path} Z`;
};

function PolarDiagram({ table, size = 240 }: PolarDiagramProps) {
  const center = size / 2;
  const ringCount = 4;
  const maxSpeed = Math.max(
    1,
    ...twsValues.flatMap((tws) => Object.values(table[tws]))
  );

  const angles = [...twaAngles];

  return (
    <svg
      className="polar-diagram"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Polar diagram of boat speed by wind angle"
    >
      <g className="polar-diagram__grid">
        {Array.from({ length: ringCount }, (_, index) => {
          const factor = (index + 1) / ringCount;
          return (
            <circle
              key={factor}
              cx={center}
              cy={center}
              r={center * factor}
              className="polar-diagram__ring"
            />
          );
        })}
        {[0, 30, 60, 90, 120, 150].map((angle) => {
          const radians = angleToRadians(angle);
          const x = center + center * Math.cos(radians);
          const y = center + center * Math.sin(radians);
          const oppositeRadians = angleToRadians(angle + 180);
          const x2 = center + center * Math.cos(oppositeRadians);
          const y2 = center + center * Math.sin(oppositeRadians);
          return (
            <line
              key={angle}
              x1={x}
              y1={y}
              x2={x2}
              y2={y2}
              className="polar-diagram__spoke"
            />
          );
        })}
      </g>

      <g className="polar-diagram__curves">
        {twsValues.map((tws) => {
          const speeds = angles.map((angle) => table[tws][angle]);
          return (
            <path
              key={tws}
              d={buildPath(angles, speeds, maxSpeed, center)}
              className={`polar-diagram__curve polar-diagram__curve--${tws}`}
            />
          );
        })}
      </g>
    </svg>
  );
}

export default PolarDiagram;