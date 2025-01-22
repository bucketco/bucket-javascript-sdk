import { h } from "preact";

import { Switch } from "./Switch";
import { FeatureItem } from "./Toolbar";

export function FeaturesTable({
  features,
  setEnabledOverride,
  appBaseUrl,
}: {
  features: FeatureItem[];
  setEnabledOverride: (key: string, value: boolean | null) => void;
  appBaseUrl: string;
}) {
  if (features.length === 0) {
    return <div style={{ color: "var(--gray500)" }}>No features found</div>;
  }
  return (
    <table class="features-table">
      <tbody>
        {features.map((feature) => (
          <FeatureRow
            feature={feature}
            appBaseUrl={appBaseUrl}
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
}: {
  feature: FeatureItem;
  appBaseUrl: string;
  setEnabledOverride: (key: string, value: boolean | null) => void;
}) {
  return (
    <tr key={feature.key}>
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
      <td>
        <Switch
          isOn={
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
      placeholder="Search"
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
