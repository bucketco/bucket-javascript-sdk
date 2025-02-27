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
    <table class="features-table" style={{ "--n": features.length }}>
      <tbody>
        {features.map((feature, index) => (
          <FeatureRow
            key={feature.key}
            appBaseUrl={appBaseUrl}
            feature={feature}
            index={index}
            isOpen={isOpen}
            setEnabledOverride={setEnabledOverride}
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
      key={feature.key}
      class={["feature-row", show ? "show" : undefined].join(" ")}
      style={{ "--i": index }}
    >
      <td class="feature-name-cell">
        <a
          class="feature-link"
          href={`${appBaseUrl}/envs/current/features/by-key/${feature.key}`}
          rel="noreferrer"
          target="_blank"
        >
          {feature.key}
        </a>
      </td>
      <td class="feature-reset-cell">
        {feature.localOverride !== null ? (
          <Reset
            featureKey={feature.key}
            setEnabledOverride={setEnabledOverride}
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
      class="search-input"
      placeholder="Search features"
      type="search"
      autoFocus
      onInput={(s) => onSearch(s.currentTarget.value)}
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
      class="reset"
      href=""
      onClick={(e) => {
        e.preventDefault();
        setEnabledOverride(featureKey, null);
      }}
    >
      reset
    </a>
  );
}
