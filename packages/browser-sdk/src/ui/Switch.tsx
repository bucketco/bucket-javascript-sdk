import { Fragment, h } from "preact";

import styles from "./Switch.css?inline";

interface SwitchProps extends h.JSX.HTMLAttributes<HTMLInputElement> {
  isOn: boolean;
  width?: number;
  height?: number;
}

const gutter = 1;

export function Switch({
  isOn,
  width = 24,
  height = 14,
  ...props
}: SwitchProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <label class="switch" data-enabled={isOn}>
        <input
          type="checkbox"
          checked={isOn}
          style={{ display: "none" }}
          name="enabled"
          {...props}
        />
        <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            borderRadius: `${height}px`,
          }}
          class="switch-track"
        >
          <div
            style={{
              width: `${height - gutter * 2}px`,
              height: `${height - gutter * 2}px`,
              transform: isOn
                ? `translateX(${width - (height - gutter * 2) - gutter}px)`
                : `translateX(${gutter}px)`,
              top: `${gutter}px`,
            }}
            class="switch-dot"
          />
        </div>
      </label>
    </>
  );
}
