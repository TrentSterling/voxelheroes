// Shared by the offline recorder and the game. Personalized names stay in the
// subtitles; recordings address the player as "hero".
export function voiceText(text, heroName = null) {
  let value = String(text ?? '').replaceAll('{hero}', 'hero');
  if (heroName) {
    const escaped = heroName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    value = value.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'), 'hero');
  }
  return value.replace(/^[A-Za-z ]+:\s*/, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}
export const voiceKey = (speaker, text, heroName) => `${speaker}\n${voiceText(text, heroName).toLowerCase()}`;
