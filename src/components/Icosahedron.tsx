'use client';

import { useEffect, useRef } from 'react';

export function Icosahedron() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const size = 40;
    canvas.width = size;
    canvas.height = size;

    // Golden ratio for icosahedron
    const phi = (1 + Math.sqrt(5)) / 2;
    const scale = 10;

    // Icosahedron vertices
    const vertices = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
    ].map(v => v.map(c => c * scale));

    // Icosahedron edges (pairs of vertex indices)
    const edges = [
      [0, 1], [0, 5], [0, 7], [0, 10], [0, 11],
      [1, 5], [1, 7], [1, 8], [1, 9],
      [2, 3], [2, 4], [2, 6], [2, 10], [2, 11],
      [3, 4], [3, 6], [3, 8], [3, 9],
      [4, 5], [4, 9], [4, 11],
      [5, 9], [5, 11],
      [6, 7], [6, 8], [6, 10],
      [7, 8], [7, 10],
      [8, 9],
      [10, 11]
    ];

    let angleX = 0;
    let angleY = 0;

    function rotateX(point: number[], angle: number): number[] {
      const [x, y, z] = point;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [x, y * cos - z * sin, y * sin + z * cos];
    }

    function rotateY(point: number[], angle: number): number[] {
      const [x, y, z] = point;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [x * cos + z * sin, y, -x * sin + z * cos];
    }

    function project(point: number[]): [number, number] {
      const [x, y, z] = point;
      const perspective = 50;
      const focalScale = perspective / (perspective + z);
      return [x * focalScale + size / 2, y * focalScale + size / 2];
    }

    function animate() {
      ctx.clearRect(0, 0, size, size);

      // Rotate vertices
      const rotatedVertices = vertices.map(v => {
        let point = rotateX(v, angleX);
        point = rotateY(point, angleY);
        return point;
      });

      // Project and draw edges
      ctx.lineWidth = 1;

      edges.forEach(([i, j]) => {
        const [x1, y1] = project(rotatedVertices[i]);
        const [x2, y2] = project(rotatedVertices[j]);

        // Calculate depth for opacity
        const z1 = rotatedVertices[i][2];
        const z2 = rotatedVertices[j][2];
        const avgZ = (z1 + z2) / 2;
        const opacity = 0.3 + (avgZ + scale) / (scale * 2);

        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0.15, Math.min(0.6, opacity))})`;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      // Draw vertices
      rotatedVertices.forEach(v => {
        const [x, y] = project(v);
        const opacity = 0.4 + (v[2] + scale) / (scale * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.2, Math.min(0.8, opacity))})`;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      });

      angleX += 0.0025;
      angleY += 0.00375;

      requestAnimationFrame(animate);
    }

    animate();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '40px',
        height: '40px'
      }}
    />
  );
}
