// Native stub — ElevenLabs runs web-only
export async function elevenLabsSpeak(
  _text: string, _key: string, _voiceId: string,
  _onAmp: (v: number) => void, _onDone: () => void,
): Promise<void> { _onDone(); }
export function stopElevenLabs(): void {}
export function isElevenLabsSpeaking(): boolean { return false; }
