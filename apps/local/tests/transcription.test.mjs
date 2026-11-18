import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STT_MODEL, MAX_AUDIO_BYTES, parseAudioUpload, readTranscriptionConfig, transcribeAudio,
} from '../assistant/transcription.mjs';
import { createServer } from '../src/server.mjs';

const KEY = 'gsk-test-secret';
const BOUNDARY = 'reprolab-test-boundary';

function multipart(audio = Buffer.from('fake-audio')) {
  return Buffer.concat([
    Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="voice.webm"\r\nContent-Type: audio/webm\r\n\r\n`),
    audio,
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ]);
}

test('voice configuration defaults to Groq Whisper v3 and keeps missing key disabled', () => {
  assert.equal(readTranscriptionConfig({}).ok, false);
  assert.deepEqual(readTranscriptionConfig({ GROQ_API_KEY: KEY }), { ok: true, model: DEFAULT_STT_MODEL, apiKey: KEY });
  assert.equal(readTranscriptionConfig({ GROQ_API_KEY: `${KEY}\nX: y` }).ok, false);
});

test('audio upload parser accepts one supported file and rejects malformed or oversized input', () => {
  const accepted = parseAudioUpload(multipart(), `multipart/form-data; boundary=${BOUNDARY}`);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.audio.toString(), 'fake-audio');
  assert.equal(accepted.contentType, 'audio/webm');
  assert.equal(parseAudioUpload(multipart(), 'application/json').ok, false);
  assert.equal(parseAudioUpload(multipart(), `multipart/form-data; boundary=${BOUNDARY}`).status, undefined);
  const noFile = Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="other"; filename="voice.webm"\r\nContent-Type: audio/webm\r\n\r\nabc\r\n--${BOUNDARY}--\r\n`);
  assert.equal(parseAudioUpload(noFile, `multipart/form-data; boundary=${BOUNDARY}`).ok, false);
  assert.equal(parseAudioUpload(multipart(Buffer.alloc(MAX_AUDIO_BYTES + 1)), `multipart/form-data; boundary=${BOUNDARY}`).status, 413);
});

test('transcription request sends the configured model and bearer key; response body is returned as text', async () => {
  let captured;
  const upload = parseAudioUpload(multipart(), `multipart/form-data; boundary=${BOUNDARY}`);
  const result = await transcribeAudio(upload, { model: 'whisper-large-v3', apiKey: KEY }, {
    fetchImpl: async (url, init) => {
      captured = { url, init, model: init.body.get('model'), file: init.body.get('file') };
      return new Response(JSON.stringify({ text: ' Explain the log ' }), { status: 200 });
    },
    endpoint: 'https://test.invalid/transcriptions', timeoutMs: 500,
  });
  assert.deepEqual(result, { ok: true, text: 'Explain the log' });
  assert.equal(captured.url, 'https://test.invalid/transcriptions');
  assert.equal(captured.init.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(captured.model, 'whisper-large-v3');
  assert.equal(captured.file.type, 'audio/webm');
  assert.equal(captured.file.name, 'voice.webm');
});

test('transcription route accepts bounded multipart and does not return credentials', async () => {
  const calls = [];
  const app = createServer({
    providerEnv: { GROQ_API_KEY: KEY, STT_MODEL: 'whisper-large-v3' },
    transcribeAudio: async (upload, config) => {
      calls.push({ bytes: upload.audio.length, key: config.apiKey });
      return { ok: true, text: 'What does this error mean?' };
    },
    log: () => {},
  });
  const addr = await app.listen(0);
  try {
    const good = await fetch(`http://127.0.0.1:${addr.port}/api/assistant/transcribe`, {
      method: 'POST', body: new Blob([multipart()], { type: `multipart/form-data; boundary=${BOUNDARY}` }),
    });
    assert.equal(good.status, 200);
    assert.deepEqual(await good.json(), { text: 'What does this error mean?' });
    assert.deepEqual(calls, [{ bytes: 10, key: KEY }]);
    const unavailable = createServer({ log: () => {} });
    const unavailableAddr = await unavailable.listen(0);
    try {
      const disabled = await fetch(`http://127.0.0.1:${unavailableAddr.port}/api/assistant/voice-status`);
      assert.deepEqual(await disabled.json(), { status: 'disabled', reason: 'Groq voice transcription is not configured.' });
    } finally { await unavailable.close(); }
  } finally { await app.close(); }
});
