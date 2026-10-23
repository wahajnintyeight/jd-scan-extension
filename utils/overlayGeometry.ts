export function overlayGeometry(viewportWidth: number, viewportHeight: number, minimized = false) {
  const gutter = 12;
  const width = Math.max(0, Math.min(440, viewportWidth - gutter * 2));
  const height = Math.max(0, Math.min(minimized ? 44 : 680, viewportHeight - gutter * 2));
  return {
    width,
    height,
    minX: Math.min(gutter, viewportWidth),
    minY: Math.min(gutter, viewportHeight),
    maxX: Math.max(gutter, viewportWidth - width - gutter),
    maxY: Math.max(gutter, viewportHeight - height - gutter),
  };
}

export function clampOverlayPosition(position: { x: number; y: number }, bounds: ReturnType<typeof overlayGeometry>) {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, position.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, position.y)),
  };
}
