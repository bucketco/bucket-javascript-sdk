import { h } from "preact";
import { useEffect, useState } from "preact/hooks";

import { Switch } from "./Switch";
import { FeatureItem } from "./Toolbar";

export function FeaturesTable({
  features,
  setEnabledOverride,
  appBaseUrl,
  isOpen,
}: {
  features: FeatureItem[];
  setEnabledOverride: (key: string, value: boolean | null) => void;
  appBaseUrl: string;
  isOpen: boolean;
}) {
  if (features.length === 0) {
    return <div style={{ color: "var(--gray500)" }}>No features found</div>;
  }
  return (
    <table class="features-table">
      <tbody>
        {features.map((feature, index) => (
          <FeatureRow
            feature={feature}
            appBaseUrl={appBaseUrl}
            setEnabledOverride={setEnabledOverride}
            isOpen={isOpen}
            index={index}
          />
        ))}
      </tbody>
    </table>
  );
}

function FeatureRow({
  setEnabledOverride,
  appBaseUrl,
  feature,
  isOpen,
  index,
}: {
  feature: FeatureItem;
  appBaseUrl: string;
  setEnabledOverride: (key: string, value: boolean | null) => void;
  isOpen: boolean;
  index: number;
}) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);
  return (
    <tr
      class={["feature-row", show ? "show" : undefined].join(" ")}
      key={feature.key}
      style={{ "--i": index }}
    >
      <td class="feature-name-cell">
        <a
          href={`${appBaseUrl}/envs/current/features/by-key/${feature.key}`}
          target="_blank"
          class="feature-link"
        >
          {feature.key}
        </a>
      </td>
      <td class="feature-reset-cell">
        {feature.localOverride !== null ? (
          <Reset
            setEnabledOverride={setEnabledOverride}
            featureKey={feature.key}
          />
        ) : null}
      </td>
      <td class="feature-switch-cell">
        <Switch
          checked={
            (feature.localOverride === null && feature.isEnabled) ||
            feature.localOverride === true
          }
          onChange={(e) => {
            const isChecked = e.currentTarget.checked;
            const isOverridden = isChecked !== feature.isEnabled;
            setEnabledOverride(feature.key, isOverridden ? isChecked : null);
          }}
        />
      </td>
    </tr>
  );
}

export function FeatureSearch({
  onSearch,
}: {
  onSearch: (val: string) => void;
}) {
  return (
    <input
      type="search"
      placeholder="Search features"
      onInput={(s) => onSearch(s.currentTarget.value)}
      autoFocus
      class="search-input"
    />
  );
}

function Reset({
  setEnabledOverride,
  featureKey,
}: {
  setEnabledOverride: (key: string, value: boolean | null) => void;
  featureKey: string;
}) {
  return (
    <a
      href=""
      class="reset"
      onClick={(e) => {
        e.preventDefault();
        setEnabledOverride(featureKey, null);
      }}
    >
      reset
    </a>
  );
}
