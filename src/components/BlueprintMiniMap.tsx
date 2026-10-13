import type { Blueprint } from '@/lib/blueprint';
export default function BlueprintMiniMap({blueprint,label='Blueprint preview'}:{blueprint:Blueprint;label?:string}){
  const minX=Math.min(...blueprint.nodes.map(n=>n.x))-30,minY=Math.min(...blueprint.nodes.map(n=>n.y))-30;
  const width=Math.max(...blueprint.nodes.map(n=>n.x))+240-minX,height=Math.max(...blueprint.nodes.map(n=>n.y))+100-minY;
  return <svg className="blueprint-mini" viewBox={`${minX} ${minY} ${width} ${height}`} role="img" aria-label={label}>
    {blueprint.edges.map(edge=>{const from=blueprint.nodes.find(n=>n.id===edge.source)!,to=blueprint.nodes.find(n=>n.id===edge.target)!;return <g key={edge.id}><path d={`M${from.x+105},${from.y+60} L${from.x+105},${from.y+80} L${to.x+105},${to.y-20} L${to.x+105},${to.y}`} fill="none" stroke="#9c8fbd" strokeWidth="2"/><text x={from.x+112} y={from.y+78} fill="#b7adc9" fontSize="11">{edge.port==='next'?'':edge.port}</text></g>;})}
    {blueprint.nodes.map(node=><g key={node.id}><rect x={node.x} y={node.y} width="210" height="60" rx="12" fill={node.op==='has'||node.op==='loop'?'#213045':'#24233b'} stroke="#b5a3ff55"/><text x={node.x+12} y={node.y+34} fill="#e3dbf5" fontSize="13">{node.label.length>27?node.label.slice(0,25)+'…':node.label}</text></g>)}
  </svg>;
}
