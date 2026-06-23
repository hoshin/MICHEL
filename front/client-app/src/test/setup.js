import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom in this Node configuration does not expose a working localStorage
// (it needs the --localstorage-file flag). Provide a minimal in-memory
// implementation so components relying on persistence can be exercised.
beforeAll(() => {
  if (
    typeof window !== "undefined" &&
    !("localStorage" in window && window.localStorage)
  ) {
    const store = new Map();
    const memoryStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: memoryStorage,
    });
  }

  // antd's responsive components (Table, Grid) call matchMedia, which jsdom
  // does not implement. A no-match stub is enough to let them render.
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

// React Testing Library leaves mounted trees behind between tests; unmount
// them so each test starts from a clean DOM and shared singletons (such as
// the team-data socket hook) are not observed across test boundaries.
afterEach(() => {
  cleanup();
});
