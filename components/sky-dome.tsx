import type { OverheadSnapshot, VisiblePass } from "@/lib/types";

const CENTER = 160;
const RADIUS = 126;

function point(azimuthDegrees: number, elevationDegrees: number) {
  const angle = azimuthDegrees * Math.PI / 180;
  const radius = RADIUS * (90 - Math.max(0, Math.min(90, elevationDegrees))) / 90;
  return {
    x: CENTER + radius * Math.sin(angle),
    y: CENTER - radius * Math.cos(angle),
  };
}

export function SkyDome({ overhead = [], passes = [] }: {
  overhead?: OverheadSnapshot[];
  passes?: VisiblePass[];
}) {
  const plottedPasses = passes.slice(0, 8);
  return (
    <figure className="sky-dome">
      <svg viewBox="0 0 320 320" role="img" aria-labelledby="dome-title dome-description">
        <title id="dome-title">North-up sky dome</title>
        <desc id="dome-description">The outer circle is the horizon and the center is the zenith. Satellite points and pass tracks use list azimuth and elevation values.</desc>
        <circle className="dome-horizon" cx={CENTER} cy={CENTER} r={RADIUS} />
        <circle className="dome-grid" cx={CENTER} cy={CENTER} r={RADIUS * 2 / 3} />
        <circle className="dome-grid" cx={CENTER} cy={CENTER} r={RADIUS / 3} />
        <line className="dome-axis" x1={CENTER} y1={CENTER - RADIUS} x2={CENTER} y2={CENTER + RADIUS} />
        <line className="dome-axis" x1={CENTER - RADIUS} y1={CENTER} x2={CENTER + RADIUS} y2={CENTER} />
        {([30, 60] as const).map((elevation) => (
          <text key={elevation} className="dome-elevation" x={CENTER + 4} y={CENTER - RADIUS * (90 - elevation) / 90 - 4}>{elevation}°</text>
        ))}
        <text className="dome-cardinal north" x={CENTER} y={18}>N</text>
        <text className="dome-cardinal" x={302} y={CENTER + 4}>E</text>
        <text className="dome-cardinal" x={CENTER} y={309}>S</text>
        <text className="dome-cardinal" x={18} y={CENTER + 4}>W</text>
        {plottedPasses.map((pass, index) => (
          <polyline
            key={`${pass.noradId}-${pass.startTime}`}
            className="dome-track"
            style={{ opacity: Math.max(0.26, 0.78 - index * 0.065) }}
            points={pass.track.map((sample) => {
              const coordinate = point(sample.azimuthDegrees, sample.elevationDegrees);
              return `${coordinate.x.toFixed(1)},${coordinate.y.toFixed(1)}`;
            }).join(" ")}
          />
        ))}
        {overhead.map((object) => {
          const coordinate = point(object.azimuthDegrees, object.elevationDegrees);
          return <circle key={object.noradId} className="dome-object" cx={coordinate.x} cy={coordinate.y} r={4}><title>{object.objectName}, {Math.round(object.elevationDegrees)}° {object.azimuthCompass}</title></circle>;
        })}
        <circle className="dome-zenith" cx={CENTER} cy={CENTER} r={2.5} />
      </svg>
      <figcaption>{passes.length > 0 ? `Tracks for the next ${Math.min(8, passes.length)} qualifying passes` : `${overhead.length} bright-catalog objects above the horizon`}</figcaption>
    </figure>
  );
}
