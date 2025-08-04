import { DEVELOPER_PROMPT } from "@/config/constants";
import { parse } from "partial-json";
import { handleTool } from "@/lib/tools/tools-handling";
import useConversationStore from "@/stores/useConversationStore";
import { getTools } from "./tools/tools";
import { Annotation } from "@/components/annotations";
import { functionsMap } from "@/config/functions";

const normalizeAnnotation = (annotation: any): Annotation => ({
  ...annotation,
  fileId: annotation.file_id ?? annotation.fileId,
  containerId: annotation.container_id ?? annotation.containerId,
});

export interface ContentItem {
  type: "input_text" | "output_text" | "refusal" | "output_audio";
  annotations?: Annotation[];
  text?: string;
}

export interface MessageVersion {
  id: string;
  content: ContentItem[];
  timestamp: number;
  source?: "original" | "annotation" | "edit"; // Track how this version was created
}

// Message items for storing conversation history matching API shape
export interface MessageItem {
  type: "message";
  role: "user" | "assistant" | "system";
  id?: string;
  content: ContentItem[]; // Current/displayed content
  versions?: MessageVersion[]; // All versions of this message
  currentVersionId?: string; // Which version is currently selected
}

// Custom items to display in chat
export interface ToolCallItem {
  type: "tool_call";
  tool_type:
    | "file_search_call"
    | "web_search_call"
    | "function_call"
    | "mcp_call"
    | "code_interpreter_call";
  status: "in_progress" | "completed" | "failed" | "searching";
  id: string;
  name?: string | null;
  call_id?: string;
  arguments?: string;
  parsedArguments?: any;
  output?: string | null;
  code?: string;
  files?: {
    file_id: string;
    mime_type: string;
    container_id?: string;
    filename?: string;
  }[];
}

export interface McpListToolsItem {
  type: "mcp_list_tools";
  id: string;
  server_label: string;
  tools: { name: string; description?: string }[];
}

export interface McpApprovalRequestItem {
  type: "mcp_approval_request";
  id: string;
  server_label: string;
  name: string;
  arguments?: string;
}

export type Item =
  | MessageItem
  | ToolCallItem
  | McpListToolsItem
  | McpApprovalRequestItem;

export const handleTurn = async (
  messages: any[],
  tools: any[],
  onMessage: (data: any) => void,
  abortController?: AbortController
) => {
  try {
    // Get response from the API (defined in app/api/turn_response/route.ts)
    const response = await fetch("/api/turn_response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages,
        tools: tools,
      }),
      signal: abortController?.signal,
    });

    if (!response.ok) {
      console.error(`Error: ${response.status} - ${response.statusText}`);
      return;
    }

    // Reader for streaming data
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let buffer = "";

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      buffer += chunkValue;

      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6);
          if (dataStr === "[DONE]") {
            done = true;
            break;
          }
          const data = JSON.parse(dataStr);
          onMessage(data);
        }
      }
    }

    // Handle any remaining data in buffer
    if (buffer && buffer.startsWith("data: ")) {
      const dataStr = buffer.slice(6);
      if (dataStr !== "[DONE]") {
        const data = JSON.parse(dataStr);
        onMessage(data);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Request was aborted in handleTurn');
    } else {
      console.error("Error handling turn:", error);
    }
    throw error; // Re-throw so processMessages can handle it
  }
};

export const processMessages = async () => {
  const {
    chatMessages,
    conversationItems,
    setChatMessages,
    setConversationItems,
    setAssistantLoading,
    currentAbortController,
    setCurrentAbortController,
    messageToReplaceIndex,
    setMessageToReplaceIndex,
    createMessageVersion,
  } = useConversationStore.getState();

  // Create new AbortController for this request
  const abortController = new AbortController();
  setCurrentAbortController(abortController);

  const tools = getTools();
  const allConversationItems = [
    // Adding developer prompt as first item in the conversation
    {
      role: "developer",
      content: DEVELOPER_PROMPT,
    },
    ...conversationItems,
  ];
  

  let assistantMessageContent = "";
  let functionArguments = "";
  // For streaming MCP tool call arguments
  let mcpArguments = "";
  
  // Capture original content before replacement (for version creation)
  let originalMessageContent: Item["content"] | null = null;
  if (messageToReplaceIndex !== null && chatMessages[messageToReplaceIndex]) {
    const messageToReplace = chatMessages[messageToReplaceIndex];
    if (messageToReplace.type === "message" && messageToReplace.content) {
      originalMessageContent = [...messageToReplace.content];
    }
  }

  try {
    await handleTurn(allConversationItems, tools, async ({ event, data }) => {
    switch (event) {
      case "response.output_text.delta":
      case "response.output_text.annotation.added": {
        const { delta, item_id, annotation } = data;

        let partial = "";
        if (typeof delta === "string") {
          partial = delta;
        }
        assistantMessageContent += partial;

        // UPDATE CONVERSATIONITEMS WITH EVERY DELTA AND PERSIST TO STORE
        if (assistantMessageContent.trim().length > 0) {
          let updated = false;
          
          if (messageToReplaceIndex !== null) {
            // We're replacing a message, so update the existing conversationItems assistant message
            const assistantConversationIndex = conversationItems.findLastIndex(
              (item) => item.role === "assistant"
            );
            if (assistantConversationIndex !== -1) {
              conversationItems[assistantConversationIndex].content = assistantMessageContent;
              updated = true;
            }
          } else {
            // Normal flow: find existing assistant message or create new one
            const existingAssistantIndex = conversationItems.findLastIndex(
              (item) => item.role === "assistant"
            );
            
            if (existingAssistantIndex !== -1) {
              // Update existing assistant message
              conversationItems[existingAssistantIndex].content = assistantMessageContent;
              updated = true;
            } else {
              // Create new assistant message
              conversationItems.push({
                role: "assistant",
                content: assistantMessageContent,
              });
              updated = true;
            }
          }
          
          // PERSIST THE CHANGES TO THE STORE
          if (updated) {
            setConversationItems([...conversationItems]);
          }
        }

        // Check if we should replace an existing message (for annotations)
        if (messageToReplaceIndex !== null && chatMessages[messageToReplaceIndex]) {
          const messageToReplace = chatMessages[messageToReplaceIndex];
          if (messageToReplace.type === "message") {
            // Just update the content during streaming, don't create versions yet
            messageToReplace.content[0] = {
              type: "output_text",
              text: assistantMessageContent,
            };
          }
        } else {
          // Normal flow: If the last message isn't an assistant message, create a new one
          const lastItem = chatMessages[chatMessages.length - 1];
          if (
            !lastItem ||
            lastItem.type !== "message" ||
            lastItem.role !== "assistant" ||
            (lastItem.id && lastItem.id !== item_id)
          ) {
            chatMessages.push({
              type: "message",
              role: "assistant",
              id: item_id,
              content: [
                {
                  type: "output_text",
                  text: assistantMessageContent,
                },
              ],
            } as MessageItem);
          } else {
            const contentItem = lastItem.content[0];
            if (contentItem && contentItem.type === "output_text") {
              contentItem.text = assistantMessageContent;
              if (annotation) {
                contentItem.annotations = [
                  ...(contentItem.annotations ?? []),
                  normalizeAnnotation(annotation),
                ];
              }
            }
          }
        }

        setChatMessages([...chatMessages]);
        setAssistantLoading(false);
        break;
      }

      case "response.output_item.added": {
        const { item } = data || {};
        // New item coming in
        if (!item || !item.type) {
          break;
        }
        setAssistantLoading(false);
        // Handle differently depending on the item type
        switch (item.type) {
          case "message": {
            const text = item.content?.text || "";
            const annotations =
              item.content?.annotations?.map(normalizeAnnotation) || [];
            chatMessages.push({
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text,
                  ...(annotations.length > 0 ? { annotations } : {}),
                },
              ],
            });
            // Only add to conversationItems when we have actual content
            if (text.trim().length > 0) {
              if (messageToReplaceIndex !== null) {
                // We're replacing a message, so update the existing conversationItems assistant message
                const assistantConversationIndex = conversationItems.findLastIndex(
                  (item) => item.role === "assistant"
                );
                if (assistantConversationIndex !== -1) {
                  conversationItems[assistantConversationIndex].content = text;
                  console.log(`🔄 STREAMING UPDATE [${text.length} chars]: Updated existing assistant message during replacement`);
                } else {
                  console.log(`⚠️ [Assistant] Could not find existing assistant message in conversationItems to update`);
                }
              } else {
                // Normal flow: find existing assistant message or create new one
                const existingAssistantIndex = conversationItems.findLastIndex(
                  (item) => item.role === "assistant"
                );
                
                if (existingAssistantIndex !== -1) {
                  // Update existing assistant message
                  conversationItems[existingAssistantIndex].content = text;
                  console.log(`🔄 STREAMING UPDATE [${text.length} chars]: Updated existing assistant message`);
                } else {
                  // Create new assistant message
                  conversationItems.push({
                    role: "assistant",
                    content: text,
                  });
                  console.log(`✅ STREAMING CREATE [${text.length} chars]: Created new assistant message`);
                }
              }
            }
            setChatMessages([...chatMessages]);
            setConversationItems([...conversationItems]);
            break;
          }
          case "function_call": {
            functionArguments += item.arguments || "";
            chatMessages.push({
              type: "tool_call",
              tool_type: "function_call",
              status: "in_progress",
              id: item.id,
              name: item.name, // function name,e.g. "get_weather"
              arguments: item.arguments || "",
              parsedArguments: {},
              output: null,
            });
            setChatMessages([...chatMessages]);
            break;
          }
          case "web_search_call": {
            chatMessages.push({
              type: "tool_call",
              tool_type: "web_search_call",
              status: item.status || "in_progress",
              id: item.id,
            });
            setChatMessages([...chatMessages]);
            break;
          }
          case "file_search_call": {
            chatMessages.push({
              type: "tool_call",
              tool_type: "file_search_call",
              status: item.status || "in_progress",
              id: item.id,
            });
            setChatMessages([...chatMessages]);
            break;
          }
          case "mcp_call": {
            mcpArguments = item.arguments || "";
            chatMessages.push({
              type: "tool_call",
              tool_type: "mcp_call",
              status: "in_progress",
              id: item.id,
              name: item.name,
              arguments: item.arguments || "",
              parsedArguments: item.arguments ? parse(item.arguments) : {},
              output: null,
            });
            setChatMessages([...chatMessages]);
            break;
          }
          case "code_interpreter_call": {
            chatMessages.push({
              type: "tool_call",
              tool_type: "code_interpreter_call",
              status: item.status || "in_progress",
              id: item.id,
              code: "",
              files: [],
            });
            setChatMessages([...chatMessages]);
            break;
          }
        }
        break;
      }

      case "response.output_item.done": {
        // After output item is done, adding tool call ID
        const { item } = data || {};
        const toolCallMessage = chatMessages.find((m) => m.id === item.id);
        if (toolCallMessage && toolCallMessage.type === "tool_call") {
          toolCallMessage.call_id = item.call_id;
          setChatMessages([...chatMessages]);
        }
        // Only push tool call output items to conversationItems
        // Filter out message, reasoning, and internal tool call items
        const allowedTypes = ["function_call_output", "mcp_call_output"];
        if (allowedTypes.includes(item.type)) {
          conversationItems.push(item);
          setConversationItems([...conversationItems]);
        }
        if (
          toolCallMessage &&
          toolCallMessage.type === "tool_call" &&
          toolCallMessage.tool_type === "function_call"
        ) {
          // Handle tool call (execute function)
          const toolResult = await handleTool(
            toolCallMessage.name as keyof typeof functionsMap,
            toolCallMessage.parsedArguments
          );

          // Record tool output
          toolCallMessage.output = JSON.stringify(toolResult);
          setChatMessages([...chatMessages]);
          const toolOutputItem = {
            type: "function_call_output",
            call_id: toolCallMessage.call_id,
            status: "completed",
            output: JSON.stringify(toolResult),
          };
          conversationItems.push(toolOutputItem);
          setConversationItems([...conversationItems]);

          // Create another turn after tool output has been added
          await processMessages();
        }
        if (
          toolCallMessage &&
          toolCallMessage.type === "tool_call" &&
          toolCallMessage.tool_type === "mcp_call"
        ) {
          toolCallMessage.output = item.output;
          toolCallMessage.status = "completed";
          setChatMessages([...chatMessages]);
        }
        break;
      }

      case "response.function_call_arguments.delta": {
        // Streaming arguments delta to show in the chat
        functionArguments += data.delta || "";
        let parsedFunctionArguments = {};

        const toolCallMessage = chatMessages.find((m) => m.id === data.item_id);
        if (toolCallMessage && toolCallMessage.type === "tool_call") {
          toolCallMessage.arguments = functionArguments;
          try {
            if (functionArguments.length > 0) {
              parsedFunctionArguments = parse(functionArguments);
            }
            toolCallMessage.parsedArguments = parsedFunctionArguments;
          } catch {
            // partial JSON can fail parse; ignore
          }
          setChatMessages([...chatMessages]);
        }
        break;
      }

      case "response.function_call_arguments.done": {
        // This has the full final arguments string
        const { item_id, arguments: finalArgs } = data;

        functionArguments = finalArgs;

        // Mark the tool_call as "completed" and parse the final JSON
        const toolCallMessage = chatMessages.find((m) => m.id === item_id);
        if (toolCallMessage && toolCallMessage.type === "tool_call") {
          toolCallMessage.arguments = finalArgs;
          toolCallMessage.parsedArguments = parse(finalArgs);
          toolCallMessage.status = "completed";
          setChatMessages([...chatMessages]);
        }
        break;
      }
      // Streaming MCP tool call arguments
      case "response.mcp_call_arguments.delta": {
        // Append delta to MCP arguments
        mcpArguments += data.delta || "";
        let parsedMcpArguments: any = {};
        const toolCallMessage = chatMessages.find((m) => m.id === data.item_id);
        if (toolCallMessage && toolCallMessage.type === "tool_call") {
          toolCallMessage.arguments = mcpArguments;
          try {
            if (mcpArguments.length > 0) {
              parsedMcpArguments = parse(mcpArguments);
            }
            toolCallMessage.parsedArguments = parsedMcpArguments;
          } catch {
            // partial JSON can fail parse; ignore
          }
          setChatMessages([...chatMessages]);
        }
        break;
      }
      case "response.mcp_call_arguments.done": {
        // Final MCP arguments string received
        const { item_id, arguments: finalArgs } = data;
        mcpArguments = finalArgs;
        const toolCallMessage = chatMessages.find((m) => m.id === item_id);
        if (toolCallMessage && toolCallMessage.type === "tool_call") {
          toolCallMessage.arguments = finalArgs;
          toolCallMessage.parsedArguments = parse(finalArgs);
          toolCallMessage.status = "completed";
          setChatMessages([...chatMessages]);
        }
        break;
      }

      case "response.web_search_call.completed": {
        const { item_id, output } = data;
        const toolCallMessage = chatMessages.find((m) => m.id === item_id);
        if (toolCallMessage && toolCallMessage.type === "tool_call") {
          toolCallMessage.output = output;
          toolCallMessage.status = "completed";
          setChatMessages([...chatMessages]);
        }
        break;
      }

      case "response.file_search_call.completed": {
        const { item_id, output } = data;
        const toolCallMessage = chatMessages.find((m) => m.id === item_id);
        if (toolCallMessage && toolCallMessage.type === "tool_call") {
          toolCallMessage.output = output;
          toolCallMessage.status = "completed";
          setChatMessages([...chatMessages]);
        }
        break;
      }

      case "response.code_interpreter_call_code.delta": {
        const { delta, item_id } = data;
        const toolCallMessage = [...chatMessages]
          .reverse()
          .find(
            (m) =>
              m.type === "tool_call" &&
              m.tool_type === "code_interpreter_call" &&
              m.status !== "completed" &&
              m.id === item_id
          ) as ToolCallItem | undefined;
        // Accumulate deltas to show the code streaming
        if (toolCallMessage) {
          toolCallMessage.code = (toolCallMessage.code || "") + delta;
          setChatMessages([...chatMessages]);
        }
        break;
      }

      case "response.code_interpreter_call_code.done": {
        const { code, item_id } = data;
        const toolCallMessage = [...chatMessages]
          .reverse()
          .find(
            (m) =>
              m.type === "tool_call" &&
              m.tool_type === "code_interpreter_call" &&
              m.status !== "completed" &&
              m.id === item_id
          ) as ToolCallItem | undefined;

        // Mark the call as completed and set the code
        if (toolCallMessage) {
          toolCallMessage.code = code;
          toolCallMessage.status = "completed";
          setChatMessages([...chatMessages]);
        }
        break;
      }

      case "response.code_interpreter_call.completed": {
        const { item_id } = data;
        const toolCallMessage = chatMessages.find(
          (m) => m.type === "tool_call" && m.id === item_id
        ) as ToolCallItem | undefined;
        if (toolCallMessage) {
          toolCallMessage.status = "completed";
          setChatMessages([...chatMessages]);
        }
        break;
      }

      case "response.completed": {
        console.log("response completed", data);
        const { response } = data;

        // If we were replacing a message (for annotations), create the version now
        if (messageToReplaceIndex !== null && chatMessages[messageToReplaceIndex]) {
          const messageToReplace = chatMessages[messageToReplaceIndex];
          if (messageToReplace.type === "message" && messageToReplace.content[0]) {
            // Create a new version with the final content
            const finalContent = [{
              type: "output_text" as const,
              text: messageToReplace.content[0].text || "",
            }];
            
            createMessageVersion(messageToReplaceIndex, finalContent, "annotation", originalMessageContent || undefined);
            // Clear the replace index
            setMessageToReplaceIndex(null);
          }
        }
        // Don't create versions during normal streaming - only for annotations

        // Handle MCP tools list
        const mcpListToolsMessage = response.output.find(
          (m: Item) => m.type === "mcp_list_tools"
        );

        if (mcpListToolsMessage) {
          chatMessages.push({
            type: "mcp_list_tools",
            id: mcpListToolsMessage.id,
            server_label: mcpListToolsMessage.server_label,
            tools: mcpListToolsMessage.tools || [],
          });
          setChatMessages([...chatMessages]);
        }

        // Handle MCP approval request
        const mcpApprovalRequestMessage = response.output.find(
          (m: Item) => m.type === "mcp_approval_request"
        );

        if (mcpApprovalRequestMessage) {
          chatMessages.push({
            type: "mcp_approval_request",
            id: mcpApprovalRequestMessage.id,
            server_label: mcpApprovalRequestMessage.server_label,
            name: mcpApprovalRequestMessage.name,
            arguments: mcpApprovalRequestMessage.arguments,
          });
          setChatMessages([...chatMessages]);
        }

        break;
      }

      // Handle other events as needed
    }
    }, abortController);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Request was aborted');
      setAssistantLoading(false);
    } else {
      console.error('Error in processMessages:', error);
      setAssistantLoading(false);
    }
  } finally {
    // Clear the abort controller when done
    if (currentAbortController === abortController) {
      setCurrentAbortController(null);
    }
  }
};
