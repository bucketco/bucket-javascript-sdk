import { h } from "preact";
import { useEffect, useState } from "preact/hooks";

import { Switch } from "./Switch";
import { FeatureItem } from "./Toolbar";

export function FeaturesTable({
  features,
  searchQuery,
  setEnabledOverride,
  appBaseUrl,
  isOpen,
}: {
  features: FeatureItem[];
  searchQuery: string | null;
  setEnabledOverride: (key: string, value: boolean | null) => void;
  appBaseUrl: string;
  isOpen: boolean;
}) {
  const searchedFeatures =
    searchQuery === null
      ? features
      : [...features].sort((a, _b) => (a.key.includes(searchQuery) ? -1 : 1));

  if (searchedFeatures.length === 0) {
    return <div style={{ color: "var(--gray500)" }}>No features found</div>;
  }
  return (
    <table class="features-table" style={{ "--n": searchedFeatures.length }}>
      <tbody>
        {searchedFeatures.map((feature, index) => (
          <FeatureRow
            key={feature.key}
            appBaseUrl={appBaseUrl}
            feature={feature}
            index={index}
            isNotVisible={
              searchQuery !== null &&
              !feature.key
                .toLocaleLowerCase()
                .includes(searchQuery.toLocaleLowerCase())
            }
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
  isNotVisible,
}: {
  feature: FeatureItem;
  appBaseUrl: string;
  setEnabledOverride: (key: string, value: boolean | null) => void;
  isOpen: boolean;
  index: number;
  isNotVisible: boolean;
}) {
  const [showOnOpen, setShowOnOpen] = useState(isOpen);
  useEffect(() => {
    setShowOnOpen(isOpen);
  }, [isOpen]);
  return (
    <tr
      key={feature.key}
      class={[
        "feature-row",
        showOnOpen ? "show-on-open" : undefined,
        isNotVisible ? "not-visible" : undefined,
      ].join(" ")}
      style={{ "--i": index }}
    >
      <td class="feature-name-cell">
        <a
          class="feature-link"
          href={`${appBaseUrl}/envs/current/features/by-key/${feature.key}`}
          rel="noreferrer"
          tabIndex={index + 1}
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
            tabIndex={index + 1}
          />
        ) : null}
      </td>
      <td class="feature-switch-cell">
        <Switch
          checked={
            (feature.localOverride === null && feature.isEnabled) ||
            feature.localOverride === true
          }
          tabIndex={index + 1}
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
      tabIndex={0}
      type="search"
      autoFocus
      onInput={(s) => onSearch(s.currentTarget.value)}
    />
  );
}

function Reset({
  setEnabledOverride,
  featureKey,
  ...props
}: {
  setEnabledOverride: (key: string, value: boolean | null) => void;
  featureKey: string;
} & h.JSX.HTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      class="reset"
      href=""
      onClick={(e) => {
        e.preventDefault();
        setEnabledOverride(featureKey, null);
      }}
      {...props}
    >
      reset
    </a>
  );
}
