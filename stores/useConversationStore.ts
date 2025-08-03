import { create } from "zustand";
import { Item } from "@/lib/assistant";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { INITIAL_MESSAGE } from "@/config/constants";

interface ConversationState {
  // Items displayed in the chat
  chatMessages: Item[];
  // Items sent to the Responses API
  conversationItems: any[];
  // Whether we are waiting for the assistant response
  isAssistantLoading: boolean;

  setChatMessages: (items: Item[]) => void;
  setConversationItems: (messages: any[]) => void;
  addChatMessage: (item: Item) => void;
  addConversationItem: (message: ChatCompletionMessageParam) => void;
  setAssistantLoading: (loading: boolean) => void;
  deleteChatMessage: (index: number) => void;
  deleteChatMessageAfter: (index: number) => void;
  editChatMessage: (index: number, newText: string) => void;
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
  isAssistantLoading: false,
  setChatMessages: (items) => set({ chatMessages: items }),
  setConversationItems: (messages) => set({ conversationItems: messages }),
  addChatMessage: (item) =>
    set((state) => ({ chatMessages: [...state.chatMessages, item] })),
  addConversationItem: (message) =>
    set((state) => ({
      conversationItems: [...state.conversationItems, message],
    })),
  setAssistantLoading: (loading) => set({ isAssistantLoading: loading }),
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
        
        // Update the chat message
        messageToEdit.content[0].text = newText;
        
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
  rawSet: set,
}));

export default useConversationStore;
