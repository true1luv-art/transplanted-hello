import { useEffect, useState } from "react";

/** True only after client-side mount — gates persisted (localStorage) state. */
export const useHydrated = (): boolean => {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
};
