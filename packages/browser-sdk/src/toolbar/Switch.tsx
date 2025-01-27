import { Fragment, h } from "preact";

interface SwitchProps extends h.JSX.HTMLAttributes<HTMLInputElement> {
  checked: boolean;
  width?: number;
  height?: number;
}

const gutter = 1;

export function Switch({
  checked,
  width = 24,
  height = 14,
  ...props
}: SwitchProps) {
  return (
    <>
      <label class="switch" data-enabled={checked}>
        <input
          type="checkbox"
          checked={checked}
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
              transform: checked
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
