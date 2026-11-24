# Demo script (3 minutes)

1. **Start**: `npm run dev`, open http://localhost:3000. Point out the badge in the corner: which LLM is talking, and Mirage latency.
2. **Upload**: click **Try a sample** (kitchen). After ~4 s the outlines appear and the fridge, sink and fruit bowl start talking. Words stream in one by one.
3. **Live mode**: click **Live camera**, point at your desk (mug, pen, phone).
   - Wait: each object greets you.
   - **Move the mug**: it complains ("Hey! Who moved me?").
   - **Hide the phone** for two scans: the others gossip about it.
   - **Push two objects together**: friend/rival banter.
4. **Soul Card**: click the mug's bubble or its chip. Show its 3 traits, the mood graph, relationships and memories ("Got moved by the human without asking."). Type "Sorry, mug!" (or use the mic): it answers in character, and its mood goes up.
5. **Voice**: toggle **Voice on**: each object has its own pitch and speed.
6. **Diary**: open **Diary** for the timeline of everything everyone said.
7. **Memory across days**: tomorrow, point at the same mug: it remembers being ignored and is grumpier (tested in `tests/realtime.test.ts`).
8. **Save PNG** to export the scene with bubbles.
9. **Settings**: scan interval, chattiness, voice, which free providers are active, reset data.
