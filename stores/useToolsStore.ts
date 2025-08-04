import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WebSearchConfig = {
  user_location?: {
    type: "approximate";
    country?: string;
    city?: string;
    region?: string;
  };
};

interface StoreState {
  apiKey: string;
  setApiKey: (apiKey: string) => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
  codeInterpreterEnabled: boolean;
  setCodeInterpreterEnabled: (enabled: boolean) => void;
  webSearchConfig: WebSearchConfig;
  setWebSearchConfig: (config: WebSearchConfig) => void;
}

const useToolsStore = create<StoreState>()(
  persist(
    (set) => ({
      apiKey: "",
      setApiKey: (apiKey) => {
        set({ apiKey });
      },
      webSearchConfig: {
        user_location: {
          type: "approximate",
          country: "",
          city: "",
          region: "",
        },
      },
      webSearchEnabled: false,
      setWebSearchEnabled: (enabled) => {
        set({ webSearchEnabled: enabled });
      },
      codeInterpreterEnabled: false,
      setCodeInterpreterEnabled: (enabled) => {
        set({ codeInterpreterEnabled: enabled });
      },
      setWebSearchConfig: (config) => set({ webSearchConfig: config }),
    }),
    {
      name: "tools-store",
    }
  )
);

export default useToolsStore;
