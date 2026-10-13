"use client";
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { ReactFlow,ReactFlowProvider,Handle,Position,Background,Controls,Panel,MarkerType,BaseEdge,getSmoothStepPath,applyNodeChanges,applyEdgeChanges,useReactFlow,type Node,type NodeProps,type Edge,type EdgeProps,type Connection } from '@xyflow/react';
import { useReducedMotion } from 'framer-motion';
import { ArrowDownToLine,Boxes,Check,GitBranch,Repeat2,Trash2,Flag,Plus,LocateFixed } from 'lucide-react';
import { blocks,operations,inspectBlueprint,type Blueprint,type Operation,type TraceFrame } from '@/lib/blueprint';
type LogicNode=Node<{op:Operation;label:string;active:boolean;problem:boolean},'logic'>;
const icons={start:ArrowDownToLine,initSet:Boxes,loop:Repeat2,has:GitBranch,add:Plus,returnTrue:Check,returnFalse:Flag};
function Block({data,selected}:NodeProps<LogicNode>){
  const Icon=icons[data.op];const decision=data.op==='loop'||data.op==='has';
  return <div className={`logic-block ${decision?'logic-decision':''} ${selected?'logic-selected':''} ${data.active?'logic-active':''} ${data.problem?'logic-problem':''}`}>
    {data.op!=='start'&&<Handle type="target" position={Position.Top} aria-label="Input connection"/>}
    <div className="flex items-center gap-2.5"><span className="logic-glyph"><Icon size={16}/></span><span className="min-w-0"><span className="block text-[10px] text-mist">{blocks[data.op].title}</span><span className="mt-1 block max-w-[145px] truncate text-xs font-medium">{data.label}</span></span>{data.active&&<span className="packet-dot"/>}</div>
    {blocks[data.op].ports.map((port,index)=><div key={port} className={`logic-port ${decision?(index===0?'port-yes':'port-no'):'port-next'}`}><span>{port==='next'?'':port}</span><Handle id={port} type="source" position={Position.Bottom} style={{left:decision?(index===0?'28%':'74%'):'50%'}} aria-label={`${port} output connection`}/></div>)}
  </div>;
}
const nodeTypes={logic:Block};
function PacketEdge(props:EdgeProps){
  const reducedMotion=useReducedMotion();
  const [path,labelX,labelY]=getSmoothStepPath(props);
  return <><BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} label={props.label} labelX={labelX} labelY={labelY} labelStyle={props.labelStyle} labelBgStyle={props.labelBgStyle}/>{props.data?.active&&!reducedMotion&&<circle r="4" fill="#91ddce" style={{filter:'drop-shadow(0 0 5px #91ddce)',pointerEvents:'none'}}><animateMotion dur="0.65s" repeatCount="indefinite" path={path}/></circle>}</>;
}
const edgeTypes={packet:PacketEdge};
type Props={blueprint:Blueprint;onChange:(graph:Blueprint)=>void;busy:boolean;frame?:TraceFrame;problemNode?:string|null;focusNode?:string|null;focusToken?:number;onSelect?:(id:string|null)=>void};
function Canvas(props:Props){
  const {blueprint,onChange,busy,frame,problemNode,onSelect}=props;const flow=useReactFlow<LogicNode>();const wrapper=useRef<HTMLDivElement>(null);const [selected,setSelected]=useState<string|null>(null);const [selectedEdge,setSelectedEdge]=useState<string|null>(null);
  const nodeIds=blueprint.nodes.map(node=>node.id).join(',');
  const fit=useRef(flow.fitView);fit.current=flow.fitView;
  useEffect(()=>{const timer=setTimeout(()=>void fit.current({padding:.35,maxZoom:1,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:250}),100);return()=>clearTimeout(timer);},[nodeIds]);
  useEffect(()=>{
    let width=0,timer:ReturnType<typeof setTimeout>;
    const observer=new ResizeObserver(entries=>{const next=entries[0]?.contentRect.width||0;if(next&&next!==width){width=next;clearTimeout(timer);timer=setTimeout(()=>void fit.current({padding:.35,maxZoom:1,duration:0}),100);}});
    if(wrapper.current)observer.observe(wrapper.current);
    return()=>{observer.disconnect();clearTimeout(timer);};
  },[]);
  useEffect(()=>{
    const node=blueprint.nodes.find(n=>n.id===props.focusNode);if(!node)return;
    setSelected(node.id);onSelect?.(node.id);
    const timer=setTimeout(()=>void flow.setCenter(node.x+105,node.y+35,{zoom:.9,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:350}),180);
    return()=>clearTimeout(timer);
  },[props.focusNode,props.focusToken,nodeIds]);
  const nodes:LogicNode[]=useMemo(()=>blueprint.nodes.map(node=>({id:node.id,type:'logic',position:{x:node.x,y:node.y},selected:node.id===selected,data:{op:node.op,label:node.label,active:node.id===frame?.nodeId,problem:node.id===problemNode}})),[blueprint.nodes,selected,frame?.nodeId,problemNode]);
  const edges:Edge[]=useMemo(()=>blueprint.edges.map(edge=>({...edge,selected:edge.id===selectedEdge,sourceHandle:edge.port,type:'packet',data:{active:edge.id===frame?.edgeId},animated:edge.id===frame?.edgeId,label:edge.port==='next'?undefined:edge.port,style:{stroke:edge.id===frame?.edgeId?'#91ddce':'#71668e',strokeWidth:edge.id===frame?.edgeId?2.5:1.5},markerEnd:{type:MarkerType.ArrowClosed,color:edge.id===frame?.edgeId?'#91ddce':'#71668e'},labelStyle:{fill:'#bdb5d1',fontSize:10},labelBgStyle:{fill:'#151727',fillOpacity:1}})),[blueprint.edges,frame?.edgeId,selectedEdge]);
  function add(op:Operation,position?:{x:number;y:number}){
    if(busy||blueprint.nodes.length>=20)return;
    const rect=wrapper.current?.getBoundingClientRect();const p=position||flow.screenToFlowPosition({x:(rect?.left||0)+(rect?.width||600)/2-90,y:(rect?.top||0)+180+(blueprint.nodes.length%4)*75});
    const id=`block_${crypto.randomUUID().slice(0,8)}`;onChange({...blueprint,nodes:[...blueprint.nodes,{id,op,label:blocks[op].title,x:p.x,y:p.y}]});setSelected(id);onSelect?.(id);
  }
  const connect=useCallback((connection:Connection)=>{
    if(busy||!connection.source||!connection.target)return;const port=connection.sourceHandle as 'next'|'yes'|'no';const source=blueprint.nodes.find(node=>node.id===connection.source);
    if(!source||!blocks[source.op].ports.includes(port)||blueprint.edges.length>=40)return;
    onChange({...blueprint,edges:[...blueprint.edges.filter(edge=>!(edge.source===connection.source&&edge.port===port)),{id:`edge_${crypto.randomUUID().slice(0,8)}`,source:connection.source,target:connection.target,port}]});
  },[blueprint,onChange,busy]);
  const inspected=blueprint.nodes.find(node=>node.id===selected);const inspectedEdge=blueprint.edges.find(edge=>edge.id===selectedEdge);
  return <div className="studio-canvas-layout">
    <aside className="block-library" aria-label="Logic block library"><div className="mb-4 flex items-center gap-2"><Boxes size={14} className="text-iris"/><p className="eyebrow">Your building blocks</p></div><p className="mb-5 text-[11px] leading-5 text-mist">Drag a block onto the canvas.<br/>Or click to add it.</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">{operations.map(op=>{const Icon=icons[op];return <button key={op} draggable={!busy} disabled={busy||blueprint.nodes.length>=20} onDragStart={event=>{event.dataTransfer.setData('application/socrastica-block',op);event.dataTransfer.effectAllowed='move';}} onClick={()=>add(op)} className="library-block" aria-label={`Add ${blocks[op].title} block`}><Icon size={16}/><span><span className="block text-[11px] font-medium">{blocks[op].title}</span><span className="mt-1 hidden text-[9px] leading-4 text-mist lg:block">{blocks[op].description}</span></span><Plus size={11} className="ml-auto shrink-0 opacity-50"/></button>})}</div>
      {inspected&&<div className="mt-6 border-t border-white/10 pt-5"><label className="eyebrow" htmlFor="block-label">Selected block</label><input id="block-label" className="mt-3 w-full rounded-lg border border-white/10 bg-black/15 p-2 text-xs" maxLength={80} value={inspected.label} disabled={busy} onChange={event=>onChange({...blueprint,nodes:blueprint.nodes.map(node=>node.id===selected?{...node,label:event.target.value||blocks[node.op].title}:node)})}/><p className="mt-2 text-[10px] leading-5 text-mist">{blocks[inspected.op].description}. Labels describe the block; its operation stays the same.</p><button className="secondary mt-3 w-full" disabled={busy||blueprint.nodes.length===1} onClick={()=>{onChange({nodes:blueprint.nodes.filter(node=>node.id!==selected),edges:blueprint.edges.filter(edge=>edge.source!==selected&&edge.target!==selected)});setSelected(null);}}><Trash2 size={12}/>Remove block</button></div>}
      {inspectedEdge&&<div className="mt-6 border-t border-white/10 pt-5"><p className="eyebrow">Selected connection</p><p className="mt-3 text-xs leading-6 text-mist">{blueprint.nodes.find(node=>node.id===inspectedEdge.source)?.label} → {blueprint.nodes.find(node=>node.id===inspectedEdge.target)?.label}</p><p className="mt-3 text-xs leading-6 text-iris">{inspectedEdge.port==='next'?'Continue to the next operation.':blueprint.nodes.find(node=>node.id===inspectedEdge.source)?.op==='loop'?(inspectedEdge.port==='yes'?'Take this branch when another number is available.':'Take this branch when the list is finished.'):(inspectedEdge.port==='yes'?'Take this branch when the number is already remembered.':'Take this branch when the number is new.')}</p><button className="secondary mt-3 w-full" disabled={busy} onClick={()=>{onChange({...blueprint,edges:blueprint.edges.filter(edge=>edge.id!==selectedEdge)});setSelectedEdge(null);}}>Remove connection</button></div>}
    </aside>
    <div ref={wrapper} className="blueprint-canvas" onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='move';}} onDrop={event=>{event.preventDefault();const op=event.dataTransfer.getData('application/socrastica-block');if(operations.includes(op as Operation))add(op as Operation,flow.screenToFlowPosition({x:event.clientX,y:event.clientY}));}}>
      <ReactFlow<LogicNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} style={{background:'transparent'}} onNodesChange={changes=>{
        const selection=changes.find(change=>change.type==='select'&&change.selected);if(selection&&selection.type==='select'){setSelected(selection.id);onSelect?.(selection.id);}
        if(busy)return;const changed=applyNodeChanges(changes,nodes);if(!changed.length)return;
        if(changes.some(change=>change.type==='position'||change.type==='remove')){const ids=new Set(changed.map(node=>node.id));onChange({nodes:changed.map(node=>({id:node.id,op:node.data.op,label:node.data.label,x:node.position.x,y:node.position.y})),edges:blueprint.edges.filter(edge=>ids.has(edge.source)&&ids.has(edge.target))});}
      }} onEdgesChange={changes=>{const selection=changes.find(change=>change.type==='select'&&change.selected);if(selection&&selection.type==='select'){setSelectedEdge(selection.id);setSelected(null);}if(busy||!changes.some(change=>change.type==='remove'))return;const changed=applyEdgeChanges(changes,edges);const ids=new Set(changed.map(edge=>edge.id));onChange({...blueprint,edges:blueprint.edges.filter(edge=>ids.has(edge.id))});}} onConnect={connect} onEdgeClick={(_,edge)=>{setSelectedEdge(edge.id);setSelected(null);}} onNodeClick={(_,node)=>{setSelectedEdge(null);setSelected(node.id);onSelect?.(node.id);}} onPaneClick={()=>{setSelectedEdge(null);setSelected(null);onSelect?.(null);}} nodesDraggable={!busy} nodesConnectable={!busy} edgesReconnectable={false} fitView fitViewOptions={{padding:.35,maxZoom:1}} minZoom={.25} maxZoom={1.6} colorMode="dark" deleteKeyCode={busy?null:['Backspace','Delete']}>
        <Background gap={24} size={1} color="#b5a3ff16"/><Controls showInteractive={false}/><Panel position="top-left"><div className="canvas-caption"><span className="h-1.5 w-1.5 rounded-full bg-mint"/>LIVE BLUEPRINT <span className="ml-4 text-mist/60">{blueprint.nodes.length} blocks</span></div></Panel><Panel position="top-right"><button className="icon-button bg-[#191b2d]" onClick={()=>void flow.fitView({padding:.3,duration:250,maxZoom:1})} aria-label="Fit blueprint to view"><LocateFixed size={16}/></button></Panel>
        {blueprint.nodes.length===1&&blueprint.edges.length===0&&<Panel position="bottom-center"><p className="canvas-invitation">Start with an idea.<br/><span>Connect a block, or say what should happen next.</span></p></Panel>}
      </ReactFlow>
    </div>
  </div>;
}
export default function BlueprintCanvas(props:Props){return <ReactFlowProvider><Canvas {...props}/></ReactFlowProvider>;}
