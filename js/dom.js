// Small DOM helpers the screens share.

export function el(tag, className, text = '') {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

// A button with the app's look; `label`, when given, is its accessible name.
export function button(className, label = '') {
  const node = el('button', `btn ${className}`);
  node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  return node;
}
