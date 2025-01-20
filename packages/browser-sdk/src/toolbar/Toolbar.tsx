import { h } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { BucketClient } from "../client";
import { toolbarContainerId } from "../ui/constants";
import { Dialog } from "../ui/Dialog";
import { Logo } from "../ui/icons/Logo";
import { Offset, Placement } from "../ui/types";
import { parseUnanchoredPosition } from "../ui/utils";

import { Switch } from "./Switch";
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

  useEffect(() => {
    updateFeatures();
    return bucketClient.onFeaturesUpdated(updateFeatures);
  }, [bucketClient]);

  return (
    <div id="toolbarRoot">
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <ToolbarToggle
        innerRef={toggleToolbarRef}
        position={position}
        onClick={toggleToolbar}
      />
      <Dialog
        strategy="fixed"
        open={toolbarOpen}
        DialogContent={() => (
          <div id="bucketToolbarPopover">
            <FeatureTable
              features={features}
              setEnabledOverride={bucketClient.setFeatureOverride.bind(
                bucketClient,
              )}
            />
          </div>
        )}
        containerId={toolbarContainerId}
        position={{
          type: "POPOVER",
          anchor: toggleToolbarRef.current,
        }}
      />
    </div>
  );
}

function ToolbarToggle({
  position,
  onClick,
  innerRef,
}: {
  position: ToolbarPosition;
  onClick: () => void;
  innerRef: React.RefObject<HTMLDivElement>;
  children?: preact.VNode;
}) {
  const offsets = parseUnanchoredPosition(position);
  return (
    <div
      ref={innerRef}
      id="bucketToolbarToggle"
      onClick={onClick}
      style={{ cursor: "pointer", ...offsets }}
    >
      <Logo height="13px" width="13px" />
    </div>
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
}: {
  features: {
    key: string;
    localOverride: boolean | null;
    isEnabled: boolean;
  }[];
  setEnabledOverride: (key: string, value: boolean | null) => void;
}) {
  return (
    <table>
      <tbody>
        {Object.values(features).map((feature) => (
          <tr key={feature!.key}>
            <td>{feature!.key}</td>
            <td>
              {feature?.localOverride !== null ? (
                <Reset
                  setEnabledOverride={setEnabledOverride}
                  featureKey={feature!.key}
                />
              ) : null}
            </td>

            <td>
              <Switch
                onColor="var(--brand300)"
                isOn={feature!.isEnabled || feature?.localOverride === true}
                onChange={(e) =>
                  setEnabledOverride(feature!.key, e.currentTarget.checked)
                }
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
