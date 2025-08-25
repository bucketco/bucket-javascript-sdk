import { h } from "preact";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { ReflagClient } from "../client";
import { toolbarContainerId } from "../ui/constants";
import { Dialog, DialogContent, DialogHeader, useDialog } from "../ui/Dialog";
import { Logo } from "../ui/icons/Logo";
import { ToolbarPosition } from "../ui/types";
import { parseUnanchoredPosition } from "../ui/utils";

import { FeatureSearch, FeaturesTable } from "./Features";
import styles from "./index.css?inline";

export type FeatureItem = {
  key: string;
  localOverride: boolean | null;
  isEnabled: boolean;
};

type Feature = {
  key: string;
  isEnabled: boolean;
  localOverride: boolean | null;
};

export default function Toolbar({
  reflagClient,
  position,
}: {
  reflagClient: ReflagClient;
  position: ToolbarPosition;
}) {
  const toggleToolbarRef = useRef<HTMLDivElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const [features, setFeatures] = useState<Feature[]>([]);

  const updateFeatures = useCallback(() => {
    const rawFeatures = reflagClient.getFeatures();
    setFeatures(
      Object.values(rawFeatures)
        .filter((f) => f !== undefined)
        .map(
          (feature) =>
            ({
              key: feature.key,
              localOverride: feature.isEnabledOverride,
              isEnabled: feature.isEnabled,
            }) satisfies FeatureItem,
        ),
    );
  }, [reflagClient]);

  const hasAnyOverrides = useMemo(() => {
    return features.some((f) => f.localOverride !== null);
  }, [features]);

  useEffect(() => {
    updateFeatures();
    reflagClient.on("featuresUpdated", updateFeatures);
  }, [reflagClient, updateFeatures]);

  const [search, setSearch] = useState<string | null>(null);
  const onSearch = (val: string) => {
    setSearch(val === "" ? null : val);
    dialogContentRef.current?.scrollTo({ top: 0 });
  };

  const sortedFeatures = [...features].sort((a, b) =>
    a.key.localeCompare(b.key),
  );

  const appBaseUrl = reflagClient.getConfig().appBaseUrl;

  const { isOpen, close, toggle } = useDialog();

  return (
    <div class="toolbar">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <ToolbarToggle
        hasAnyOverrides={hasAnyOverrides}
        innerRef={toggleToolbarRef}
        isOpen={isOpen}
        position={position}
        onClick={toggle}
      />
      <Dialog
        close={close}
        containerId={toolbarContainerId}
        isOpen={isOpen}
        position={{
          type: "POPOVER",
          anchor: toggleToolbarRef.current,
          placement: "top-start",
        }}
        showArrow={false}
        strategy="fixed"
      >
        <DialogHeader>
          <FeatureSearch onSearch={onSearch} />
        </DialogHeader>
        <DialogContent innerRef={dialogContentRef}>
          <FeaturesTable
            appBaseUrl={appBaseUrl}
            features={sortedFeatures}
            isOpen={isOpen}
            searchQuery={search}
            setIsEnabledOverride={(key, isEnabled) =>
              reflagClient.getFeature(key).setIsEnabledOverride(isEnabled)
            }
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
    <div ref={innerRef} class={toggleClasses} style={offsets} onClick={onClick}>
      <div class={indicatorClasses} />
      <Logo height="13px" width="13px" />
    </div>
  );
}
