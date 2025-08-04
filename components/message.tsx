import { MessageItem } from "@/lib/assistant";
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import useConversationStore from "@/stores/useConversationStore";
import { X, Edit3, Trash2, MessageSquare, ChevronLeft, ChevronRight, History, Loader2, HelpCircle } from "lucide-react";
import { askEphemeralQuery } from "@/lib/ephemeral-client";
import QuestionModal from "./question-modal";

interface MessageProps {
  message: MessageItem;
  messageIndex: number;
  onAnnotationsChange?: (messageIndex: number, annotations: TextAnnotation[]) => void;
}

interface TextAnnotation {
  id: string;
  text: string;
  comment: string;
  startIndex: number;
  endIndex: number;
}

const Message = React.forwardRef<{ clearAnnotations: () => void; editAnnotation: (annotationId: string) => void }, MessageProps>(function Message({ message, messageIndex, onAnnotationsChange }, ref) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [annotationMenu, setAnnotationMenu] = useState<{ x: number; y: number } | null>(null);
  const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);
  const [annotationComment, setAnnotationComment] = useState("");
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState<{
    message: string;
    selectedText?: string;
    selectionStart?: number;
    selectionEnd?: number;
    title?: string;
  } | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const messageDomRef = useRef<HTMLDivElement>(null);
  const { deleteChatMessage, deleteChatMessageAfter, editChatMessage, selectMessageVersion, createMessageVersion } = useConversationStore();

  // Version navigation helpers
  const hasVersions = message.versions && message.versions.length > 1;
  const currentVersionIndex = hasVersions 
    ? message.versions!.findIndex(v => v.id === message.currentVersionId) 
    : -1;
  
  // If no currentVersionId is set or invalid, default to the last version
  // This ensures we always have a valid index (0 to length-1) when versions exist
  const effectiveVersionIndex = hasVersions 
    ? (currentVersionIndex >= 0 ? currentVersionIndex : message.versions!.length - 1)
    : 0;
    
  const canGoToPrevious = hasVersions && effectiveVersionIndex > 0;
  const canGoToNext = hasVersions && effectiveVersionIndex < message.versions!.length - 1;



  const handleContextMenu = (e: React.MouseEvent) => {
    // Don't show context menu for the initial placeholder message
    if (message.isPlaceholder) {
      e.preventDefault();
      return;
    }
    
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleDeleteMessage = () => {
    const messageElement = messageDomRef.current;
    if (messageElement) {
      const rect = messageElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2 + window.scrollX;
      const centerY = rect.top + rect.height / 2 + window.scrollY;
      
      // Create poof animation element
      const poofElement = document.createElement('div');
      poofElement.className = 'poof';
      poofElement.style.position = 'absolute';
      poofElement.style.left = `${centerX - 32}px`; // Center the 64px element
      poofElement.style.top = `${centerY - 32}px`;
      document.body.appendChild(poofElement);
      
      // Remove poof element after animation completes
      setTimeout(() => {
        if (poofElement.parentNode) {
          poofElement.parentNode.removeChild(poofElement);
        }
      }, 800); // 300ms poof + 200ms delay + 600ms fade - some buffer
      
      // Delete message after a short delay to let animation start
      setTimeout(() => {
        deleteChatMessage(messageIndex);
      }, 50);
    } else {
      // Fallback if no ref available
      deleteChatMessage(messageIndex);
    }
    setContextMenu(null);
  };

  const handleDeleteAfter = () => {
    const messageElement = messageDomRef.current;
    if (messageElement) {
      const rect = messageElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2 + window.scrollX;
      const centerY = rect.top + rect.height / 2 + window.scrollY;
      
      // Create poof animation element
      const poofElement = document.createElement('div');
      poofElement.className = 'poof';
      poofElement.style.position = 'absolute';
      poofElement.style.left = `${centerX - 32}px`; // Center the 64px element
      poofElement.style.top = `${centerY - 32}px`;
      document.body.appendChild(poofElement);
      
      // Remove poof element after animation completes
      setTimeout(() => {
        if (poofElement.parentNode) {
          poofElement.parentNode.removeChild(poofElement);
        }
      }, 800); // 300ms poof + 200ms delay + 600ms fade - some buffer
      
      // Delete messages after a short delay to let animation start
      setTimeout(() => {
        deleteChatMessageAfter(messageIndex);
      }, 50);
    } else {
      // Fallback if no ref available
      deleteChatMessageAfter(messageIndex);
    }
    setContextMenu(null);
  };
  
  const handleAskAboutThis = () => {
    const messageText = message.content[0].text as string;
    if (!messageText) return;
    
    setContextMenu(null);
    setModalContext({
      message: messageText,
      title: "Ask about this message"
    });
    setIsQuestionModalOpen(true);
  };

  const handleEdit = () => {
    setEditText(message.content[0].text as string);
    setIsEditing(true);
    setContextMenu(null);
  };

  const handleSaveEdit = () => {
    editChatMessage(messageIndex, editText);
    setIsEditing(false);
  };

  const handleCancelEdit = (force: boolean) => {
    if (force) {
    setIsEditing(false);
    setEditText("");
  }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit(true);
    }
  };

  const handlePreviousVersion = () => {
    if (canGoToPrevious && message.versions && effectiveVersionIndex > 0) {
      const prevVersionId = message.versions[effectiveVersionIndex - 1].id;
      selectMessageVersion(messageIndex, prevVersionId);
    }
  };

  const handleNextVersion = () => {
    if (canGoToNext && message.versions && effectiveVersionIndex < message.versions.length - 1) {
      const nextVersionId = message.versions[effectiveVersionIndex + 1].id;
      selectMessageVersion(messageIndex, nextVersionId);
    }
  };

  const handleTextSelection = () => {
    if (message.role !== "assistant") return;
    
    // Don't allow annotations on the initial placeholder message
    if (message.isPlaceholder) {
      return;
    }
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      // Don't clear annotation menu immediately - let click handler manage it
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    const messageElement = messageDomRef.current;
    if (!messageElement || !messageElement.contains(range.startContainer)) return;

    // Calculate selection indices relative to the original text (not the DOM text)
    const fullText = message.content[0].text as string;
    const { startIndex, endIndex } = getOriginalTextIndices(messageElement, range, fullText);
    
    if (startIndex === -1 || endIndex === -1) return;

    setSelectedText(selectedText);
    setSelectionRange({ start: startIndex, end: endIndex });

    // Position the annotation menu near the selection
    const rect = range.getBoundingClientRect();
    setAnnotationMenu({
      x: rect.left + rect.width / 2,
      y: rect.top - 5
    });
  };

  const getOriginalTextIndices = (parent: Element, range: Range, originalText: string): { startIndex: number; endIndex: number } => {
    // Get the selected text from the range
    const selectedText = range.toString();
    
    // Find the text content of the parent, ignoring annotation buttons and tooltips
    let domText = '';
    const walker = document.createTreeWalker(
      parent,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip text nodes that are inside buttons or tooltips (annotation UI elements)
          let parentEl = node.parentElement;
          while (parentEl && parentEl !== parent) {
            if (parentEl.tagName === 'BUTTON' || 
                parentEl.hasAttribute('data-annotation-input') ||
                parentEl.classList.contains('group-hover:block') ||
                parentEl.classList.contains('group-hover:inline-flex')) {
              return NodeFilter.FILTER_REJECT;
            }
            parentEl = parentEl.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let currentNode;
    while (currentNode = walker.nextNode()) {
      domText += currentNode.textContent || '';
    }

    // Find where the selected text appears in the original text
    const startIndex = originalText.indexOf(selectedText);
    if (startIndex === -1) {
      // If exact match not found, try to find it accounting for whitespace differences
      const normalizedSelected = selectedText.replace(/\s+/g, ' ').trim();
      const normalizedOriginal = originalText.replace(/\s+/g, ' ');
      const normalizedStart = normalizedOriginal.indexOf(normalizedSelected);
      
      if (normalizedStart === -1) {
        return { startIndex: -1, endIndex: -1 };
      }
      
      // Convert normalized index back to original text index
      let originalIndex = 0;
      let normalizedIndex = 0;
      while (normalizedIndex < normalizedStart && originalIndex < originalText.length) {
        if (originalText[originalIndex].match(/\s/)) {
          // Skip extra whitespace in original
          while (originalIndex < originalText.length && originalText[originalIndex].match(/\s/)) {
            originalIndex++;
          }
          normalizedIndex++;
        } else {
          originalIndex++;
          normalizedIndex++;
        }
      }
      
      return { 
        startIndex: originalIndex, 
        endIndex: originalIndex + selectedText.length 
      };
    }

    return { 
      startIndex, 
      endIndex: startIndex + selectedText.length 
    };
  };

  const handleCreateAnnotation = () => {
    if (!selectedText || !selectionRange) return;

    const id = Date.now().toString();
    const newAnnotation: TextAnnotation = {
      id,
      text: selectedText,
      comment: "",
      startIndex: selectionRange.start,
      endIndex: selectionRange.end
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    setActiveAnnotation(id);
    setAnnotationComment("");
    setAnnotationMenu(null);
    
    // Don't clear selection yet - we'll clear it when annotation is saved/cancelled
  };

  const handleSaveAnnotation = (annotationId: string) => {
    if (!annotationComment.trim()) return;

    setAnnotations(prev => prev.map(ann => 
      ann.id === annotationId 
        ? { ...ann, comment: annotationComment.trim() }
        : ann
    ));
    setActiveAnnotation(null);
    setAnnotationComment("");
    
    // Clear selection when annotation is saved
    window.getSelection()?.removeAllRanges();
  };

  const handleCancelAnnotation = React.useCallback((annotationId: string) => {
    // Find the annotation to check if it has a saved comment
    const annotation = annotations.find(ann => ann.id === annotationId);
    
    if (annotation && annotation.comment.trim()) {
      // Existing annotation with saved comment - just exit edit mode, don't delete
      setActiveAnnotation(null);
      setAnnotationComment("");
    } else {
      // New annotation without saved comment - remove it completely
      setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
      setActiveAnnotation(null);
      setAnnotationComment("");
    }
    
    // Clear selection when annotation is cancelled
    window.getSelection()?.removeAllRanges();
  }, [annotations]);

  const handleAskAboutSelection = () => {
    if (!selectedText) return;
    
    const messageText = message.content[0].text as string;
    const textToQuery = selectedText;
    const selectionIndices = selectionRange;
    
    setAnnotationMenu(null);
    
    // Clear selection and selection range
    setSelectedText("");
    setSelectionRange(null);
    window.getSelection()?.removeAllRanges();
    
    setModalContext({
      message: messageText,
      selectedText: textToQuery,
      selectionStart: selectionIndices?.start,
      selectionEnd: selectionIndices?.end,
      title: "Ask about selected text"
    });
    setIsQuestionModalOpen(true);
  };

  const handleDeleteAnnotation = (annotationId: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
  };

  const handleEditAnnotation = (annotationId: string) => {
    const annotation = annotations.find(ann => ann.id === annotationId);
    if (annotation) {
      setActiveAnnotation(annotationId);
      setAnnotationComment(annotation.comment);
    }
  };

  const handleAnnotationKeyDown = (e: React.KeyboardEvent, annotationId: string) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveAnnotation(annotationId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelAnnotation(annotationId);
    }
  };

  const renderHighlightedText = (text: string) => {
    if (annotations.length === 0) return text;

    // Sort annotations by start index to process them in order
    const sortedAnnotations = [...annotations].sort((a, b) => a.startIndex - b.startIndex);
    
    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedAnnotations.forEach((annotation, index) => {
      // Add text before this annotation
      if (annotation.startIndex > lastIndex) {
        result.push(text.slice(lastIndex, annotation.startIndex));
      }

      // Add highlighted text
      result.push(
        <span
          key={annotation.id}
          data-annotation-id={annotation.id}
          className="relative cursor-pointer inline group"
          style={{
            background: '#fef08a',
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
            padding: '2px 4px',
            borderRadius: '4px',
            margin: '0 1px'
          }}
          title={annotation.comment || "Click to edit annotation"}
          onClick={(e) => {
            e.stopPropagation();
            if (annotation.comment && activeAnnotation !== annotation.id) {
              handleEditAnnotation(annotation.id);
            }
          }}
        >
          {text.slice(annotation.startIndex, annotation.endIndex)}
          {/* Show delete button next to highlight on hover */}
          {annotation.comment && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteAnnotation(annotation.id);
              }}
              className="group-hover:inline-flex hidden ml-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-300 rounded-full p-0.5 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
          {/* Show inline input if this annotation is being actively edited */}
          {activeAnnotation === annotation.id ? (
            <div data-annotation-input className="absolute bottom-full left-0 mb-1 bg-yellow-100 border border-yellow-300 rounded p-2 text-sm min-w-[100px] max-w-64 z-20 shadow-lg">
              <textarea
                value={annotationComment}
                onChange={(e) => setAnnotationComment(e.target.value)}
                onKeyDown={(e) => handleAnnotationKeyDown(e, annotation.id)}
                placeholder="Enter your comment..."
                className="w-full p-2 border border-gray-300 rounded text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                autoFocus
              />
            </div>
          ) : annotation.comment ? (
            /* Show completed annotation tooltip on hover */
            <div className="group-hover:block hidden absolute bottom-full left-0 mb-1 bg-yellow-100 border border-yellow-300 rounded p-2 text-xs min-w-[100px] max-w-48 z-10 shadow-lg">
              {annotation.comment}
            </div>
          ) : null}
        </span>
      );

      lastIndex = annotation.endIndex;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result;
  };

  // Clear annotations when requested (exposed method)
  React.useImperativeHandle(ref, () => ({
    clearAnnotations: () => setAnnotations([]),
    editAnnotation: (annotationId: string) => {
      const annotation = annotations.find(ann => ann.id === annotationId);
      if (annotation) {
        setActiveAnnotation(annotationId);
        setAnnotationComment(annotation.comment);
      }
    }
  }));

  // Notify parent when annotations change - only call when valid annotations actually change
  const validAnnotationsRef = React.useRef<TextAnnotation[]>([]);
  React.useEffect(() => {
    if (onAnnotationsChange && message.role === "assistant") {
      const validAnnotations = annotations.filter(ann => ann.comment.trim());
      
      // Only call parent if annotations actually changed
      const currentValidAnnotations = JSON.stringify(validAnnotations.map(({ id, text, comment }) => ({ id, text, comment })));
      const previousValidAnnotations = JSON.stringify(validAnnotationsRef.current.map(({ id, text, comment }) => ({ id, text, comment })));
      
      if (currentValidAnnotations !== previousValidAnnotations) {
        validAnnotationsRef.current = validAnnotations;
        onAnnotationsChange(messageIndex, validAnnotations);
      }
    }
  }, [annotations, messageIndex, onAnnotationsChange, message.role]);

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      setContextMenu(null);
      
      const target = e.target as Element;
      
      // Clear annotation menu if clicking outside of it
      const annotationMenuElement = document.querySelector('[data-annotation-menu]');
      if (annotationMenuElement && !annotationMenuElement.contains(target)) {
        setAnnotationMenu(null);
      } else if (!annotationMenuElement) {
        setAnnotationMenu(null);
      }
      
      // Clear active annotation input if clicking outside of it
      const annotationInputElement = document.querySelector('[data-annotation-input]');
      if (activeAnnotation && annotationInputElement && !annotationInputElement.contains(target)) {
        handleCancelAnnotation(activeAnnotation);
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      // Only check for text selection on mouseup events within the message
      const messageElement = messageDomRef.current;
      if (messageElement && messageElement.contains(e.target as Node)) {
        setTimeout(handleTextSelection, 10);
      }
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeAnnotation, handleCancelAnnotation]);
  return (
    <div className="text-sm">
      {message.role === "user" ? (
        <div className="flex justify-end">
          <div>
            <div 
              ref={messageDomRef}
              className={`ml-4 md:ml-24 ${isEditing ? '' : 'rounded-[16px] px-4 py-2 bg-[#ededed]'} text-stone-900 font-light cursor-pointer`}
              onContextMenu={handleContextMenu}
            >
              <div>
                <div>
                  {isEditing ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full bg-[#ededed] border border-gray-300 rounded-[16px] px-4 py-2 outline-none resize-none font-light text-stone-900"
                      rows={Math.max(2, editText.split('\n').length)}
                      autoFocus
                      onBlur={handleSaveEdit}
                    />
                  ) : (
                    <ReactMarkdown>
                      {message.content[0].text as string}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="flex">
            <div 
              ref={messageDomRef}
              className={`mr-4 md:mr-24 rounded-[16px] px-4 py-2 bg-white border border-gray-200 text-black font-light cursor-pointer ${isEditing ? 'relative' : ''}`}
              onContextMenu={handleContextMenu}
            >
              <div className={isEditing ? 'opacity-0' : '' + ' whitespace-pre-wrap'}>
                {renderHighlightedText(message.content[0].text as string)}
                {message.content[0].annotations &&
                  message.content[0].annotations
                    .filter(
                      (a) =>
                        a.type === "container_file_citation" &&
                        a.filename &&
                        /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(a.filename)
                    )
                    .map((a, i) => (
                      <img
                        key={i}
                        src={`/api/container_files/content?file_id=${a.fileId}${a.containerId ? `&container_id=${a.containerId}` : ""}${a.filename ? `&filename=${encodeURIComponent(a.filename)}` : ""}`}
                        alt={a.filename || ""}
                        className="mt-2 max-w-full"
                      />
                    ))}
              </div>
              {isEditing && (
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  wrap="soft"
                  className="absolute bg-white border border-gray-200 rounded-[16px] outline-none resize-none font-light text-black"
                  style={{
                    top: '0px',
                    left: '0px',
                    right: '0px',
                    bottom: '0px',
                    padding: '8px 16px',
                    margin: '0px',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    lineHeight: 'inherit',
                    letterSpacing: 'inherit',
                    wordSpacing: 'inherit',
                    whiteSpace: 'pre-wrap'
                  }}
                  autoFocus
                  onBlur={handleSaveEdit}
                />
              )}
            </div>
          </div>
          
          {/* Version Navigation - only show for assistant messages with multiple versions */}
          {hasVersions && message.role === "assistant" && (
            <div className="flex items-center justify-start mt-2 mr-4 md:mr-24">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <History className="w-3 h-3" />
                <span>Version {effectiveVersionIndex + 1} of {message.versions!.length}</span>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={handlePreviousVersion}
                    disabled={!canGoToPrevious}
                    className={`p-1 rounded hover:bg-gray-100 ${canGoToPrevious ? 'text-gray-600' : 'text-gray-300 cursor-not-allowed'}`}
                    title="Previous version"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleNextVersion}
                    disabled={!canGoToNext}
                    className={`p-1 rounded hover:bg-gray-100 ${canGoToNext ? 'text-gray-600' : 'text-gray-300 cursor-not-allowed'}`}
                    title="Next version"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            onClick={handleEdit}
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
          
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            onClick={handleAskAboutThis}
          >
            <HelpCircle className="w-4 h-4" />
            Ask about this
          </button>
          
          {/* Separator */}
          <div className="border-t border-gray-200 my-1"></div>
          
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
            onClick={handleDeleteMessage}
          >
            <Trash2 className="w-4 h-4" />
            Delete message
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
            onClick={handleDeleteAfter}
          >
            <Trash2 className="w-4 h-4" />
            Delete rest of the messages
          </button>
        </div>
      )}

      {/* Annotation Menu */}
      {annotationMenu && (
        <div
          data-annotation-menu
          className="fixed bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50"
          style={{ left: annotationMenu.x, top: annotationMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            onClick={handleCreateAnnotation}
          >
            <MessageSquare className="w-4 h-4" />
            Annotate
          </button>
          
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            onClick={handleAskAboutSelection}
          >
            <HelpCircle className="w-4 h-4" />
            Ask about this
          </button>
        </div>
      )}

      {/* Question Modal */}
      {modalContext && (
        <QuestionModal
          isOpen={isQuestionModalOpen}
          onClose={() => {
            setIsQuestionModalOpen(false);
            setModalContext(null);
          }}
          contextMessage={modalContext.message}
          selectedText={modalContext.selectedText}
          selectionStart={modalContext.selectionStart}
          selectionEnd={modalContext.selectionEnd}
          title={modalContext.title}
        />
      )}

    </div>
  );
});

export default Message;
