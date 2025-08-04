"use client";
import React from "react";
import Chat from "./chat";
import useConversationStore from "@/stores/useConversationStore";
import { Item, processMessages } from "@/lib/assistant";

export default function Assistant() {
  const { chatMessages, addConversationItem, addChatMessage, setAssistantLoading, abortCurrentRequest, setMessageToReplaceIndex } =
    useConversationStore();

  const handleSendMessage = async (message: string, annotatedMessageIndex?: number) => {
    if (!message.trim()) return;

    // Abort any current request before starting a new one
    abortCurrentRequest();

    // Check if this message contains annotation requests
    const isAnnotationRequest = annotatedMessageIndex !== undefined;

    const userItem: Item = {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: message.trim() }],
      isAnnotationRequest,
    };
    const userMessage: any = {
      role: "user",
      content: message.trim(),
    };

    try {
      setAssistantLoading(true);
      
      // If annotations exist, set the message to replace
      if (annotatedMessageIndex !== undefined) {
        setMessageToReplaceIndex(annotatedMessageIndex);
      } else {
        setMessageToReplaceIndex(null);
      }
      
      // Log store state after setting
      const currentState = useConversationStore.getState();
      
      // For annotation requests, temporarily add to conversationItems for processing
      if (isAnnotationRequest) {
        addConversationItem(userMessage);
        addChatMessage(userItem);
        await processMessages();
        // Remove the annotation request from conversationItems after processing
        const { conversationItems, setConversationItems } = useConversationStore.getState();
        const filteredItems = conversationItems.filter((_, index) => index !== conversationItems.length - 1);
        setConversationItems(filteredItems);
      } else {
        // Normal message flow
        addConversationItem(userMessage);
        addChatMessage(userItem);
        await processMessages();
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  };

  const handleApprovalResponse = async (
    approve: boolean,
    id: string
  ) => {
    const approvalItem = {
      type: "mcp_approval_response",
      approve,
      approval_request_id: id,
    } as any;
    try {
      setAssistantLoading(true);
      addConversationItem(approvalItem);
      await processMessages();
    } catch (error) {
      console.error("Error sending approval response:", error);
    }
  };

  return (
    <div className="h-full p-4 w-full bg-white">
      <Chat
        items={chatMessages}
        onSendMessage={handleSendMessage}
        onApprovalResponse={handleApprovalResponse}
      />
    </div>
  );
}
