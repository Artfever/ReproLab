// Optional Groq speech-to-text path. Audio is forwarded only after the user records and submits it.
export const GROQ_TRANSCRIPT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
export const DEFAULT_STT_MODEL = 'whisper-large-v3';
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const TRANSCRIPTION_TIMEOUT_MS = 60_000;
export const TRANSCRIPTION_MAX_RESPONSE_BYTES = 64 * 1024;

const AUDIO_TYPES = new Set([
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac',
]);

export function readTranscriptionConfig(env = process.env) {
  const model = typeof env.STT_MODEL === 'string' && env.STT_MODEL.trim()
    ? env.STT_MODEL.trim()
    : DEFAULT_STT_MODEL;
  const rawKey = env.GROQ_API_KEY;
  if (typeof rawKey !== 'string' || rawKey.trim() === '') {
    return { ok: false, reason: 'Groq voice transcription is not configured' };
  }
  const apiKey = rawKey.trim();
  if (apiKey.length > 4096 || !/^[\x21-\x7E]+$/.test(apiKey)) {
    return { ok: false, reason: 'The Groq API key setting is not valid' };
  }
  if (model.length > 200 || !/^[\x20-\x7E]+$/.test(model)) {
    return { ok: false, reason: 'The speech-to-text model name is not valid' };
  }
  return { ok: true, model, apiKey };
}

/** Parse exactly one file field from a bounded browser multipart upload. */
export function parseAudioUpload(body, contentType) {
  if (!Buffer.isBuffer(body)) return { ok: false, status: 400, message: 'No audio recording was received.' };
  if (body.length > MAX_AUDIO_BYTES + 16 * 1024) {
    return { ok: false, status: 413, message: 'The recording is larger than 25 MiB.' };
  }
  const match = typeof contentType === 'string'
    ? /^multipart\/form-data\s*;\s*boundary=(?:"([\w'()+,./:=?-]{1,70})"|([\w'()+,./:=?-]{1,70}))(?:\s*;.*)?$/i.exec(contentType)
    : null;
  const boundaryText = match?.[1] ?? match?.[2];
  if (!boundaryText) return { ok: false, status: 400, message: 'The audio upload format is not valid.' };

  const marker = Buffer.from(`--${boundaryText}`, 'ascii');
  const headerBreak = Buffer.from('\r\n\r\n', 'ascii');
  if (!body.subarray(0, marker.length + 2).equals(Buffer.concat([marker, Buffer.from('\r\n')]))) {
    return { ok: false, status: 400, message: 'The audio upload format is not valid.' };
  }
  const headersAt = marker.length + 2;
  const headerEnd = body.indexOf(headerBreak, headersAt);
  if (headerEnd < 0 || headerEnd - headersAt > 4096) {
    return { ok: false, status: 400, message: 'The audio upload format is not valid.' };
  }
  const headers = body.subarray(headersAt, headerEnd).toString('latin1');
  const disposition = /^content-disposition:\s*form-data;\s*name="file";\s*filename="[A-Za-z0-9._-]{1,80}"\s*$/im.test(headers);
  const type = /^content-type:\s*([^\r\n]+)\s*$/im.exec(headers)?.[1]?.trim().toLowerCase().split(';')[0].trim();
  if (!disposition || !type || !AUDIO_TYPES.has(type)) {
    return { ok: false, status: 400, message: 'Choose a supported audio recording and try again.' };
  }
  const dataStart = headerEnd + headerBreak.length;
  const closing = Buffer.from(`\r\n--${boundaryText}--`, 'ascii');
  const dataEnd = body.lastIndexOf(closing);
  if (dataEnd < dataStart) return { ok: false, status: 400, message: 'The audio upload format is not valid.' };
  const audio = body.subarray(dataStart, dataEnd);
  if (audio.length === 0) return { ok: false, status: 400, message: 'The recording is empty. Record a short question and try again.' };
  if (audio.length > MAX_AUDIO_BYTES) return { ok: false, status: 413, message: 'The recording is larger than 25 MiB.' };
  return { ok: true, audio, contentType: type };
}

export async function transcribeAudio(upload, config, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? GROQ_TRANSCRIPT_URL;
  const form = new FormData();
  const extension = ({ 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/flac': 'flac' })[upload.contentType] ?? 'audio';
  form.append('file', new Blob([upload.audio], { type: upload.contentType }), `voice.${extension}`);
  form.append('model', config.model);
  form.append('response_format', 'json');
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json' },
      body: form,
      signal: AbortSignal.timeout(options.timeoutMs ?? TRANSCRIPTION_TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, class: error?.name === 'TimeoutError' ? 'timeout' : 'unreachable', message: error?.name === 'TimeoutError' ? 'Groq did not finish transcribing within one minute.' : 'Groq could not be reached. Check your connection and try again.' };
  }
  let text;
  try {
    text = await response.text();
  } catch {
    return { ok: false, class: 'malformed', message: 'Groq returned an unreadable transcription response.' };
  }
  if (text.length > TRANSCRIPTION_MAX_RESPONSE_BYTES) {
    return { ok: false, class: 'malformed', message: 'Groq returned an oversized transcription response.' };
  }
  if (!response.ok) {
    return { ok: false, class: 'bad_status', message: `Groq answered with HTTP status ${response.status}. Check the API key and model setting.` };
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch {
    return { ok: false, class: 'malformed', message: 'Groq returned an invalid transcription response.' };
  }
  if (typeof parsed?.text !== 'string' || parsed.text.trim() === '') {
    return { ok: false, class: 'malformed', message: 'No speech was recognized. Try a clearer or longer recording.' };
  }
  return { ok: true, text: parsed.text.trim() };
}
