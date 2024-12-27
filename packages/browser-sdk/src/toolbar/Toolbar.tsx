// import SimpleSelect from "@/common/components/SimpleSelect";
// import SimpleTable from "@/common/components/SimpleTable";
// import { useFeature, useFeatures } from "@/common/hooks/useFeatureFlags";

import { h } from "preact";

import { BucketClient } from "../client";
import { Logo } from "../ui/icons/Logo";

import styles from "./Toolbar.css?inline";

export default function Toolbar({
  bucketClient,
}: {
  bucketClient: BucketClient;
}) {
  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>

      <div id="bucketToolbar" onClick={}>
        <Logo />
      </div>
      <div id="bucketToolbarPopover">
        <FeatureTable bucketClient={bucketClient} />
      </div>
    </div>
  );
}

function Reset({
  bucketClient,
  featureKey,
}: {
  bucketClient: BucketClient;
  featureKey: string;
}) {
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        bucketClient.setEnabledOverride(featureKey, null);
      }}
    >
      reset
    </a>
  );
}

function FeatureTable({ bucketClient }: { bucketClient: BucketClient }) {
  const features = bucketClient.getFeatures();

  return (
    <table>
      <tbody>
        {Object.values(features).map((feature) => (
          <tr>
            <td>{feature!.key}</td>
            <td>
              {bucketClient.getEnabledOverride(feature!.key) !== null ? (
                <Reset bucketClient={bucketClient} featureKey={feature!.key} />
              ) : null}
            </td>

            <td>
              <input
                type="checkbox"
                checked={bucketClient.getFeature(feature!.key).isEnabled}
                onChange={(e) =>
                  bucketClient.setEnabledOverride(
                    feature!.key,
                    e.currentTarget.checked,
                  )
                }
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/*
    <Popover placement="left-start">
      <PopoverTrigger>
        <IconButton
          _hover={{ color: useColorModeValue("gray.800", "gray.200") }}
          aria-label="feature targeting manager"
          color={hasLocalOverrides ? activeColor : "dimmed"}
          icon={
            hasLocalOverrides ? (
              <RiFlag2Fill size={16} />
            ) : (
              <RiFlag2Line size={16} />
            )
          }
          size="md"
          variant="ghost"
          isRound
        />
      </PopoverTrigger>
      <PopoverContent w="auto">
        <PopoverArrow />
        <PopoverBody fontSize="sm" p={2}>
          <SimpleTable
            columns={["Feature key", "Remote", "Env", "Override?", "", "Final"]}
            rows={availableFeatures ?? []}
            rowTemplate={(key) => <SingleFeature key={key} featureKey={key} />}
            size="sm"
          />
          <Button
            isDisabled={!hasLocalOverrides}
            m={3}
            mb={2}
            size="xs"
            variant="outline"
            onClick={() => resetLocalOverrides()}
          >
            Reset overrides
          </Button>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}

function SingleFeature({
  featureKey,
}: {
  featureKey: keyof AvailableFeatures;
}) {
  const { isEnabled, values, updateLocalOverride } = useFeature(featureKey);

  return (
    <Tr>
      <Td fontWeight="medium" minW="200px">
        {featureKey}
      </Td>
      <Td>
        <FormatValue value={values.evaluation} />
      </Td>
      <Td>
        <FormatValue value={values.envVar} />
      </Td>
      <Td>
        <SimpleSelect
          options={[
            {
              label: <FormatValue label="enable" value={true} />,
              value: "enable",
            },
            {
              label: <FormatValue label="disable" value={false} />,
              value: "disable",
            },
            {
              label: <FormatValue label="unset" value={null} />,
              value: "unset",
            },
          ]}
          size="xs"
          value={
            values.override === null
              ? "unset"
              : values.override
                ? "enable"
                : "disable"
          }
          w={20}
          onChange={(val) => {
            const newValue = val === "unset" ? null : val === "enable";
            updateLocalOverride(newValue);
          }}
        />
      </Td>
      <Td color="dimmed">
        <RiArrowRightLine size={16} />
      </Td>
      <Td>
        <FormatValue value={isEnabled} />
      </Td>
    </Tr>
  );
}
*/
