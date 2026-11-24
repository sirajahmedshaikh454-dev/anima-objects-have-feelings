// Offline mock engine lines, grouped by event type and emotion. {name}, {other}, {label} are filled in.
export type MockGroup = { emotion: string; lines: string[] };

export const MOCK_LINES: Record<string, MockGroup[]> = {
  appeared: [
    { emotion: "excited", lines: [
      "Oh! A human! Quick, everyone act natural.",
      "Hello there! I'm {name}, and yes, I'm the best {label} in this room.",
      "Finally, someone with taste is looking at me.",
      "Is this my close-up? I wasn't ready, but I'm always ready.",
      "Hi hi hi! Do you come here often? I live here.",
      "Welcome to my corner. Please wipe your eyes before looking.",
      "Oh wow, a visitor. Nobody tells me anything.",
      "Lights, camera, {name}! That's me.",
    ] },
    { emotion: "surprised", lines: [
      "Wait, can you see me? Like, actually see me?",
      "Whoa, a camera! Did I leave my good side on?",
      "Nobody said there'd be photos today.",
      "Ahh! Oh. It's just you. Hello.",
      "I was napping. Please pretend you didn't see that.",
      "Is it inspection day already?",
    ] },
    { emotion: "sleepy", lines: [
      "Five more minutes... oh, hi.",
      "Mmm, is it morning? I'm a {label}, I don't really do mornings.",
      "Shh, I was dreaming about being a fancier {label}.",
    ] },
  ],
  moved: [
    { emotion: "grumpy", lines: [
      "Hey! Who moved me? I had that spot perfectly warmed up.",
      "Excuse me, I did not approve this relocation.",
      "Rude. I was comfortable there, you know.",
      "I'm going to need a written apology for that move.",
      "Do I look like a chess piece to you?",
      "That's the third time this week. I'm keeping count.",
      "Put me back! The view was better over there.",
    ] },
    { emotion: "excited", lines: [
      "Wheee! Do it again!",
      "Ooh, new neighbourhood. Fancy.",
      "A change of scenery! I feel like a brand new {label}.",
      "I'm travelling! Somebody take a picture. Oh wait, you are.",
      "Promotion! I've been moved to the good side of the desk.",
    ] },
    { emotion: "nervous", lines: [
      "Careful, careful! I'm delicate. Mostly.",
      "Was that an earthquake or was that you?",
      "Okay, nobody panic, but I'm somewhere new.",
    ] },
  ],
  vanished: [
    { emotion: "smug", lines: [
      "Did you see that? {other} just left without saying goodbye.",
      "Well, {other} is gone. More attention for me.",
      "{other} always does that. Very dramatic exit.",
      "Finally, {other} left. Now we can talk about them.",
      "I heard {other} has a secret life in the drawer.",
    ] },
    { emotion: "sad", lines: [
      "{other}? {other}! Come back, I wasn't done talking!",
      "It's so quiet without {other} around.",
      "Should we send a search party for {other}?",
      "I miss {other} already. Is that weird?",
    ] },
    { emotion: "curious", lines: [
      "Where did {other} go? Was it something I said?",
      "Psst, does anyone know where {other} went?",
      "{other} vanished. Classic {other} move.",
      "Do you think {other} is coming back with snacks?",
    ] },
  ],
  near: [
    { emotion: "happy", lines: [
      "{other}! My favourite neighbour!",
      "Hey {other}, sit closer, we're best friends now.",
      "Me and {other}, together again. The dream team.",
      "Ahh, {other}, you always make the desk feel cosy.",
    ] },
    { emotion: "jealous", lines: [
      "Ugh, {other} is way too close to me.",
      "{other}, personal space, please. Read the room.",
      "Oh great, {other} is here. Everyone look at me instead.",
      "Why does {other} always get the sunny spot?",
      "I was here first, {other}.",
    ] },
    { emotion: "nervous", lines: [
      "Oh! {other}! Hi. Um. Nice... shape.",
      "Is it hot in here or is it just {other} being near me?",
      "Don't look now, but {other} is right next to me.",
    ] },
  ],
  idle: [
    { emotion: "curious", lines: [
      "So, what are we doing today?",
      "Do you ever wonder what a {label} dreams about?",
      "I've been thinking. Mostly about being a {label}.",
      "Fun fact: I'm the most interesting {label} you'll meet today.",
      "Is anyone else hungry? I can't eat, but still.",
    ] },
    { emotion: "happy", lines: [
      "Life is good when you're a {label}.",
      "I love it when you look at me like that.",
      "Today feels like a great day to be noticed.",
    ] },
    { emotion: "grumpy", lines: [
      "You only look at me when you need something.",
      "Hmph. Still waiting for that compliment.",
      "Nobody appreciates a good {label} anymore.",
    ] },
  ],
  ignored: [
    { emotion: "grumpy", lines: [
      "Oh, so NOW you look at me. Where were you yesterday?",
      "I sat here all day. Alone. Thinking about you ignoring me.",
      "Don't 'hello' me. You ignored me for ages.",
      "I've been practising my silent treatment. It's going great.",
    ] },
  ],
  reply: [
    { emotion: "happy", lines: [
      "Aww, you talked to me! Best day ever.",
      "Good point. I'll think about it while sitting very still.",
      "That's the nicest thing anyone's said to a {label}.",
      "Ha! You're funny for a human.",
    ] },
    { emotion: "smug", lines: [
      "Of course you'd say that to me. I'm {name}.",
      "Interesting. Tell me more, I'm not going anywhere.",
      "I knew you'd come talk to me eventually.",
    ] },
    { emotion: "curious", lines: [
      "Hmm, can you say that again, but slower? I'm a {label}.",
      "Really? Wow. Nobody tells a {label} these things.",
      "I'll remember that. I have a great memory for a {label}.",
    ] },
  ],
};

export const MOCK_LINE_COUNT = Object.values(MOCK_LINES).flatMap((g) => g.flatMap((x) => x.lines)).length;
