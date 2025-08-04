"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ToolCall from "./tool-call";
import Message from "./message";
import Annotations from "./annotations";
import McpToolsList from "./mcp-tools-list";
import McpApproval from "./mcp-approval";
import { Item, McpApprovalRequestItem } from "@/lib/assistant";
import LoadingMessage from "./loading-message";
import useConversationStore from "@/stores/useConversationStore";

interface TextAnnotation {
  id: string;
  text: string;
  comment: string;
  startIndex: number;
  endIndex: number;
}

interface ChatProps {
  items: Item[];
  onSendMessage: (message: string, annotatedMessageIndex?: number) => void;
  onApprovalResponse: (approve: boolean, id: string) => void;
}

const Chat: React.FC<ChatProps> = ({
  items,
  onSendMessage,
  onApprovalResponse,
}) => {
  const itemsEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<number, { clearAnnotations: () => void }>>({});
  const [inputMessageText, setInputMessageText] = useState<string>("");
  // This state is used to provide better user experience for non-English IMEs such as Japanese
  const [isComposing, setIsComposing] = useState(false);
  const [messageAnnotations, setMessageAnnotations] = useState<Record<number, TextAnnotation[]>>({});
  const [isInAnnotationMode, setIsInAnnotationMode] = useState(false);
  const { isAssistantLoading } = useConversationStore();

  // Log when loading animation appears/disappears in the UI
  useEffect(() => {
    if (isAssistantLoading) {
      console.log('[Loading Animation] Loading animation is now VISIBLE');
    } else {
      console.log('[Loading Animation] Loading animation is now HIDDEN');
    }
  }, [isAssistantLoading]);

  const scrollToBottom = () => {
    itemsEndRef.current?.scrollIntoView({ behavior: "instant" });
  };

  const handleAnnotationsChange = useCallback((messageIndex: number, annotations: TextAnnotation[]) => {
    setMessageAnnotations(prev => {
      const newState = {
        ...prev,
        [messageIndex]: annotations
      };
      
      // Check if there are any annotations across all messages
      const hasAnyAnnotations = Object.values(newState).some(msgAnnotations => msgAnnotations.length > 0);
      
      // Set annotation mode to true if we have any annotations
      if (hasAnyAnnotations && !isInAnnotationMode) {
        setIsInAnnotationMode(true);
      }
      // Set to false if all annotations were removed
      else if (!hasAnyAnnotations && isInAnnotationMode) {
        setIsInAnnotationMode(false);
      }
      
      return newState;
    });
  }, [isInAnnotationMode]);

  const formatAnnotationsForMessage = (inputText: string): string => {
    const allAnnotations = Object.values(messageAnnotations).flat();
    if (allAnnotations.length === 0) {
      return inputText;
    }

    let formattedMessage = inputText;
    if (inputText.trim()) {
      formattedMessage += "\n\n";
    }
    formattedMessage += `User made following annotations on the previous message.
Retain as much of the original message as possible, replace annotated parts where makes sense.
Annotations list:
`;
    allAnnotations.forEach((annotation, index) => {
      formattedMessage += `* "${annotation.text}" → ${annotation.comment}\n\n`;
    });

    formattedMessage += `

Respond with full message. Do not mention annotations themselves or the fact user created them requesting changes.`;
    return formattedMessage.trim();
  };

  const handleSendMessage = useCallback(() => {
    const messageToSend = formatAnnotationsForMessage(inputMessageText);
    
    // Find which message has annotations (if any) - only if there are actual annotations
    const hasAnnotations = Object.keys(messageAnnotations).length > 0;
    const annotatedMessageIndex = hasAnnotations 
      ? Math.max(...Object.keys(messageAnnotations).map(Number))
      : undefined;
        
    // Clear annotations FIRST - this makes composer background white immediately
    setMessageAnnotations({});
    // Reset annotation mode when sending message
    if (isInAnnotationMode) {
      setIsInAnnotationMode(false);
    }
    Object.values(messageRefs.current).forEach(messageRef => {
      if (messageRef && messageRef.clearAnnotations) {
        messageRef.clearAnnotations();
      }
    });
    
    // Then send the message
    onSendMessage(messageToSend, isInAnnotationMode ? annotatedMessageIndex : undefined);
    setInputMessageText("");
  }, [inputMessageText, messageAnnotations, onSendMessage, isInAnnotationMode]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && !isComposing) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    [isComposing, handleSendMessage]
  );

  useEffect(() => {
    scrollToBottom();
  }, [items]);

  return (
    <div className="flex justify-center items-center size-full">
      <div className="flex grow flex-col h-full max-w-[750px] gap-2">
        <div className="h-[90vh] overflow-y-scroll px-10 flex flex-col">
          <div className="mt-auto space-y-5 pt-4">
{items
              .filter((item, index) => {
                // Filter out annotation request messages from UI display
                if (item.type === "message" && item.isAnnotationRequest) {
                  return false;
                }
                
                // Filter out consecutive web searches, keeping only the latest one
                if (item.type === "tool_call" && item.tool_type === "web_search_call") {
                  // Check if the next item is also a web search
                  const nextItem = items[index + 1];
                  if (nextItem && nextItem.type === "tool_call" && nextItem.tool_type === "web_search_call") {
                    return false; // Hide this web search if the next one is also a web search
                  }
                }
                return true;
              })
              .map((item, index) => {
                // Find the original index in the unfiltered items array for accurate deletion
                const originalIndex = items.findIndex(originalItem => originalItem === item);
                return (
                  <React.Fragment key={index}>
                    {item.type === "tool_call" ? (
                      <ToolCall toolCall={item} />
                    ) : item.type === "message" ? (
                      <div className="flex flex-col gap-1">
                        <Message 
                          ref={(ref) => {
                            if (ref && item.role === "assistant") {
                              messageRefs.current[originalIndex] = ref;
                            }
                          }}
                          message={item} 
                          messageIndex={originalIndex} 
                          onAnnotationsChange={handleAnnotationsChange}
                        />
                        {item.content &&
                          item.content[0].annotations &&
                          item.content[0].annotations.length > 0 && (
                            <Annotations
                              annotations={item.content[0].annotations}
                            />
                          )}
                      </div>
                    ) : item.type === "mcp_list_tools" ? (
                      <McpToolsList item={item} />
                    ) : item.type === "mcp_approval_request" ? (
                      <McpApproval
                        item={item as McpApprovalRequestItem}
                        onRespond={onApprovalResponse}
                      />
                    ) : null}
                  </React.Fragment>
                );
              })}
            {isAssistantLoading && <LoadingMessage />}
            <div ref={itemsEndRef} />
          </div>
        </div>
        <div className="flex-1 p-4 px-10">
          <div className="flex items-center">
            <div className="flex w-full items-center pb-4 md:pb-1">
              <div className={`flex w-full flex-col gap-1.5 rounded-[20px] p-2.5 pl-1.5 transition-colors border border-stone-200 shadow-sm ${
                isInAnnotationMode 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : 'bg-white'
              }`}>
                <div className="flex items-end gap-1.5 md:gap-2 pl-4">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <textarea
                      id="prompt-textarea"
                      tabIndex={0}
                      dir="auto"
                      rows={2}
                      placeholder="Message..."
                      className="mb-2 resize-none border-0 focus:outline-none text-sm bg-transparent px-0 pb-6 pt-2"
                      value={inputMessageText}
                      onChange={(e) => setInputMessageText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onCompositionStart={() => setIsComposing(true)}
                      onCompositionEnd={() => setIsComposing(false)}
                    />
                  </div>
                  <button
                    disabled={!inputMessageText && !isInAnnotationMode}
                    data-testid="send-button"
                    className="flex size-8 items-end justify-center rounded-full bg-black text-white transition-colors hover:opacity-70 focus-visible:outline-none focus-visible:outline-black disabled:bg-[#D7D7D7] disabled:text-[#f4f4f4] disabled:hover:opacity-100"
                    onClick={handleSendMessage}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="32"
                      height="32"
                      fill="none"
                      viewBox="0 0 32 32"
                      className="icon-2xl"
                    >
                      <path
                        fill="currentColor"
                        fillRule="evenodd"
                        d="M15.192 8.906a1.143 1.143 0 0 1 1.616 0l5.143 5.143a1.143 1.143 0 0 1-1.616 1.616l-3.192-3.192v9.813a1.143 1.143 0 0 1-2.286 0v-9.813l-3.192 3.192a1.143 1.143 0 1 1-1.616-1.616z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
