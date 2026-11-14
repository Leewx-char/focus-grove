// tree.js — 树贴图模块
// 美术为原创 SVG（扁平层叠树冠风，assets/tree-*.svg），计时中显示静态贴图（无成长动画）。
// 枯树效果由 CSS filter 实现（styles.css 的 .tree-dead），保持贴图单一来源。

export const TREE_TYPES = [
  { id: 'oak',      name: '橡树' },
  { id: 'sakura',   name: '樱花' },
  { id: 'pine',     name: '松树' },
  { id: 'maple',    name: '枫树' },
  { id: 'wisteria', name: '紫藤' },
];

export const treeSrc = (type) => `assets/tree-${type}.svg`;
export const treeName = (type) => (TREE_TYPES.find(t => t.id === type) ?? { name: '树' }).name;
