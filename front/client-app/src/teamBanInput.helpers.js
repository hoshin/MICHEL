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

// "jetpack-cat" -> "jetpackCat", "soldier-76" -> "soldier76", "d-va" -> "dva"
export const kebabToCamel = (slug) =>
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

// Resolve the antd option `value` for a currently-selected ban path. The
// `selected` value is an asset URL such as "/assets/portraits/jetpack-cat.png";
// we pull out the filename slug and camel-case it so it lines up with the
// option `value`s built from `portraits`. Returns undefined when there is no
// selection or the path carries no .png slug.
export const resolveSelectedValue = (selected) => {
  if (!selected) return undefined;
  const selectMatch = selected.match(/\/([a-z0-9_-]+)\.png/);
  if (!selectMatch) return undefined;
  return kebabToCamel(selectMatch[1]);
};
