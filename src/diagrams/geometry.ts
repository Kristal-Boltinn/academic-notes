import type { DiagramCommutation, DiagramData } from './model';
export const diagramPosition = (data: DiagramData, id: string) => {
    const node = data.nodes.find(n => n.id === id)!;
    return { x: 110 + node.col * 240, y: 85 + node.row * 160 };
};
/** A quarter-circle wholly inside the triangle's incircle, facing the via node. */
export function commutationArc(data: DiagramData, marker: DiagramCommutation) {
    const a = diagramPosition(data, marker.from), b = diagramPosition(data, marker.via), c = diagramPosition(data, marker.to);
    const ab = Math.hypot(b.x - a.x, b.y - a.y), bc = Math.hypot(c.x - b.x, c.y - b.y), ac = Math.hypot(c.x - a.x, c.y - a.y), perimeter = ab + bc + ac;
    const x = (bc * a.x + ac * b.x + ab * c.x) / perimeter, y = (bc * a.y + ac * b.y + ab * c.y) / perimeter;
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x), inradius = Math.abs(cross) / perimeter;
    const radius = Math.min(20, inradius * .38), end = Math.atan2(b.y - y, b.x - x), direction = cross > 0 ? 1 : -1, start = end - direction * Math.PI / 2;
    return { x, y, radius, inradius, path: `M ${x + radius * Math.cos(start)} ${y + radius * Math.sin(start)} A ${radius} ${radius} 0 0 ${direction > 0 ? 1 : 0} ${x + radius * Math.cos(end)} ${y + radius * Math.sin(end)}` };
}
