import { h } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { BucketClient } from "../client";
import { toolbarContainerId } from "../ui/constants";
import { Dialog, DialogContent, DialogHeader, useDialog } from "../ui/Dialog";
import { Logo } from "../ui/icons/Logo";
import { DialogPlacement, Offset } from "../ui/types";
import { parseUnanchoredPosition } from "../ui/utils";

import { FeatureSearch, FeaturesTable } from "./Features";
import styles from "./index.css?inline";

export type FeatureItem = {
  key: string;
  localOverride: boolean | null;
  isEnabled: boolean;
};
export interface ToolbarPosition {
  placement: DialogPlacement;
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
  const toggleToolbarRef = useRef<HTMLDivElement>(null);
  const [features, setFeatures] = useState<Feature[]>([]);

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
    bucketClient.on("features-updated", updateFeatures);
  }, [bucketClient]);

  const [search, setSearch] = useState<string | null>(null);
  const onSearch = (val: string) => {
    setSearch(val === "" ? null : val);
  };

  const searchedFeatures =
    search === null ? features : features.filter((f) => f.key.includes(search));

  const appBaseUrl = bucketClient.getConfig().appBaseUrl;

  const { isOpen, close, toggle } = useDialog();

  return (
    <div class="toolbar">
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <ToolbarToggle
        innerRef={toggleToolbarRef}
        position={position}
        hasAnyOverrides={hasAnyOverrides}
        isOpen={isOpen}
        onClick={toggle}
      />
      <Dialog
        strategy="fixed"
        isOpen={isOpen}
        containerId={toolbarContainerId}
        position={{
          type: "POPOVER",
          anchor: toggleToolbarRef.current,
          placement: "top-start",
        }}
        close={close}
      >
        <DialogHeader>
          <FeatureSearch onSearch={onSearch} />
        </DialogHeader>
        <DialogContent>
          <FeaturesTable
            features={searchedFeatures}
            setEnabledOverride={bucketClient.setFeatureOverride.bind(
              bucketClient,
            )}
            appBaseUrl={appBaseUrl}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolbarToggle({
  isOpen,
  position,
  onClick,
  innerRef,
  hasAnyOverrides,
}: {
  isOpen: boolean;
  position: ToolbarPosition;
  onClick: () => void;
  innerRef: React.RefObject<HTMLDivElement>;
  hasAnyOverrides: boolean;
  children?: preact.VNode;
}) {
  const offsets = parseUnanchoredPosition(position);

  const toggleClasses = ["toolbar-toggle", isOpen ? "open" : undefined].join(
    " ",
  );

  const indicatorClasses = [
    "override-indicator",
    hasAnyOverrides ? "show" : undefined,
  ].join(" ");

  return (
    <div ref={innerRef} class={toggleClasses} onClick={onClick} style={offsets}>
      <div class={indicatorClasses}></div>
      <Logo height="13px" width="13px" />
    </div>
  );
}
