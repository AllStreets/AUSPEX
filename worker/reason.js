// Optional LLM reasoning pass. Degrades gracefully — returns events unchanged if no key.
export async function runReasoningPass(events, llmApiKey = null) {
  if (!llmApiKey) return events; // keyless degrade; Plan 2 enriches briefs here
  return events;
}
