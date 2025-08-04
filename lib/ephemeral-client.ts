import useToolsStore from "@/stores/useToolsStore";

export interface EphemeralQueryOptions {
  query: string;
  context?: string;
}

export const askEphemeralQuery = async ({ query, context }: EphemeralQueryOptions): Promise<string> => {
  try {
    // Get API key from the store
    const { apiKey } = useToolsStore.getState();
    
    const response = await fetch("/api/ephemeral_query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        context,
        apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    return data.response;
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
    
    const response = await fetch("/api/ephemeral_query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        context,
        apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

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
          try {
            const eventData = JSON.parse(dataStr);
            const { event, data } = eventData;
            
            // Handle different event types from OpenAI Responses API
            switch (event) {
              case "response.output_text.delta":
                const { delta } = data;
                if (typeof delta === "string" && delta) {
                  onContent(delta);
                }
                break;
              case "response.completed":
                // Response is complete
                done = true;
                break;
              // Handle other events as needed (tool calls, etc.)
              default:
                // Ignore other events for now
                break;
            }
          } catch (e) {
            console.error("Error parsing stream data:", e);
          }
        }
      }
    }

    onComplete();
  } catch (error) {
    console.error("Error in ephemeral query stream:", error);
    onError(error instanceof Error ? error : new Error("Unknown error"));
  }
};