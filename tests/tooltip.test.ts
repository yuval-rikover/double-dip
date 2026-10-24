// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { place, setTip } from '../lib/tooltip';

function tipped(text: string) {
  const el = document.createElement('a');
  el.innerHTML = 'Steam <span>93%</span>';
  setTip(el, text);
  document.body.append(el);
  return el;
}

const shown = () => document.querySelector('.bsl-tip');

describe('setTip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });
  afterEach(() => vi.useRealTimers());

  it('replaces the title and describes the element to screen readers', () => {
    const el = document.createElement('a');
    el.title = 'old';
    setTip(el, 'Psychonauts\nOpen on Steam');
    expect(el.hasAttribute('title')).toBe(false);
    expect(el.getAttribute('aria-description')).toBe('Psychonauts. Open on Steam');
  });

  it('leaves the description to an existing aria-label', () => {
    const el = document.createElement('span');
    el.setAttribute('aria-label', 'Owned on Steam');
    setTip(el, 'Owned on Steam');
    expect(el.hasAttribute('aria-description')).toBe(false);
  });

  it('shows shortly after hover, first line bold, and hides on leaving', () => {
    const el = tipped('Psychonauts\nVery Positive · 93% of 6,681 reviews\nOpen on Steam');
    el.querySelector('span')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(shown()).toBeNull();
    vi.advanceTimersByTime(150);
    expect(shown()?.querySelector('strong')?.textContent).toBe('Psychonauts');
    expect([...shown()!.querySelectorAll('div')].map((line) => line.textContent)).toEqual([
      'Very Positive · 93% of 6,681 reviews',
      'Open on Steam',
    ]);
    // Moving onto a child of the element keeps it.
    el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: el.querySelector('span') }));
    expect(shown()).not.toBeNull();
    el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    expect(shown()).toBeNull();
  });

  it('never shows when the pointer leaves before the delay', () => {
    const el = tipped('Psychonauts');
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    vi.advanceTimersByTime(500);
    expect(shown()).toBeNull();
  });

  it('shows on keyboard focus and hides on scroll', () => {
    const el = tipped('Psychonauts');
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(150);
    expect(shown()).not.toBeNull();
    document.dispatchEvent(new Event('scroll'));
    expect(shown()).toBeNull();
  });
});

describe('place', () => {
  const root = { clientWidth: 1000, clientHeight: 800 } as HTMLElement;
  function sized(width: number, height: number) {
    const tip = document.createElement('div');
    Object.defineProperty(tip, 'offsetWidth', { value: width });
    Object.defineProperty(tip, 'offsetHeight', { value: height });
    return tip;
  }
  const rect = (left: number, top: number, width = 80, height = 20) =>
    ({ left, top, right: left + width, bottom: top + height }) as DOMRect;

  it('goes under the element, left edges aligned', () => {
    const tip = sized(200, 50);
    place(tip, rect(100, 100), root);
    expect([tip.style.left, tip.style.top]).toEqual(['100px', '126px']);
  });

  it('goes above when there is no room below', () => {
    const tip = sized(200, 50);
    place(tip, rect(100, 760), root);
    expect(tip.style.top).toBe('704px');
  });

  it('stays inside the right edge', () => {
    const tip = sized(200, 50);
    place(tip, rect(900, 100), root);
    expect(tip.style.left).toBe('792px');
  });
});
