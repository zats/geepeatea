"use client";

import React, { useState, useRef, useEffect } from "react";
import { askEphemeralQueryStream } from "@/lib/ephemeral-client";
import ReactMarkdown from "react-markdown";
import LoadingMessage from "./loading-message";

interface QuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextMessage: string;
  selectedText?: string;
  selectionStart?: number;
  selectionEnd?: number;
  title?: string;
}

const QuestionModal: React.FC<QuestionModalProps> = ({
  isOpen,
  onClose,
  contextMessage,
  selectedText,
  selectionStart,
  selectionEnd,
  title = "Ask about this text"
}) => {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Function to render text with inline selection highlighting
  const renderHighlightedContextMessage = (text: string) => {
    if (!selectedText || selectionStart === undefined || selectionEnd === undefined) {
      return <ReactMarkdown className="reader-content">{text}</ReactMarkdown>;
    }

    const beforeSelection = text.slice(0, selectionStart);
    const selection = text.slice(selectionStart, selectionEnd);
    const afterSelection = text.slice(selectionEnd);

    return (
      <span>
        {beforeSelection}
        <span className="bg-yellow-200 px-1 py-0.5 rounded">
          {selection}
        </span>
        {afterSelection}
      </span>
    );
  };

  // Focus textarea when modal opens and trigger entrance animation
  useEffect(() => {
    if (isOpen) {
      setIsAnimatingIn(true);
      // Trigger entrance animation
      setTimeout(() => setIsAnimatingIn(false), 10);
      
      if (textareaRef.current && !hasSubmitted) {
        textareaRef.current.focus();
      }
    }
  }, [isOpen, hasSubmitted]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isLoading]);

  // Handle click outside to close modal
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!isLoading) {
        const target = e.target as Element;
        
        // Check if the click is on the overlay background or empty content area
        if (target.classList.contains('modal-overlay') || target.classList.contains('modal-content-area')) {
          handleClose();
        }
        
        // Also check if clicking on outer container areas (not on messages/composer)
        const isClickOnMessage = target.closest('[class*="rounded-[16px]"]') || target.closest('[class*="rounded-[20px]"]');
        const isClickOnContentArea = target.closest('.modal-content-area');
        
        if (isClickOnContentArea && !isClickOnMessage) {
          handleClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, isLoading]);

  const handleSubmit = async () => {
    if (!question.trim() || isLoading) return;

    setIsLoading(true);
    setIsStreaming(true);
    setHasSubmitted(true);
    setResponse("");

    // Prepare context with both the message and selected text if available
    let context = `Message: ${contextMessage}`;
    if (selectedText) {
      context += `\n\nSelected text: "${selectedText}"`;
    }

    await askEphemeralQueryStream(
      {
        query: question.trim(),
        context,
      },
      // onContent
      (content: string) => {
        setResponse(prev => prev + content);
      },
      // onComplete
      () => {
        setIsLoading(false);
        setIsStreaming(false);
      },
      // onError
      (error: Error) => {
        console.error("Error asking question:", error);
        setResponse(`Error: ${error.message}`);
        setIsLoading(false);
        setIsStreaming(false);
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClose = () => {
    if (!isLoading && !isClosing) {
      setIsClosing(true);
      // Wait for exit animation to complete before closing
      setTimeout(() => {
        setQuestion("");
        setResponse("");
        setIsStreaming(false);
        setHasSubmitted(false);
        setIsClosing(false);
        setIsAnimatingIn(true);
        onClose();
      }, 200); // Match animation duration
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`modal-overlay fixed inset-0 bg-black flex items-center justify-center z-50 transition-all duration-200 ${
      isClosing ? 'bg-opacity-0' : isAnimatingIn ? 'bg-opacity-0' : 'bg-opacity-30'
    }`}>
      <div
        ref={modalRef}
        className="w-full h-full flex flex-col pointer-events-none"
      >

        {/* Content Area */}
        <div className="modal-content-area flex-1 overflow-y-auto pointer-events-auto">
          {hasSubmitted ? (
            /* Post-submission view: Context + Response */
            <div className="flex justify-center items-center size-full">
              <div className="flex grow flex-col max-w-[750px] gap-2">
                <div className="px-10 flex flex-col">
                  <div className="space-y-5">
                    {/* Context Message */}
                    <div className={`mr-4 md:mr-24 rounded-[16px] px-4 py-2 bg-white border border-gray-200 text-black font-light transition-all duration-200 ${
                      isClosing 
                        ? 'opacity-0 translate-y-2 scale-95' 
                        : isAnimatingIn
                        ? 'opacity-0 translate-y-2 scale-95'
                        : 'opacity-100 translate-y-0 scale-100'
                    }`} style={{ transitionDelay: isClosing ? '150ms' : '0ms' }}>
                      <div className="text-xs text-gray-500 mb-1">Context:</div>
                      {renderHighlightedContextMessage(contextMessage)}
                    </div>

                    {/* User Question */}
                    <div className={`ml-4 md:ml-24 rounded-[16px] px-4 py-2 bg-[#ededed] text-stone-900 font-light transition-all duration-200 ${
                      isClosing 
                        ? 'opacity-0 translate-y-2 scale-95' 
                        : isAnimatingIn
                        ? 'opacity-0 translate-y-2 scale-95'
                        : 'opacity-100 translate-y-0 scale-100'
                    }`} style={{ transitionDelay: isClosing ? '100ms' : '50ms' }}>
                      {question}
                    </div>

                    {/* Response */}
                    {isStreaming && !response ? (
                      <div className={`mr-4 md:mr-24 transition-all duration-200 ${
                        isClosing 
                          ? 'opacity-0 translate-y-2 scale-95' 
                          : 'opacity-100 translate-y-0 scale-100'
                      }`} style={{ transitionDelay: isClosing ? '50ms' : '100ms' }}>
                        <LoadingMessage dotColor="bg-white" />
                      </div>
                    ) : response ? (
                      <div className={`mr-4 md:mr-24 rounded-[16px] px-4 py-2 bg-white border border-gray-200 text-black font-light transition-all duration-200 ${
                        isClosing 
                          ? 'opacity-0 translate-y-2 scale-95' 
                          : 'opacity-100 translate-y-0 scale-100'
                      }`} style={{ transitionDelay: isClosing ? '0ms' : '100ms' }}>
                        <ReactMarkdown className="reader-content">{response}</ReactMarkdown>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Pre-submission view: Context + Composer */
            <div className="flex justify-center items-center size-full">
              <div className="flex grow flex-col max-w-[750px] gap-2">
                <div className="p-4 px-10">
                  <div className="space-y-5">
                    {/* Context Message */}
                    <div className={`mr-4 md:mr-24 rounded-[16px] px-4 py-2 bg-white border border-gray-200 text-black font-light transition-all duration-200 ${
                      isClosing 
                        ? 'opacity-0 translate-y-2 scale-95' 
                        : isAnimatingIn
                        ? 'opacity-0 translate-y-2 scale-95'
                        : 'opacity-100 translate-y-0 scale-100'
                    }`} style={{ transitionDelay: isClosing ? '100ms' : '0ms' }}>
                      <div className="text-xs text-gray-500 mb-1">Context:</div>
                      {renderHighlightedContextMessage(contextMessage)}
                    </div>

                    {/* Composer on the right */}
                    <div className="flex items-center">
                      <div className="flex w-full items-center justify-end">
                        <div className={`flex w-full max-w-[600px] flex-col gap-1.5 rounded-[20px] p-2.5 pl-1.5 border border-stone-200 shadow-sm bg-white ml-4 md:ml-24 transition-all duration-200 ${
                          isClosing 
                            ? 'opacity-0 translate-y-2 scale-95' 
                            : 'opacity-100 translate-y-0 scale-100'
                        }`} style={{ transitionDelay: isClosing ? '0ms' : '50ms' }}>
                          <div className="flex items-end gap-1.5 md:gap-2 pl-4">
                            <div className="flex min-w-0 flex-1 flex-col">
                              <textarea
                                ref={textareaRef}
                                tabIndex={0}
                                dir="auto"
                                rows={1}
                                placeholder="Ask a question about this..."
                                className="resize-none border-0 focus:outline-none text-sm bg-transparent px-0 py-2 min-h-[1.5rem] leading-relaxed"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                style={{ 
                                  height: 'auto',
                                  minHeight: '1.5rem'
                                }}
                                onInput={(e) => {
                                  const target = e.target as HTMLTextAreaElement;
                                  target.style.height = 'auto';
                                  target.style.height = target.scrollHeight + 'px';
                                }}
                              />
                            </div>
                            <button
                              disabled={!question.trim() || isLoading}
                              onClick={handleSubmit}
                              className="flex size-8 items-center justify-center rounded-full bg-black text-white transition-colors hover:opacity-70 focus-visible:outline-none focus-visible:outline-black disabled:bg-[#D7D7D7] disabled:text-[#f4f4f4] disabled:hover:opacity-100 self-center"
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionModal;