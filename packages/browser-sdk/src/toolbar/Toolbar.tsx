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
import { Offset, Placement } from "../ui/types";
import { parseUnanchoredPosition } from "../ui/utils";

import { FeatureSearch, FeaturesTable } from "./Features";
import styles from "./index.css?inline";

export type FeatureItem = {
  key: string;
  localOverride: boolean | null;
  isEnabled: boolean;
};
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
        .map(
          (feature) =>
            ({
              key: feature.key,
              localOverride: bucketClient.getFeatureOverride(feature?.key),
              isEnabled: feature.isEnabled,
            }) satisfies FeatureItem,
        ),
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
    <div class="toolbar">
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
        <FeaturesTable
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
