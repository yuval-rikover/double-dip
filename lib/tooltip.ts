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

const installed = new WeakSet<Document>();

/**
 * One tooltip element per page, on <body> rather than inside the tile: game
 * tiles often clip what overflows them. Listeners are delegated, so tips on
 * elements added later work too.
 */
function installTooltips(doc: Document): void {
  if (installed.has(doc)) return;
  installed.add(doc);
  let tip: HTMLElement | null = null;
  let target: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const hide = () => {
    clearTimeout(timer);
    target = null;
    tip?.remove();
  };

  const show = (el: HTMLElement) => {
    if (!el.isConnected || !doc.body) return;
    const [first = '', ...rest] = (el.getAttribute(TIP_ATTR) ?? '').split('\n');
    tip ??= doc.createElement('div');
    tip.className = 'bsl-tip';
    tip.setAttribute('aria-hidden', 'true');
    const heading = doc.createElement('strong');
    heading.textContent = first;
    tip.replaceChildren(heading, ...rest.map((line) => Object.assign(doc.createElement('div'), { textContent: line })));
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
