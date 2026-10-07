import { parse, type DefaultTreeAdapterMap } from 'parse5';

export type Node = DefaultTreeAdapterMap['node'];
export type Element = DefaultTreeAdapterMap['element'];
export const document = (html: string): Node => parse(html);
export const element = (node: Node): node is Element => 'tagName' in node;
export const children = (node: Node): Node[] => 'childNodes' in node ? node.childNodes : [];
export const attr = (node: Element, name: string): string | undefined => node.attrs.find((a) => a.name === name)?.value;
export const hasClass = (node: Element, name: string): boolean => (attr(node, 'class') ?? '').split(/\s+/).includes(name);
export function* walk(node: Node): Generator<Element> {
  if (element(node)) yield node;
  for (const child of children(node)) yield* walk(child);
}
export function text(node: Node): string {
  if (node.nodeName === '#text' && 'value' in node) return node.value;
  if (element(node) && ['script', 'style', 'template'].includes(node.tagName)) return '';
  if (element(node) && node.tagName === 'br') return ' ';
  return children(node).map(text).join('');
}
export const plain = (node: Node): string => text(node).replace(/\s+/g, ' ').trim();
