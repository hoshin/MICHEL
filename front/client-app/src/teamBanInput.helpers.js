// Pure (component-free) helpers backing the TeamBanInput component. Kept in
// their own module so the component file exports only a component — that keeps
// React Fast Refresh happy and makes the logic trivially unit-testable.

// Vite picks up every PNG at build time. `eager: true` returns the resolved
// URL strings directly, matching the previous static `import x from "..."`
// behaviour (no runtime fetch, same hashed asset URLs).
const portraitModules = import.meta.glob("./assets/portraits/*.png", {
  eager: true,
  import: "default",
});

// "jetpack-cat" -> "jetpackcat", "soldier-76" -> "soldier76", "d-va" -> "dva"
export const stripDashesAndUpperCase = (slug) =>
  slug.replace(/-([a-z0-9])/g, (_, c) => c.toLowerCase());

const filenameToSlug = (path) =>
  path
    .split("/")
    .pop()
    .replace(/\.png$/, "");

// Display-name overrides for portraits whose human-friendly name contains
// characters that can't be derived from the filename. Add entries here when
// a new portrait needs an alias (e.g. "D.Va", "Soldier: 76", ...).
const displayNameAliases = {};

export const portraitsKeyedByLowerCaseNames = (() => {
  const result = {};

  for (const [path, url] of Object.entries(portraitModules)) {
    result[stripDashesAndUpperCase(filenameToSlug(path))] = url;
  }

  for (const [displayName, key] of Object.entries(displayNameAliases)) {
    if (result[key]) result[displayName] = result[key];
  }

  // Preserve legacy behaviour: `none` falls back to ana.
  result.none = result.ana;
  return result;
})();

// "jetpackCat" -> "Jetpack Cat", "soldier76" -> "Soldier 76", "dva" -> "Dva"
export const humanizeKey = (key) =>
  key
    // Insert a space before any uppercase letter or digit run that follows a
    // lowercase letter/digit boundary.
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    // Capitalize the first letter of each whitespace-separated word.
    .replace(/(^|\s)([a-z])/g, (_, sep, c) => sep + c.toUpperCase());

/** Resolve the antd option `value` for a currently-selected ban path.
 * We try to retrieve the value in 2 different ways :
 *   * Dev mode: We find a matching URL logo
 *   * "Vite production mode": we cannot rely on the 1st method and match using the name of the banned hero by ectracting their name from the selected URL
 * @selected asset URL (=> `teamBanLogo` which is a URL)
 * @returns undefined when there is no selection or the path carries
 * no .png slug.
 * @note In production setup, Vite hashes asset filenames (basically adds a suffix to the original filename, before the extension)
 * @note [18/8/26] This is a lot of hassle for no real benefit, as well as creating a relationship between a hero name and the portrait image name => we should update the components to just use the hero name / a set slug
 */
export const resolveSelectedValue = (selected) => {
  if (!selected) return undefined;
  const exactKey = Object.keys(portraitsKeyedByLowerCaseNames).find(
    (key) => portraitsKeyedByLowerCaseNames[key] === selected,
  );
  if (exactKey) return exactKey;
  const selectMatch = selected.match(/\/([a-z0-9-]+)\.png/);
  if (!selectMatch) return undefined;
  return stripDashesAndUpperCase(selectMatch[1]);
};
