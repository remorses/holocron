---
'@holocron.so/vite': patch
---

Fix AI chat answers that never arrived.

Assistant text is buffered and rendered as one markdown block, so a stream that
ended without a `text-end` chunk (provider hiccup, dropped connection) silently
discarded the whole answer and left an empty bubble. The buffer is now always
flushed when the stream ends.

Also fixed in the same path:

- Provider failures are shown instead of swallowed. The AI SDK reports them as
  `error` chunks rather than throwing, and those chunks were ignored.
- Error notices are no longer hidden behind the "Temporary AI model" advisory,
  which used to suppress every later notice in the conversation. Notices now
  carry a `display` policy: standing advisories show once, per-turn outcomes
  (rate limits, credit limits, errors) show every time.
- Reasoning output is kept and rendered as a collapsed "thinking" preview, so a
  turn whose answer lands in reasoning is still visible.
- Scratchpad tags some models emit (`<think>`, `<thinking>`, …) are rendered
  as nothing instead of taking the surrounding answer down with them.
- A turn that produces nothing renderable now says so instead of showing an
  empty message, and exhausting the client-tool round limit reports a clear
  error instead of stopping without an answer.
- Every chat turn logs a one-line outcome (`[holocron:chat] turn …`) with text
  size, tool calls and timings, so lost answers are visible in worker logs.
</content>
