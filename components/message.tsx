import { MessageItem } from "@/lib/assistant";
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import useConversationStore from "@/stores/useConversationStore";

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

const Message: React.FC<MessageProps> = ({ message, messageIndex, onAnnotationsChange }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [annotationMenu, setAnnotationMenu] = useState<{ x: number; y: number } | null>(null);
  const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);
  const [annotationComment, setAnnotationComment] = useState("");
  const messageRef = useRef<HTMLDivElement>(null);
  const messageDomRef = useRef<HTMLDivElement>(null);
  const { deleteChatMessage, deleteChatMessageAfter, editChatMessage } = useConversationStore();

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleDeleteMessage = () => {
    deleteChatMessage(messageIndex);
    setContextMenu(null);
  };

  const handleDeleteAfter = () => {
    deleteChatMessageAfter(messageIndex);
    setContextMenu(null);
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

  const handleTextSelection = () => {
    if (message.role !== "assistant") return;
    
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

    // Calculate selection indices relative to the message text
    const fullText = message.content[0].text as string;
    const startIndex = getTextIndex(messageElement, range.startContainer, range.startOffset);
    const endIndex = startIndex + selectedText.length;

    setSelectedText(selectedText);
    setSelectionRange({ start: startIndex, end: endIndex });

    // Position the annotation menu near the selection
    const rect = range.getBoundingClientRect();
    setAnnotationMenu({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 5
    });
  };

  const getTextIndex = (parent: Element, node: Node, offset: number): number => {
    let textIndex = 0;
    const walker = document.createTreeWalker(
      parent,
      NodeFilter.SHOW_TEXT,
      null,
    );

    let currentNode;
    while (currentNode = walker.nextNode()) {
      if (currentNode === node) {
        return textIndex + offset;
      }
      textIndex += currentNode.textContent?.length || 0;
    }
    return textIndex;
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
    
    let result: React.ReactNode[] = [];
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
          className="bg-yellow-200 relative cursor-pointer inline"
          title={annotation.comment || "Click to edit annotation"}
          onClick={(e) => {
            e.stopPropagation();
            if (annotation.comment && activeAnnotation !== annotation.id) {
              handleEditAnnotation(annotation.id);
            }
          }}
        >
          {text.slice(annotation.startIndex, annotation.endIndex)}
          {/* Show inline input if this annotation is being actively edited */}
          {activeAnnotation === annotation.id ? (
            <div data-annotation-input className="absolute top-full left-0 mt-1 bg-yellow-100 border border-yellow-300 rounded p-2 text-sm min-w-[200px] max-w-64 z-20 shadow-lg">
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
            /* Show completed annotation tooltip */
            <div className="absolute top-full left-0 mt-1 bg-yellow-100 border border-yellow-300 rounded p-2 text-xs max-w-48 z-10 shadow-lg relative">
              {annotation.comment}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteAnnotation(annotation.id);
                }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-gray-500 hover:bg-gray-600 rounded-full flex items-center justify-center text-white text-xs font-bold"
              >
                ×
              </button>
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
  React.useImperativeHandle(messageRef, () => ({
    clearAnnotations: () => setAnnotations([])
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          
          {/* Separator */}
          <div className="border-t border-gray-200 my-1"></div>
          
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
            onClick={handleDeleteMessage}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete message
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
            onClick={handleDeleteAfter}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16M12 11l4 4-4 4" />
            </svg>
            Delete after this
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            Annotate
          </button>
        </div>
      )}

    </div>
  );
};

export default Message;
