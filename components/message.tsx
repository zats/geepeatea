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
  const { deleteChatMessage, deleteChatMessageAfter } = useConversationStore();

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
              className="ml-4 rounded-[16px] px-4 py-2 md:ml-24 bg-[#ededed] text-stone-900  font-light cursor-pointer"
              onContextMenu={handleContextMenu}
            >
              <div>
                <div>
                  <ReactMarkdown>
                    {message.content[0].text as string}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="flex">
            <div 
              className="mr-4 rounded-[16px] px-4 py-2 md:mr-24 text-black bg-white font-light cursor-pointer"
              onContextMenu={handleContextMenu}
            >
              <div>
                <ReactMarkdown>
                  {message.content[0].text as string}
                </ReactMarkdown>
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
