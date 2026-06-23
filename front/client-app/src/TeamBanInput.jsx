import { Select } from "antd";

// Vite picks up every PNG at build time. `eager: true` returns the resolved
// URL strings directly, matching the previous static `import x from "..."`
// behaviour (no runtime fetch, same hashed asset URLs).
const portraitModules = import.meta.glob("./assets/portraits/*.png", {
  eager: true,
  import: "default",
});

// "jetpack-cat" -> "jetpackCat", "soldier-76" -> "soldier76", "d-va" -> "dva"
const kebabToCamel = (slug) =>
  slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

const filenameToSlug = (path) =>
  path
    .split("/")
    .pop()
    .replace(/\.png$/, "");

// Display-name overrides for portraits whose human-friendly name contains
// characters that can't be derived from the filename. Add entries here when
// a new portrait needs an alias (e.g. "D.Va", "Soldier: 76", ...).
const displayNameAliases = {};

export const portraits = (() => {
  const result = {};

  for (const [path, url] of Object.entries(portraitModules)) {
    result[kebabToCamel(filenameToSlug(path))] = url;
  }

  for (const [displayName, key] of Object.entries(displayNameAliases)) {
    if (result[key]) result[displayName] = result[key];
  }

  // Preserve legacy behaviour: `none` falls back to ana.
  result.none = result.ana;
  return result;
})();

const updateBanForTeam = (value, team, handler) => {
  const command = team === "team1" ? "team1UpdateBan" : "team2UpdateBan";
  handler({ command, value });
};

// "jetpackCat" -> "Jetpack Cat", "soldier76" -> "Soldier 76", "dva" -> "Dva"
const humanizeKey = (key) =>
  key
    // Insert a space before any uppercase letter or digit run that follows a
    // lowercase letter/digit boundary.
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    // Capitalize the first letter of each whitespace-separated word.
    .replace(/(^|\s)([a-z])/g, (_, sep, c) => sep + c.toUpperCase());

function TeamBanInput(props) {
  const nameOptions = Object.keys(portraits)
    .map((name) => ({
      value: name,
      label: humanizeKey(name),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  let selectedValue;
  if (props.selected) {
    const selectMatch = props.selected.match(/\/([a-z0-9\-_]+)\.png/);
    if (selectMatch) {
      // Align with the camelCase option `value`s so antd can resolve the
      // matching option and render its humanized label.
      selectedValue = kebabToCamel(selectMatch[1]);
    }
  }
  return (
    <div>
      <Select
        showSearch={{ optionFilterProp: "value" }}
        placeholder={"Ban for the current map..."}
        value={selectedValue}
        onChange={(value) => updateBanForTeam(value, props.team, props.handler)}
        options={nameOptions}
        style={{ width: "230px" }}
      />
    </div>
  );
}

export default TeamBanInput;
