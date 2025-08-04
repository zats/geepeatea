import { MODEL } from "@/config/constants";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getTools } from "@/lib/tools/tools";

export async function POST(request: Request) {
  try {
    const { query, context, apiKey } = await request.json();
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is required. Please set it in the settings panel." },
        { status: 400 }
      );
    }

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Create OpenAI client instance - same as main conversation flow
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Get the same tools as main conversation
    const tools = getTools();

    // Create messages in the same format as main conversation
    const messages = [
      {
        role: "developer",
        content: "You are a helpful assistant. Answer the user's question about the provided context concisely and clearly."
      },
      {
        role: "user",
        content: context 
          ? `Based on this context: "${context}"\n\nQuestion: ${query}`
          : query
      }
    ];

    // Use OpenAI Responses API - same as main conversation flow
    const events = await openai.responses.create({
      model: MODEL,
      input: messages,
      tools,
      stream: true,
      parallel_tool_calls: false,
    });

    // Create a ReadableStream that emits SSE data - same format as main conversation
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of events) {
            // Sending all events to the client - same format as main conversation
            const data = JSON.stringify({
              event: event.type,
              data: event,
            });
            controller.enqueue(`data: ${data}\n\n`);
          }
          // End of stream
          controller.close();
        } catch (error) {
          console.error("Error in streaming loop:", error);
          controller.error(error);
        }
      },
    });

    // Return the ReadableStream as SSE - same as main conversation
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Error in ephemeral query:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}