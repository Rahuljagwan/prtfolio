// When the visitor last did something (scrolled, moved the pointer, resized). The render scheduler writes it; ambient animations read
// it so they can rest completely once the page has been still for a while, instead of keeping the GPU busy for an idle tab.
// No React and no three.js.

export const activity = { last: 0 };
