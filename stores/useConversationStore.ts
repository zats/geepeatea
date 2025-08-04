import { create } from "zustand";
import { Item } from "@/lib/assistant";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { INITIAL_MESSAGE } from "@/config/constants";

interface ConversationState {
  // Items displayed in the chat
  chatMessages: Item[];
  // Items sent to the Responses API
  conversationItems: any[];
  // Single source of truth for chat state
  chatState: 'idle' | 'waiting_for_assistant' | 'assistant_responding';
  // AbortController for current request
  currentAbortController: AbortController | null;
  // Index of message to replace (for annotation responses)
  messageToReplaceIndex: number | null;

  setChatMessages: (items: Item[]) => void;
  setConversationItems: (messages: any[]) => void;
  addChatMessage: (item: Item) => void;
  addConversationItem: (message: ChatCompletionMessageParam) => void;
  setChatState: (state: 'idle' | 'waiting_for_assistant' | 'assistant_responding') => void;
  deleteChatMessage: (index: number) => void;
  deleteChatMessageAfter: (index: number) => void;
  editChatMessage: (index: number, newText: string) => void;
  setCurrentAbortController: (controller: AbortController | null) => void;
  abortCurrentRequest: () => void;
  replaceLastAssistantMessage: (newText: string) => void;
  createMessageVersion: (messageIndex: number, newContent: Item["content"], source?: "annotation" | "edit", originalContent?: Item["content"]) => void;
  selectMessageVersion: (messageIndex: number, versionId: string) => void;
  getCurrentVersionContent: (messageIndex: number) => Item["content"];
  setMessageToReplaceIndex: (index: number | null) => void;
  clearConversation: () => void;
  rawSet: (state: any) => void;
}

const useConversationStore = create<ConversationState>((set) => ({
  chatMessages: [
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: INITIAL_MESSAGE }],
    },
  ],
  conversationItems: [],
  chatState: 'idle',
  currentAbortController: null,
  messageToReplaceIndex: null,
  setChatMessages: (items) => set({ chatMessages: items }),
  setConversationItems: (messages) => set({ conversationItems: messages }),
  addChatMessage: (item) =>
    set((state) => ({ chatMessages: [...state.chatMessages, item] })),
  addConversationItem: (message) =>
    set((state) => ({
      conversationItems: [...state.conversationItems, message],
    })),
  setChatState: (state) => {
    set({ chatState: state });
  },
  deleteChatMessage: (index) =>
    set((state) => {
      const newChatMessages = [...state.chatMessages];
      const deletedMessage = newChatMessages[index];
      newChatMessages.splice(index, 1);
      
      // Also remove corresponding message from conversationItems if it's a user or assistant message
      let newConversationItems = [...state.conversationItems];
      if (deletedMessage?.type === "message" && (deletedMessage.role === "user" || deletedMessage.role === "assistant")) {
        // Find and remove the corresponding message from conversationItems
        // For user messages, look for exact text match
        // For assistant messages, they might have been converted to simple format
        if (deletedMessage.role === "user") {
          const messageText = deletedMessage.content[0]?.text;
          const conversationIndex = newConversationItems.findIndex(
            (item) => item.role === "user" && item.content === messageText
          );
          if (conversationIndex !== -1) {
            newConversationItems.splice(conversationIndex, 1);
          }
        } else if (deletedMessage.role === "assistant") {
          const messageText = deletedMessage.content[0]?.text;
          const conversationIndex = newConversationItems.findIndex(
            (item) => item.role === "assistant" && item.content === messageText
          );
          if (conversationIndex !== -1) {
            newConversationItems.splice(conversationIndex, 1);
          }
        }
      }
      
      return { 
        chatMessages: newChatMessages,
        conversationItems: newConversationItems
      };
    }),
  deleteChatMessageAfter: (index) =>
    set((state) => {
      const newChatMessages = [...state.chatMessages];
      const messagesToDelete = newChatMessages.slice(index);
      
      // Keep only messages before the selected index
      newChatMessages.splice(index);
      
      // Also remove corresponding messages from conversationItems
      let newConversationItems = [...state.conversationItems];
      
      // For each deleted message, find and remove its corresponding item from conversationItems
      messagesToDelete.forEach((deletedMessage) => {
        if (deletedMessage?.type === "message" && (deletedMessage.role === "user" || deletedMessage.role === "assistant")) {
          if (deletedMessage.role === "user") {
            const messageText = deletedMessage.content[0]?.text;
            const conversationIndex = newConversationItems.findIndex(
              (item) => item.role === "user" && item.content === messageText
            );
            if (conversationIndex !== -1) {
              newConversationItems.splice(conversationIndex, 1);
            }
          } else if (deletedMessage.role === "assistant") {
            const messageText = deletedMessage.content[0]?.text;
            const conversationIndex = newConversationItems.findIndex(
              (item) => item.role === "assistant" && item.content === messageText
            );
            if (conversationIndex !== -1) {
              newConversationItems.splice(conversationIndex, 1);
            }
          }
        }
      });
      
      return { 
        chatMessages: newChatMessages,
        conversationItems: newConversationItems
      };
    }),
  editChatMessage: (index, newText) =>
    set((state) => {
      
      const newChatMessages = [...state.chatMessages];
      const messageToEdit = newChatMessages[index];
      
      if (messageToEdit?.type === "message" && messageToEdit.content[0]) {
        const oldText = messageToEdit.content[0].text;
        
        // Create version structure immediately when editing
        // This preserves the original content before the edit
        if (!messageToEdit.versions) {
          
          // Create original version with the old content
          const originalVersion = {
            id: "original",
            content: [...messageToEdit.content],
            timestamp: Date.now() - 1000,
            source: "original" as const
          };
          
          // Create edited version with new content
          const editedVersion = {
            id: `edit-${Date.now()}`,
            content: [{
              ...messageToEdit.content[0],
              text: newText
            }],
            timestamp: Date.now(),
            source: "edit" as const
          };
          
          
          newChatMessages[index] = {
            ...messageToEdit,
            versions: [originalVersion, editedVersion],
            currentVersionId: editedVersion.id,
            content: [...editedVersion.content]
          };
        } else {
          
          // Versions already exist, just update the current content
          const updatedContent = [{
            ...messageToEdit.content[0],
            text: newText
          }];
          
          newChatMessages[index] = {
            ...messageToEdit,
            content: updatedContent
          };
        }
        
        // Also update corresponding message in conversationItems
        let newConversationItems = [...state.conversationItems];
        if (messageToEdit.role === "user" || messageToEdit.role === "assistant") {
          const conversationIndex = newConversationItems.findIndex(
            (item) => item.role === messageToEdit.role && item.content === oldText
          );
          if (conversationIndex !== -1) {
            newConversationItems[conversationIndex].content = newText;
          }
        }
        
        return { 
          chatMessages: newChatMessages,
          conversationItems: newConversationItems
        };
      }
      
      return state;
    }),
  setCurrentAbortController: (controller) => set({ currentAbortController: controller }),
  abortCurrentRequest: () => {
    const state = useConversationStore.getState();
    if (state.currentAbortController) {
      state.currentAbortController.abort();
      set({ currentAbortController: null, chatState: 'idle' });
    }
  },
  replaceLastAssistantMessage: (newText: string) =>
    set((state) => {
      
      const newChatMessages = [...state.chatMessages];
      const newConversationItems = [...state.conversationItems];
      
      // Find the last assistant message in chatMessages
      const lastAssistantIndex = newChatMessages.findLastIndex(
        (msg) => msg.type === "message" && msg.role === "assistant"
      );
      
      
      if (lastAssistantIndex !== -1) {
        const lastAssistantMessage = newChatMessages[lastAssistantIndex];
        
        
        // Initialize versions if they don't exist
        const existingVersions = lastAssistantMessage.versions || [{
          id: "original",
          content: [...lastAssistantMessage.content],
          timestamp: Date.now() - 1000, // Slightly in the past
          source: "original"
        }];
        
        
        // Create new version with the replacement text
        const newVersionId = `replacement-${Date.now()}`;
        const newVersion = {
          id: newVersionId,
          content: [{
            type: "output_text" as const,
            text: newText
          }],
          timestamp: Date.now(),
          source: "annotation" as const
        };
        
        
        // Create a new message object to ensure React detects the change
        newChatMessages[lastAssistantIndex] = {
          ...lastAssistantMessage,
          versions: [...existingVersions, newVersion],
          currentVersionId: newVersionId,
          content: [...newVersion.content]
        };
        
        // Update conversationItems
        const conversationIndex = newConversationItems.findLastIndex(
          (item) => item.role === "assistant"
        );
        
        if (conversationIndex !== -1) {
          newConversationItems[conversationIndex].content = newText;
        }
      }
      
      return {
        chatMessages: newChatMessages,
        conversationItems: newConversationItems
      };
    }),
  createMessageVersion: (messageIndex, newContent, source = "annotation", originalContent?: Item["content"]) =>
    set((state) => {
      
      const newChatMessages = [...state.chatMessages];
      const message = newChatMessages[messageIndex];
      
      if (message?.type === "message") {
        
        // Initialize versions array if it doesn't exist
        // Use provided originalContent if available, otherwise use current message content
        const contentForOriginal = originalContent || message.content;
        const existingVersions = message.versions || [{
          id: "original",
          content: [...contentForOriginal],
          timestamp: Date.now(),
          source: "original"
        }];
        
        
        // Create new version
        const newVersionId = `${source}-${Date.now()}`;
        const newVersion = {
          id: newVersionId,
          content: [...newContent],
          timestamp: Date.now(),
          source
        };
        
        
        // Create a new message object to ensure React detects the change
        newChatMessages[messageIndex] = {
          ...message,
          versions: [...existingVersions, newVersion],
          currentVersionId: newVersionId,
          content: [...newContent]
        };
        
        
        // Update conversationItems for the new version
        const newConversationItems = [...state.conversationItems];
        if (message.role === "user" || message.role === "assistant") {
          const conversationIndex = newConversationItems.findLastIndex(
            (item) => item.role === message.role
          );
          if (conversationIndex !== -1) {
            const newContent_text = newContent[0]?.text || "";
            newConversationItems[conversationIndex].content = newContent_text;
          } else {
          }
        }
        
        return {
          chatMessages: newChatMessages,
          conversationItems: newConversationItems
        };
      }
      
      return state;
    }),
  selectMessageVersion: (messageIndex, versionId) =>
    set((state) => {
      
      const newChatMessages = [...state.chatMessages];
      const message = newChatMessages[messageIndex];
      
      if (message?.type === "message" && message.versions) {
        
        const selectedVersion = message.versions.find(v => v.id === versionId);
        
        if (selectedVersion) {
          // Create a new message object to ensure React detects the change
          newChatMessages[messageIndex] = {
            ...message,
            currentVersionId: versionId,
            content: [...selectedVersion.content]
          };
          
          
          // Update conversationItems for the selected version
          const newConversationItems = [...state.conversationItems];
          if (message.role === "user" || message.role === "assistant") {
            const conversationIndex = newConversationItems.findLastIndex(
              (item) => item.role === message.role
            );
            if (conversationIndex !== -1) {
              const selectedVersionText = selectedVersion.content[0]?.text || "";
              newConversationItems[conversationIndex].content = selectedVersionText;
            } else {
            }
          }
          
          return {
            chatMessages: newChatMessages,
            conversationItems: newConversationItems
          };
        } else {
        }
      } else {
      }
      
      return state;
    }),
  getCurrentVersionContent: (messageIndex) => {
    const state = useConversationStore.getState();
    const message = state.chatMessages[messageIndex];
    
    if (message?.type === "message") {
      return message.content;
    }
    
    return [];
  },
  setMessageToReplaceIndex: (index) => set({ messageToReplaceIndex: index }),
  clearConversation: () => {
    const state = useConversationStore.getState();
    
    // Abort any in-flight requests
    if (state.currentAbortController) {
      state.currentAbortController.abort();
    }
    
    // Reset to initial state
    set({
      chatMessages: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: INITIAL_MESSAGE }],
        },
      ],
      conversationItems: [],
      chatState: 'idle',
      currentAbortController: null,
      messageToReplaceIndex: null,
    });
  },
  rawSet: set,
}));

export default useConversationStore;
