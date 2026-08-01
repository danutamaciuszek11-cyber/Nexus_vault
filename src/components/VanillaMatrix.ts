import { BinaryUnit } from '../state';

interface MatrixNode {
  id: string;
  name: string;
  type: 'unit' | 'architect';
  status?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

interface MatrixLink {
  source: string;
  target: string;
  value: number;
}

export class VanillaMatrix {
  private container: HTMLElement;
  private svg: SVGSVGElement;
  private nodes: MatrixNode[] = [];
  private links: MatrixLink[] = [];
  private animeId: number | null = null;
  private draggedNode: MatrixNode | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'w-full h-full cursor-crosshair select-none bg-black/25 rounded-xl border border-neutral-900');
    container.appendChild(this.svg);
    this.setupEvents();
  }

  update(units: BinaryUnit[], architectName: string) {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 400;

    // Build Nodes
    const newNodesMap = new Map<string, MatrixNode>();
    this.nodes.forEach(n => newNodesMap.set(n.id, n));

    const updatedNodes: MatrixNode[] = [];
    
    // Add Architect
    const archId = 'architect';
    if (newNodesMap.has(archId)) {
      updatedNodes.push(newNodesMap.get(archId)!);
    } else {
      updatedNodes.push({ id: archId, name: architectName, type: 'architect', x: width / 2, y: height / 2, vx: 0, vy: 0 });
    }

    // Add Units
    units.forEach((u) => {
      if (newNodesMap.has(u.id)) {
        const existingNode = newNodesMap.get(u.id)!;
        existingNode.status = u.status;
        existingNode.name = u.name;
        updatedNodes.push(existingNode);
      } else {
        const angle = Math.random() * Math.PI * 2;
        const radius = 100 + Math.random() * 50;
        updatedNodes.push({
          id: u.id,
          name: u.name,
          type: 'unit',
          status: u.status,
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius,
          vx: 0,
          vy: 0
        });
      }
    });

    this.nodes = updatedNodes;

    // Reset Links
    this.links = units.map(u => ({
      source: 'architect',
      target: u.id,
      value: 1
    }));

    // Group units by assignedMandateId to show active shared-goal collaboration network
    const mandateGroups = new Map<string, string[]>();
    units.forEach(u => {
      if (u.assignedMandateId) {
        if (!mandateGroups.has(u.assignedMandateId)) {
          mandateGroups.set(u.assignedMandateId, []);
        }
        mandateGroups.get(u.assignedMandateId)!.push(u.id);
      }
    });

    mandateGroups.forEach((unitIds) => {
      for (let i = 0; i < unitIds.length; i++) {
        for (let j = i + 1; j < unitIds.length; j++) {
          this.links.push({
            source: unitIds[i],
            target: unitIds[j],
            value: 2 // Value 2 represents dense green active collaboration lines
          });
        }
      }
    });

    // Random connections to look entangled
    if (units.length > 2) {
      for (let i = 0; i < Math.floor(units.length / 2); i++) {
        const s = units[Math.floor(Math.random() * units.length)].id;
        const t = units[Math.floor(Math.random() * units.length)].id;
        if (s !== t) {
          this.links.push({ source: s, target: t, value: 0.5 });
        }
      }
    }

    if (!this.animeId) {
      this.tick();
    }
  }

  destroy() {
    if (this.animeId) {
      cancelAnimationFrame(this.animeId);
      this.animeId = null;
    }
    this.svg.remove();
  }

  private setupEvents() {
    const getCoords = (e: MouseEvent | TouchEvent) => {
      const rect = this.svg.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const handleDown = (e: MouseEvent | TouchEvent) => {
      const coords = getCoords(e);
      let closestNode: MatrixNode | null = null;
      let minDist = 30; // touch & click padding targeting radius

      this.nodes.forEach((n) => {
        const dx = n.x - coords.x;
        const dy = n.y - coords.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) {
          minDist = d;
          closestNode = n;
        }
      });

      if (closestNode) {
        this.draggedNode = closestNode;
        this.draggedNode.fx = coords.x;
        this.draggedNode.fy = coords.y;
      }
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!this.draggedNode) return;
      const coords = getCoords(e);
      this.draggedNode.fx = coords.x;
      this.draggedNode.fy = coords.y;
    };

    const handleUp = () => {
      if (this.draggedNode) {
        this.draggedNode.fx = null;
        this.draggedNode.fy = null;
        this.draggedNode = null;
      }
    };

    this.svg.addEventListener('mousedown', handleDown);
    this.svg.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    this.svg.addEventListener('touchstart', handleDown, { passive: true });
    this.svg.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleUp);
  }

  private getStatusColor(status?: string) {
    switch (status) {
      case 'active':
      case 'synchronizing':
        return '#00ff9d';
      case 'ether':
      case 'wanderer':
        return '#cb23ff';
      case 'quarantined':
      case 'brak-odwrotu':
        return '#ff0055';
      case 'dormant':
        return '#525252';
      default:
        return '#262626';
    }
  }

  private tick = () => {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 400;

    // Apply forces
    const kCharge = -500;
    const kSpring = 0.05;
    const restLen = 90;
    const damping = 0.85;

    // Node-to-node repulsion (charge)
    for (let i = 0; i < this.nodes.length; i++) {
      const n1 = this.nodes[i];
      for (let j = i + 1; j < this.nodes.length; j++) {
        const n2 = this.nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = kCharge / (d * d);
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        n1.vx += fx;
        n1.vy += fy;
        n2.vx -= fx;
        n2.vy -= fy;
      }
    }

    // Spring forces
    this.links.forEach((link) => {
      const n1 = this.nodes.find(n => n.id === link.source);
      const n2 = this.nodes.find(n => n.id === link.target);
      if (!n1 || !n2) return;

      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const ext = d - (link.value === 1 ? restLen : restLen * 1.5);
      const fAmount = ext * kSpring * link.value;
      const fx = (dx / d) * fAmount;
      const fy = (dy / d) * fAmount;

      n1.vx += fx;
      n1.vy += fy;
      n2.vx -= fx;
      n2.vy -= fy;
    });

    // Centering & boundary force + update position
    this.nodes.forEach((n) => {
      if (n.fx !== undefined && n.fx !== null) {
        n.x = n.fx;
        n.y = n.fy;
        n.vx = 0;
        n.vy = 0;
      } else {
        // Centering push
        n.vx += (width / 2 - n.x) * 0.02;
        n.vy += (height / 2 - n.y) * 0.02;

        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx;
        n.y += n.vy;

        // Bounding limits
        n.x = Math.max(20, Math.min(width - 20, n.x));
        n.y = Math.max(20, Math.min(height - 20, n.y));
      }
    });

    // Re-draw SVG structure cleanly and safely without innerHTML
    this.svg.textContent = '';

    // Create defs for high-tech shadows & effects
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    const glowFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    glowFilter.setAttribute('id', 'vanilla-glow');
    const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '4');
    blur.setAttribute('result', 'coloredBlur');
    const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const node1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    node1.setAttribute('in', 'coloredBlur');
    const node2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    node2.setAttribute('in', 'SourceGraphic');
    merge.appendChild(node1);
    merge.appendChild(node2);
    glowFilter.appendChild(blur);
    glowFilter.appendChild(merge);
    defs.appendChild(glowFilter);
    this.svg.appendChild(defs);

    // Draw Links
    this.links.forEach((link) => {
      const n1 = this.nodes.find(n => n.id === link.source);
      const n2 = this.nodes.find(n => n.id === link.target);
      if (!n1 || !n2) return;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(n1.x));
      line.setAttribute('y1', String(n1.y));
      line.setAttribute('x2', String(n2.x));
      line.setAttribute('y2', String(n2.y));

      let strokeColor = '#cb23ff'; // Default random links
      let strokeOpacity = '0.12';
      let strokeWidth = String(link.value * 1.5);
      let dashArray = '2,4';

      if (link.value === 1) {
        strokeColor = '#00ff9d'; // Architect linkage
        strokeOpacity = '0.2';
        strokeWidth = '1.2';
        dashArray = '';
      } else if (link.value === 2) {
        strokeColor = '#00ff9d'; // Active collaboration linkage
        strokeOpacity = '0.7';
        strokeWidth = '2.5';
        dashArray = '';
        line.setAttribute('filter', 'url(#vanilla-glow)');
      }

      line.setAttribute('stroke', strokeColor);
      line.setAttribute('stroke-opacity', strokeOpacity);
      line.setAttribute('stroke-width', strokeWidth);
      if (dashArray) {
        line.setAttribute('stroke-dasharray', dashArray);
      }
      this.svg.appendChild(line);
    });

    // Draw Nodes
    this.nodes.forEach((n) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${n.x},${n.y})`);

      // Color based on status/type
      const c = n.type === 'architect' ? '#ffffff' : this.getStatusColor(n.status);

      // Active pulse ring
      if (n.type === 'unit' && (n.status === 'active' || n.status === 'synchronizing')) {
        const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pulse.setAttribute('r', '15');
        pulse.setAttribute('fill', 'none');
        pulse.setAttribute('stroke', c);
        pulse.setAttribute('stroke-width', '1.5');
        pulse.setAttribute('opacity', '0.4');
        pulse.setAttribute('style', 'transform-origin: center; animation: matrix-pulse 2s infinite linear;');
        g.appendChild(pulse);
      }

      // Center Node Dot
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', n.type === 'architect' ? '9' : '5');
      circle.setAttribute('fill', c);
      if (n.type === 'architect' || n.status === 'active') {
        circle.setAttribute('filter', 'url(#vanilla-glow)');
      }
      g.appendChild(circle);

      // Core Text Label
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.textContent = n.name;
      txt.setAttribute('x', n.type === 'architect' ? '14' : '12');
      txt.setAttribute('y', '3');
      txt.setAttribute('fill', n.type === 'architect' ? '#ffffff' : '#999999');
      txt.setAttribute('font-size', n.type === 'architect' ? '11px' : '9px');
      txt.setAttribute('font-weight', n.type === 'architect' ? '900' : 'bold');
      txt.setAttribute('font-family', 'Inter, system-ui, sans-serif');
      txt.setAttribute('pointer-events', 'none');
      g.appendChild(txt);

      this.svg.appendChild(g);
    });

    this.animeId = requestAnimationFrame(this.tick);
  };
}
