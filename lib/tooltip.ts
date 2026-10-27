/** On an element this extension added: its tooltip text, lines split by "\n". */
export const TIP_ATTR = 'data-bsl-tip';

const SHOW_DELAY = 150;
const GAP = 6;
const MARGIN = 8;

/**
 * Gives an element a tooltip that shows on hover or keyboard focus after a
 * short delay, instead of the browser's `title` tooltip, which waits about a
 * second. The first line is bold. Screen readers get the text as a
 * description, unless the element has an aria-label.
 */
export function setTip(el: HTMLElement, text: string): void {
  el.setAttribute(TIP_ATTR, text);
  // An element with its own aria-label (the owned marker) already says it.
  if (!el.hasAttribute('aria-label')) el.setAttribute('aria-description', text.split('\n').join('. '));
  el.removeAttribute('title');
  installTooltips(el.ownerDocument);
}

/** Builds a tooltip's content when it shows, in place of the text lines. */
const renderers = new WeakMap<Element, () => Node[]>();

/**
 * Like `setTip`, but the tooltip shows what `render` builds at that moment,
 * so it can carry what was learned since. `text` stays as the screen-reader
 * description.
 */
export function setRichTip(el: HTMLElement, text: string, render: () => Node[]): void {
  renderers.set(el, render);
  setTip(el, text);
}

/** Each page's hide function, once tooltips are installed there. */
const installed = new WeakMap<Document, () => void>();

/** Hides the page's tooltip, if one is showing, until the pointer moves to another element. */
export function hideTip(doc: Document): void {
  installed.get(doc)?.();
}

/**
 * One tooltip element per page, on <body> rather than inside the tile: game
 * tiles often clip what overflows them. Listeners are delegated, so tips on
 * elements added later work too.
 */
function installTooltips(doc: Document): void {
  if (installed.has(doc)) return;
  let tip: HTMLElement | null = null;
  let target: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const hide = () => {
    clearTimeout(timer);
    target = null;
    tip?.remove();
  };
  installed.set(doc, () => {
    clearTimeout(timer);
    tip?.remove();
  });

  const show = (el: HTMLElement) => {
    // A pack badge with its menu open: the menu says it all.
    if (!el.isConnected || !doc.body || el.getAttribute('aria-expanded') === 'true') return;
    tip ??= doc.createElement('div');
    tip.className = 'bsl-tip';
    tip.setAttribute('aria-hidden', 'true');
    const render = renderers.get(el);
    if (render) {
      tip.replaceChildren(...render());
    } else {
      const [first = '', ...rest] = (el.getAttribute(TIP_ATTR) ?? '').split('\n');
      const heading = doc.createElement('strong');
      heading.textContent = first;
      tip.replaceChildren(heading, ...rest.map((line) => Object.assign(doc.createElement('div'), { textContent: line })));
    }
    doc.body.append(tip);
    place(tip, el.getBoundingClientRect(), doc.documentElement);
  };

  const enter = (event: Event) => {
    const el = tipTarget(event.target);
    if (!el || el === target) return;
    hide();
    target = el;
    timer = setTimeout(() => show(el), SHOW_DELAY);
  };

  const leave = (event: Event) => {
    if (!target) return;
    const next = (event as MouseEvent | FocusEvent).relatedTarget as Node | null;
    if (next && target.contains(next)) return;
    hide();
  };

  doc.addEventListener('mouseover', enter, true);
  doc.addEventListener('mouseout', leave, true);
  doc.addEventListener('focusin', enter, true);
  doc.addEventListener('focusout', leave, true);
  // A fixed tooltip would drift away from its badge.
  doc.addEventListener('scroll', hide, true);
  doc.addEventListener('pointerdown', hide, true);
}

function tipTarget(node: EventTarget | null): HTMLElement | null {
  const n = node as Node | null;
  const element = n?.nodeType === 1 ? (n as Element) : n?.parentElement;
  return element?.closest<HTMLElement>(`[${TIP_ATTR}]`) ?? null;
}

/** Under the element, left edges aligned; above it when there's no room below. Kept inside the viewport. */
export function place(tip: HTMLElement, anchor: DOMRect, root: HTMLElement): void {
  const width = tip.offsetWidth;
  const height = tip.offsetHeight;
  const left = Math.max(MARGIN, Math.min(anchor.left, root.clientWidth - width - MARGIN));
  const below = anchor.bottom + GAP;
  const top = below + height > root.clientHeight - MARGIN ? Math.max(MARGIN, anchor.top - GAP - height) : below;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}
