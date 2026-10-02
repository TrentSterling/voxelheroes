// Test-only output isolation. Game gain/mute logic still runs, but real-time
// WebAudio graphs cannot reach a speaker; media playback is always muted.
export function isolateAudioOutput() {
  const audit = window.__testAudioOutputGuard = {
    version: 1, blockedDestinations: 0, mutedMediaPlays: 0, suppressedSpeech: 0,
  };
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (window.AudioNode && window.AudioDestinationNode && AudioContext) {
    const connect = window.AudioNode.prototype.connect;
    window.AudioNode.prototype.connect = function (destination, ...args) {
      if (destination instanceof window.AudioDestinationNode && this.context instanceof AudioContext) {
        audit.blockedDestinations++;
        return destination;
      }
      return connect.call(this, destination, ...args);
    };
  }
  if (window.HTMLMediaElement) {
    const proto = window.HTMLMediaElement.prototype;
    const muted = Object.getOwnPropertyDescriptor(proto, 'muted');
    const play = proto.play;
    Object.defineProperty(proto, 'muted', { ...muted, set() { muted.set.call(this, true); } });
    proto.play = function (...args) {
      muted.set.call(this, true);
      audit.mutedMediaPlays++;
      return play.apply(this, args);
    };
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = () => { audit.suppressedSpeech++; };
  }
}

// Call on a context (covers its future pages/frames) or a page, before goto.
export const installSilentOutput = target => target.addInitScript(isolateAudioOutput);
