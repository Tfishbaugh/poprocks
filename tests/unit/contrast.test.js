// Every color pair the app draws passes WCAG 2.2 AA in both themes:
// 4.5:1 for text, 3:1 for shapes that carry meaning (lit pads, focus rings, buttons).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');

function vars(block) {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
}

const light = vars(css.match(/^:root\s*{([^}]*)}/m)[1]);
const dark = { ...light, ...vars(css.match(/@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}/)[1]) };

function channel(hex, i) {
  const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TRACKS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];

const TEXT = [
  ['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['brand', 'bg'],
  ['on-play', 'play'], ['on-video', 'video'], ['on-rec', 'rec'], ['bg', 'text'],
  ['on-chip', 'chip'], ['on-chip', 'stage'], ['on-stage-video', 'stage-video'],
  ...TRACKS.map((c) => ['on-c', c]),
];

const SHAPES = [
  ...TRACKS.flatMap((c) => [[c, 'pad-off'], [c, 'pad-alt'], [c, 'pad-now'], [c, 'bg'], [c, 'surface']]),
  ['focus', 'bg'], ['focus', 'surface'], ['stage-focus', 'stage'], ['stage-focus', 'chip'],
  ['play', 'bg'], ['video', 'bg'], ['stage-video', 'stage'], ['rec', 'stage'], ['text', 'bg'],
];

function check(theme, name, pairs, min) {
  pairs.forEach(([fg, bg]) => {
    assert.ok(theme[fg] && theme[bg], `${name}: --${fg} and --${bg} are defined`);
    const r = ratio(theme[fg], theme[bg]);
    assert.ok(r >= min, `${name}: --${fg} on --${bg} is ${r.toFixed(2)}:1, needs ${min}:1`);
  });
}

test('the ratio math matches known values', () => {
  assert.equal(ratio('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(ratio('#777777', '#FFFFFF').toFixed(2), '4.48');
});

test('both themes define every color', () => {
  assert.ok(Object.keys(light).length >= 30, `${Object.keys(light).length} colors`);
  ['bg', 'text', 'c0', 'c7', 'play', 'video', 'rec', 'focus'].forEach((key) => assert.notEqual(light[key], dark[key], key));
});

test('light theme: text passes 4.5:1', () => check(light, 'light', TEXT, 4.5));
test('dark theme: text passes 4.5:1', () => check(dark, 'dark', TEXT, 4.5));
test('light theme: pads, focus rings and buttons pass 3:1', () => check(light, 'light', SHAPES, 3));
test('dark theme: pads, focus rings and buttons pass 3:1', () => check(dark, 'dark', SHAPES, 3));
