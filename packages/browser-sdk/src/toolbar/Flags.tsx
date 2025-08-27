import { h } from "preact";
import { useEffect, useState } from "preact/hooks";

import { Feature as Flag } from "../ui/icons/Feature";

import { Switch } from "./Switch";
import { FlagItem } from "./Toolbar";

type FlagTableProps = {
  flags: FlagItem[];
  searchQuery: string | null;
  appBaseUrl: string;
  isOpen: boolean;
  setOverride: (key: string, value: boolean | null) => void;
};

export function FlagsTable({
  flags,
  searchQuery,
  appBaseUrl,
  isOpen,
  setOverride,
}: FlagTableProps) {
  const hasFlags = flags.length > 0;
  const hasShownFlags = flags.some((flag) =>
    flag.flagKey
      .toLocaleLowerCase()
      .includes(searchQuery?.toLocaleLowerCase() ?? ""),
  );

  // List flags that match the search query first then alphabetically
  const searchedFlags =
    searchQuery === null
      ? flags
      : [...flags].sort((a, b) => {
          const aMatches = a.flagKey.includes(searchQuery);
          const bMatches = b.flagKey.includes(searchQuery);

          // If both match or both don't match, sort alphabetically
          if (aMatches === bMatches) {
            return a.flagKey.localeCompare(b.flagKey);
          }

          // Otherwise, matching flags come first
          return aMatches ? -1 : 1;
        });

  return (
    <table class="flags-table" style={{ "--n": searchedFlags.length }}>
      <tbody>
        {(!hasFlags || !hasShownFlags) && (
          <tr>
            <td class="flag-empty-cell" colSpan={3}>
              No flags {!hasShownFlags ? `matching "${searchQuery} "` : ""}
              found
            </td>
          </tr>
        )}
        {searchedFlags.map((flag, index) => (
          <FlagRow
            key={flag.flagKey}
            appBaseUrl={appBaseUrl}
            flag={flag}
            index={index}
            isNotVisible={
              searchQuery !== null &&
              !flag.flagKey
                .toLocaleLowerCase()
                .includes(searchQuery.toLocaleLowerCase())
            }
            isOpen={isOpen}
            setOverride={(value) => setOverride(flag.flagKey, value)}
          />
        ))}
      </tbody>
    </table>
  );
}

type FlagRowProps = {
  flag: FlagItem;
  appBaseUrl: string;
  setOverride: (value: boolean | null) => void;
  isOpen: boolean;
  index: number;
  isNotVisible: boolean;
};

function FlagRow({
  setOverride,
  appBaseUrl,
  flag,
  isOpen,
  index,
  isNotVisible,
}: FlagRowProps) {
  const [showOnOpen, setShowOnOpen] = useState(isOpen);
  useEffect(() => {
    setShowOnOpen(isOpen);
  }, [isOpen]);
  return (
    <tr
      key={flag.flagKey}
      class={[
        "flag-row",
        showOnOpen ? "show-on-open" : undefined,
        isNotVisible ? "not-visible" : undefined,
      ].join(" ")}
      style={{ "--i": index }}
    >
      <td class="flag-name-cell">
        <Flag class="flag-icon" />
        <a
          class="flag-link"
          href={`${appBaseUrl}/envs/current/flags/by-key/${flag.flagKey}`}
          rel="noreferrer"
          tabIndex={index + 1}
          target="_blank"
        >
          {flag.flagKey}
        </a>
      </td>
      <td class="flag-reset-cell">
        {flag.override !== null ? (
          <Reset setOverride={setOverride} tabIndex={index + 1} />
        ) : null}
      </td>
      <td class="flag-switch-cell">
        <Switch
          checked={flag.override === true || flag.value === true}
          disabled={typeof flag.value !== "boolean"}
          tabIndex={index + 1}
          onChange={(e) => {
            const isChecked = e.currentTarget.checked;
            const isOverridden = isChecked !== flag.value;

            setOverride(isOverridden ? isChecked : null);
          }}
        />
      </td>
    </tr>
  );
}

type FlagSearchProps = {
  onSearch: (val: string) => void;
};

export function FlagSearch({ onSearch }: FlagSearchProps) {
  return (
    <input
      class="search-input"
      placeholder="Search flags"
      tabIndex={0}
      type="search"
      autoFocus
      onInput={(s) => onSearch(s.currentTarget.value)}
    />
  );
}

type ResetProps = {
  setOverride: (value: boolean | null) => void;
} & h.JSX.HTMLAttributes<HTMLAnchorElement>;

function Reset({ setOverride, ...props }: ResetProps) {
  return (
    <a
      class="reset"
      href=""
      onClick={(e) => {
        e.preventDefault();
        setOverride(null);
      }}
      {...props}
    >
      reset
    </a>
  );
}
