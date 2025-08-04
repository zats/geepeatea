"use client";
import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import useToolsStore from "@/stores/useToolsStore";

export default function ApiKeyConfig() {
  const { apiKey, setApiKey } = useToolsStore();
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type={showApiKey ? "text" : "password"}
          placeholder="Enter your OpenAI API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => setShowApiKey(!showApiKey)}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
        >
          {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <p className="text-xs text-gray-600">
        Your API key is stored locally and never sent to our servers.
      </p>
    </div>
  );
}