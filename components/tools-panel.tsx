"use client";
import React from "react";
import WebSearchConfig from "./websearch-config";
import ApiKeyConfig from "./api-key-config";
import PanelConfig from "./panel-config";
import useToolsStore from "@/stores/useToolsStore";

export default function ContextPanel() {
  const {
    webSearchEnabled,
    setWebSearchEnabled,
    codeInterpreterEnabled,
    setCodeInterpreterEnabled,
  } = useToolsStore();
  return (
    <div className="h-full p-8 w-full bg-[#f9f9f9] rounded-t-xl md:rounded-none border-l-1 border-stone-100">
      <div className="flex flex-col h-full">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        </div>
        <div className="flex flex-col overflow-y-scroll flex-1">
        <PanelConfig
          title="API Key"
          tooltip="OpenAI API key for authentication"
        >
          <ApiKeyConfig />
        </PanelConfig>
        <PanelConfig
          title="Web Search"
          tooltip="Allows to search the web"
          enabledTuple={{value: webSearchEnabled, setValue: setWebSearchEnabled}}
        >
          <WebSearchConfig />
        </PanelConfig>
        <PanelConfig
          title="Code Interpreter"
          tooltip="Allows the assistant to run Python code"
          enabledTuple={{value: codeInterpreterEnabled, setValue: setCodeInterpreterEnabled}}
        />
        </div>
      </div>
    </div>
  );
}
