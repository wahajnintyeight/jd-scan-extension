// Keep the same React root and draft state when page hydration removes its host.
export function keepOverlayMounted(host: HTMLElement): () => void {
  const restore = () => {
    if (!host.isConnected) document.documentElement.appendChild(host);
  };
  restore();
  const observer = new MutationObserver(restore);
  observer.observe(document.documentElement, { childList: true });
  return () => observer.disconnect();
}
