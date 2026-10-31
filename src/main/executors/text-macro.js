import { sendNativeCommand } from '../native-engine.js';

async function executeTextMacro(payload) {
  const { text } = payload;
  if (!text) throw new Error('Text macro content is required');

  sendNativeCommand(`macro ${text}`);
  console.log(`[Macro] Typed: "${text}"`);
  return { status: 'ok' };
}

export { executeTextMacro };
