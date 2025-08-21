import { h } from "preact";
import { useEffect, useState } from "preact/hooks";

import { Feature } from "../ui/icons/Feature";

import { Switch } from "./Switch";
import { FeatureItem } from "./Toolbar";

export function FeaturesTable({
  features,
  searchQuery,
  appBaseUrl,
  isOpen,
  setIsEnabledOverride,
}: {
  features: FeatureItem[];
  searchQuery: string | null;
  appBaseUrl: string;
  isOpen: boolean;
  setIsEnabledOverride: (key: string, isEnabled: boolean | null) => void;
}) {
  const hasFeatures = features.length > 0;
  const hasShownFeatures = features.some((feature) =>
    feature.key
      .toLocaleLowerCase()
      .includes(searchQuery?.toLocaleLowerCase() ?? ""),
  );

  // List features that match the search query first then alphabetically
  const searchedFeatures =
    searchQuery === null
      ? features
      : [...features].sort((a, b) => {
          const aMatches = a.key.includes(searchQuery);
          const bMatches = b.key.includes(searchQuery);

          // If both match or both don't match, sort alphabetically
          if (aMatches === bMatches) {
            return a.key.localeCompare(b.key);
          }

          // Otherwise, matching features come first
          return aMatches ? -1 : 1;
        });

  return (
    <table class="features-table" style={{ "--n": searchedFeatures.length }}>
      <tbody>
        {(!hasFeatures || !hasShownFeatures) && (
          <tr>
            <td class="feature-empty-cell" colSpan={3}>
              No features{" "}
              {!hasShownFeatures ? `matching "${searchQuery} "` : ""}
              found
            </td>
          </tr>
        )}
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
            setEnabledOverride={(override) =>
              setIsEnabledOverride(feature.key, override)
            }
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
  setEnabledOverride: (isEnabled: boolean | null) => void;
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
        <Feature class="feature-icon" />
        <a
          class="feature-link"
          href={`${appBaseUrl}/env-current/features/by-key/${feature.key}`}
          rel="noreferrer"
          tabIndex={index + 1}
          target="_blank"
        >
          {feature.key}
        </a>
      </td>
      <td class="feature-reset-cell">
        {feature.localOverride !== null ? (
          <Reset setEnabledOverride={setEnabledOverride} tabIndex={index + 1} />
        ) : null}
      </td>
      <td class="feature-switch-cell">
        <Switch
          checked={feature.localOverride ?? feature.isEnabled}
          tabIndex={index + 1}
          onChange={(e) => {
            const isChecked = e.currentTarget.checked;
            const isOverridden = isChecked !== feature.isEnabled;
            setEnabledOverride(isOverridden ? isChecked : null);
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
  ...props
}: {
  setEnabledOverride: (isEnabled: boolean | null) => void;
} & h.JSX.HTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      class="reset"
      href=""
      onClick={(e) => {
        e.preventDefault();
        setEnabledOverride(null);
      }}
      {...props}
    >
      reset
    </a>
  );
}
