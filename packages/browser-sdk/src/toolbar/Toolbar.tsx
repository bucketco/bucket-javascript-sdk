import { h } from "preact";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { BucketClient } from "../client";
import { toolbarContainerId } from "../ui/constants";
import { Dialog } from "../ui/Dialog";
import { Logo } from "../ui/icons/Logo";
import { Switch } from "../ui/Switch";
import { Offset, Placement } from "../ui/types";
import { parseUnanchoredPosition } from "../ui/utils";

import styles from "./Toolbar.css?inline";

export interface ToolbarPosition {
  placement: Placement;
  offset?: Offset;
}

type Feature = {
  key: string;
  isEnabled: boolean;
  localOverride: boolean | null;
};

export default function Toolbar({
  bucketClient,
  position,
}: {
  bucketClient: BucketClient;
  position: ToolbarPosition;
}) {
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const toggleToolbarRef = useRef<HTMLDivElement>(null);
  const [features, setFeatures] = useState<Feature[]>([]);

  const toggleToolbar = useCallback(() => {
    setToolbarOpen((prev) => !prev);
  }, [setToolbarOpen]);

  const closeToolbar = useCallback(() => {
    setToolbarOpen(false);
  }, [setToolbarOpen]);

  function updateFeatures() {
    const rawFeatures = bucketClient.getFeatures();
    setFeatures(
      Object.values(rawFeatures)
        .filter((f) => f !== undefined)
        .map((feature) => ({
          key: feature.key,
          localOverride: bucketClient.getFeatureOverride(feature?.key),
          isEnabled: feature.isEnabled,
        })),
    );
  }

  const hasAnyOverrides = useMemo(() => {
    return features.some((f) => f.localOverride !== null);
  }, [features]);

  useEffect(() => {
    updateFeatures();
    return bucketClient.onFeaturesUpdated(updateFeatures);
  }, [bucketClient]);

  const [search, setSearch] = useState<string | null>(null);
  const onSearch = (val: string) => {
    setSearch(val === "" ? null : val);
  };

  const searchedFeatures =
    search === null ? features : features.filter((f) => f.key.includes(search));

  const appBaseUrl = bucketClient.getConfig().appBaseUrl;

  return (
    <div id="toolbarRoot">
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <ToolbarToggle
        innerRef={toggleToolbarRef}
        position={position}
        hasAnyOverrides={hasAnyOverrides}
        onClick={toggleToolbar}
      />
      <Dialog
        strategy="fixed"
        open={toolbarOpen}
        containerId={toolbarContainerId}
        position={{
          type: "POPOVER",
          anchor: toggleToolbarRef.current,
        }}
        onClose={closeToolbar}
      >
        <FeatureSearch onSearch={onSearch} />
        <FeatureTable
          features={searchedFeatures}
          setEnabledOverride={bucketClient.setFeatureOverride.bind(
            bucketClient,
          )}
          appBaseUrl={appBaseUrl}
        />
      </Dialog>
    </div>
  );
}

function ToolbarToggle({
  position,
  onClick,
  innerRef,
  hasAnyOverrides,
}: {
  position: ToolbarPosition;
  onClick: () => void;
  innerRef: React.RefObject<HTMLDivElement>;
  hasAnyOverrides: boolean;
  children?: preact.VNode;
}) {
  const offsets = parseUnanchoredPosition(position);

  const classes = [
    "override-indicator",
    hasAnyOverrides ? "show" : undefined,
  ].join(" ");
  return (
    <div
      ref={innerRef}
      class="toolbar-toggle"
      onClick={onClick}
      style={{ cursor: "pointer", ...offsets }}
    >
      <div class={classes}></div>
      <Logo height="13px" width="13px" />
    </div>
  );
}

function FeatureSearch({ onSearch }: { onSearch: (val: string) => void }) {
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

function FeatureTable({
  features,
  setEnabledOverride,
  appBaseUrl,
}: {
  features: {
    key: string;
    localOverride: boolean | null;
    isEnabled: boolean;
  }[];
  setEnabledOverride: (key: string, value: boolean | null) => void;
  appBaseUrl: string;
}) {
  if (features.length === 0) {
    return <div style={{ color: "var(--gray500)" }}>No features found</div>;
  }
  return (
    <table class="table">
      <tbody>
        {features.map((feature) => {
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
                    setEnabledOverride(
                      feature.key,
                      isOverridden ? isChecked : null,
                    );
                  }}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
