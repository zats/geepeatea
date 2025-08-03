import { MessageItem } from "@/lib/assistant";
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import useConversationStore from "@/stores/useConversationStore";

interface MessageProps {
  message: MessageItem;
  messageIndex: number;
}

const Message: React.FC<MessageProps> = ({ message, messageIndex }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
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

  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);
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
              className={`mr-4 md:mr-24 rounded-[16px] px-4 py-2 bg-white border border-gray-200 text-black font-light cursor-pointer ${isEditing ? 'relative' : ''}`}
              onContextMenu={handleContextMenu}
            >
              <div className={isEditing ? 'opacity-0' : '' + ' whitespace-pre-wrap'}>
                {message.content[0].text as string}
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
    </div>
  );
};

export default Message;
