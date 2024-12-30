import { FunctionComponent, h } from "preact";

interface SwitchProps extends h.JSX.HTMLAttributes<HTMLInputElement> {
  isOn: boolean;
  width?: number;
  height?: number;
  onColor?: string;
  offColor?: string;
}

export const Switch: FunctionComponent<SwitchProps> = ({
  isOn,
  width = 25,
  height = 12,
  onColor = "green",
  offColor = "gray",
  ...props
}) => {
  return (
    <label style={{ cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={isOn}
        style={{ display: "none" }}
        {...props}
      />
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          background: isOn ? onColor : offColor,
          borderRadius: `${height}px`,
          position: "relative",
          transition: "background 0.3s",
        }}
      >
        <div
          style={{
            width: `${height - 2}px`,
            height: `${height - 2}px`,
            background: "white",
            borderRadius: "50%",
            position: "absolute",
            top: "1px",
            left: isOn ? `${width / 2 + 1}px` : "1px",
            transition: "left 0.3s",
          }}
        />
      </div>
    </label>
  );
};
