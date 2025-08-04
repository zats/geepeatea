"use client";
import Assistant from "@/components/assistant";
import ToolsPanel from "@/components/tools-panel";
import { Menu, X, Settings, PenSquare } from "lucide-react";
import { useState, useEffect } from "react";
import useConversationStore from "@/stores/useConversationStore";
import useToolsStore from "@/stores/useToolsStore";

export default function Main() {
  const [isToolsPanelOpen, setIsToolsPanelOpen] = useState(false);
  const [highlightApiKey, setHighlightApiKey] = useState(false);
  const { clearConversation } = useConversationStore();
  const { apiKey } = useToolsStore();

  // Check for API key on page load
  useEffect(() => {
    if (!apiKey || apiKey.trim() === '') {
      setIsToolsPanelOpen(true);
      setHighlightApiKey(true);
    } else {
      setHighlightApiKey(false);
      setIsToolsPanelOpen(false);
    }
  }, [apiKey]);

  const handleNewConversation = () => {
    clearConversation();
    // Close settings panel after clearing conversation
    setIsToolsPanelOpen(false);
  };

  return (
    <div className="h-screen relative">
      <div className={`w-full transition-all duration-300 ease-in-out ${
        isToolsPanelOpen ? 'md:w-[70%]' : 'md:w-full'
      } relative`}>
        <Assistant />
        {/* Dimming overlay for desktop when settings panel is open */}
        <div 
          className={`hidden md:block absolute inset-0 bg-black transition-opacity duration-300 ease-in-out ${
            isToolsPanelOpen ? 'opacity-20 cursor-pointer' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => isToolsPanelOpen && setIsToolsPanelOpen(false)}
        />
      </div>
      
      {/* Action buttons */}
      <div className="fixed top-4 right-4 z-40 flex gap-2">
        {/* New Conversation button - hidden when settings panel is open */}
        {!isToolsPanelOpen && (
          <button 
            onClick={handleNewConversation}
            className="flex items-center justify-center w-10 h-10 bg-white border border-stone-200 rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:bg-gray-50"
            aria-label="New conversation"
          >
            <PenSquare size={20} />
          </button>
        )}
        
        {/* Settings button */}
        <button 
          onClick={() => setIsToolsPanelOpen(!isToolsPanelOpen)}
          className="flex items-center justify-center w-10 h-10 bg-white border border-stone-200 rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:bg-gray-50"
          aria-label="Toggle settings"
        >
          {isToolsPanelOpen ? <X size={20} /> : <Settings size={20} />}
        </button>
      </div>

      {/* Desktop settings panel */}
      <div className={`hidden md:block fixed top-0 right-0 h-full w-[30%] z-30 transform transition-transform duration-300 ease-in-out ${
        isToolsPanelOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <ToolsPanel highlightApiKey={highlightApiKey} />
      </div>

      {/* Mobile overlay panel */}
      <div className={`md:hidden fixed inset-0 z-50 transition-all duration-300 ease-in-out ${
        isToolsPanelOpen 
          ? 'opacity-100 pointer-events-auto' 
          : 'opacity-0 pointer-events-none'
      }`}>
        <div className="absolute inset-0 bg-black bg-opacity-30" onClick={() => setIsToolsPanelOpen(false)} />
        <div className={`absolute right-0 top-0 w-full h-full bg-white transform transition-transform duration-300 ease-in-out ${
          isToolsPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <div className="p-4 h-full">
            <ToolsPanel highlightApiKey={highlightApiKey} />
          </div>
        </div>
      </div>
    </div>
  );
}
