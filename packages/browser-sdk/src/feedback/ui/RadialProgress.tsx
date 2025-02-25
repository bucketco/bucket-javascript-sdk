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
    <svg class="radial-progress" height={diameter} width={diameter}>
      <circle
        cx={radius + stroke}
        cy={radius + stroke}
        fill="transparent"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={filled}
        strokeWidth={stroke}
        transform={`rotate(-90) translate(-${radius * 2 + stroke * 2} 0)`}
      />
    </svg>
  );
};
