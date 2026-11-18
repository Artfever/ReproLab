# Gemini and Groq live smoke check

Date: 2026-11-18

Keys were loaded by the local server from the ignored root `.env`. No key values, authorization headers, or audio recordings are included in this evidence.

| Check | Result |
| --- | --- |
| Gemini chat status | Enabled; endpoint health check answered. |
| Gemini chat request | Passed. Asked an answerable question about the documented coin example; returned an answer with one citation to `docs/assistant/running.md`. |
| Groq voice status | Enabled with `whisper-large-v3`. |
| Groq transcription request | Passed. Sent a locally synthesized, non-personal phrase (“Please explain the ReproLab run log.”); transcript matched the phrase. The temporary WAV was deleted. |

This is a connectivity and request-format smoke check, not a broad assessment of response quality. The chat answer was citation-checked by ReproLab; the test does not establish factual quality beyond this simple question.
