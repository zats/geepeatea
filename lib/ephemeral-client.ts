import useToolsStore from "@/stores/useToolsStore";

export interface EphemeralQueryOptions {
  query: string;
  context?: string;
}

export const askEphemeralQuery = async ({ query, context }: EphemeralQueryOptions): Promise<string> => {
  try {
    // Get API key from the store
    const { apiKey } = useToolsStore.getState();
    
    if (!apiKey) {
      throw new Error("OpenAI API key is required. Please set it in the settings panel.");
    }

    // Import OpenAI and dependencies dynamically
    const [{ default: OpenAI }, { MODEL }] = await Promise.all([
      import("openai"),
      import("@/config/constants")
    ]);

    // Create OpenAI client instance
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Required for client-side usage
    });

    // Get tools for the ephemeral query (disable for now to avoid type issues)
    const tools: any[] = [];

    // Create messages for ephemeral query
    const messages = [
      {
        type: "message" as const,
        role: "developer" as const,
        content: [
          {
            type: "input_text" as const,
            text: "You are a helpful assistant. Answer the user's question about the provided context concisely and clearly."
          }
        ]
      },
      {
        type: "message" as const, 
        role: "user" as const,
        content: [
          {
            type: "input_text" as const,
            text: context 
              ? `Based on this context: "${context}"\n\nQuestion: ${query}`
              : query
          }
        ]
      }
    ];

    // Call OpenAI Responses API directly (non-streaming)
    const response = await openai.responses.create({
      model: MODEL,
      input: messages,
      tools,
      stream: false,
      parallel_tool_calls: false,
    });

    // Extract text content from response
    const textContent = response.output
      .filter((item: any) => item.type === "message")
      .map((item: any) => item.content?.text || "")
      .join("");

    return textContent;
  } catch (error) {
    console.error("Error in ephemeral query:", error);
    throw error;
  }
};

export const askEphemeralQueryStream = async (
  { query, context }: EphemeralQueryOptions,
  onContent: (content: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> => {
  try {
    // Get API key from the store
    const { apiKey } = useToolsStore.getState();
    
    if (!apiKey) {
      throw new Error("OpenAI API key is required. Please set it in the settings panel.");
    }

    // Import OpenAI and dependencies dynamically
    const [{ default: OpenAI }, { MODEL }] = await Promise.all([
      import("openai"),
      import("@/config/constants")
    ]);

    // Create OpenAI client instance
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Required for client-side usage
    });

    // Get tools for the ephemeral query (disable for now to avoid type issues)
    const tools: any[] = [];

    // Create messages for ephemeral query
    const messages = [
      {
        type: "message" as const,
        role: "developer" as const,
        content: [
          {
            type: "input_text" as const,
            text: "You are a helpful assistant. Answer the user's question about the provided context concisely and clearly."
          }
        ]
      },
      {
        type: "message" as const, 
        role: "user" as const,
        content: [
          {
            type: "input_text" as const,
            text: context 
              ? `Based on this context: "${context}"\n\nQuestion: ${query}`
              : query
          }
        ]
      }
    ];

    // Call OpenAI Responses API directly
    const events = await openai.responses.create({
      model: MODEL,
      input: messages,
      tools,
      stream: true,
      parallel_tool_calls: false,
    });

    // Process the streaming events
    for await (const event of events) {
      // Handle different event types from OpenAI Responses API
      switch (event.type) {
        case "response.output_text.delta":
          const { delta } = event;
          if (typeof delta === "string" && delta) {
            onContent(delta);
          }
          break;
        case "response.completed":
          // Response is complete
          onComplete();
          return;
        // Handle other events as needed (tool calls, etc.)
        default:
          // Ignore other events for now
          break;
      }
    }

    onComplete();
  } catch (error) {
    console.error("Error in ephemeral query stream:", error);
    onError(error instanceof Error ? error : new Error("Unknown error"));
  }
};