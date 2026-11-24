export type Send = (event: string, data: unknown) => void;

/** Server-Sent Events response around an async producer. Errors become an "error" event. */
export function sseResponse(produce: (send: Send) => Promise<void>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send: Send = (event, data) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        await produce(send);
      } catch (e) {
        send("error", { message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}

/** Browser-side reader for a POSTed SSE response (EventSource only supports GET). */
export async function readSSE(res: Response, onEvent: (event: string, data: unknown) => void) {
  if (!res.body) return;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const p of parts) {
      const event = /^event: (.*)$/m.exec(p)?.[1] ?? "message";
      const data = /^data: (.*)$/m.exec(p)?.[1];
      if (data !== undefined) onEvent(event, JSON.parse(data));
    }
  }
}
