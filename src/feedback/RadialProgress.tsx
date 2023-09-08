import { FunctionComponent, h } from "preact";

export const RadialProgress: FunctionComponent<{
  diameter: number;
  progress: number;
}> = ({ diameter, progress }) => {
  const stroke = 2;
  const radius = diameter / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * progress;

  return (
    <svg className="radial-progress" width={diameter} height={diameter}>
      <circle
        fill="transparent"
        stroke="#000"
        strokeWidth={stroke}
        cx={radius + stroke}
        cy={radius + stroke}
        r={radius}
        stroke-dasharray={circumference}
        stroke-dashoffset={filled}
        transform={`rotate(-90) translate(-${radius * 2 + stroke * 2} 0)`}
      />
    </svg>
  );
};
