let _pending = false;

export function emitQuestProgress(detail = {}) {
  if (_pending) return;
  _pending = true;
  const fire = () => {
    _pending = false;
    try { window.dispatchEvent(new CustomEvent('quest-progress', { detail })); } catch {}
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fire);
  else setTimeout(fire, 0);
}
