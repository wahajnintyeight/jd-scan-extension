import assert from 'node:assert/strict';
import { test } from 'node:test';
import resolveConfig from 'tailwindcss/resolveConfig.js';
import config, { withPixelUnits } from '../tailwind.config.js';
import { load } from './extensionHarness.mjs';

const { overlayGeometry, clampOverlayPosition } = await load('utils/overlayGeometry.ts', {});

test('the assistant fits small and medium windows with a gutter on every edge', () => {
  for (const [width, height] of [[320, 480], [375, 667], [414, 736], [768, 520], [1024, 600], [1280, 900]]) {
    const bounds = overlayGeometry(width, height);
    assert.equal(bounds.width, Math.min(440, width - 24));
    assert.equal(bounds.height, Math.min(680, height - 24));
    for (const position of [{ x: -500, y: -500 }, { x: 2000, y: 2000 }]) {
      const clamped = clampOverlayPosition(position, bounds);
      assert.ok(clamped.x >= 12 && clamped.x + bounds.width <= width - 12);
      assert.ok(clamped.y >= 12 && clamped.y + bounds.height <= height - 12);
    }
  }
});

test('restoring a minimized assistant clamps it back into a short viewport', () => {
  const minimized = overlayGeometry(375, 480, true);
  assert.equal(minimized.height, 44);
  const expanded = overlayGeometry(375, 480);
  const position = clampOverlayPosition({ x: minimized.maxX, y: minimized.maxY }, expanded);
  assert.equal(position.y, 12);
  assert.equal(position.y + expanded.height, 468);
});

test('font sizes, line heights, spacing and widths do not inherit the host root font size', () => {
  const theme = resolveConfig(config).theme;
  assert.equal(theme.fontSize.sm[0], '14px');
  assert.equal(theme.fontSize.sm[1].lineHeight, '20px');
  assert.equal(theme.spacing[4], '16px');
  assert.equal(theme.padding[4], '16px');
  assert.equal(theme.maxWidth['4xl'], '896px');
  assert.deepEqual(theme.fontFamily.sans, ['var(--jd-font-sans)']);
});

test('pixel unit conversion preserves theme callbacks, non-rem units and token names', () => {
  const converted = withPixelUnits({ spacing: '.5rem', value: '-.125rem', callback: value => [value, { height: '1.25rem' }] });
  assert.equal(converted.spacing, '8px');
  assert.equal(converted.value, '-2px');
  assert.deepEqual(converted.callback('100%'), ['100%', { height: '20px' }]);
  assert.equal(withPixelUnits('var(--jd-font-sans)'), 'var(--jd-font-sans)');
});
