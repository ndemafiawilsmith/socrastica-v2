"use client";
import { useEffect,useRef,useState } from 'react';
import { ArrowUp,Mic,MicOff,Square,Volume2,VolumeX,LoaderCircle,Keyboard } from 'lucide-react';
type Recognition={continuous:boolean;interimResults:boolean;lang:string;start:()=>void;stop:()=>void;abort:()=>void;onresult:((event:{resultIndex:number;results:{length:number;[index:number]:{isFinal:boolean;[index:number]:{transcript:string}}}})=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null};
export default function VoiceDirector({busy,reviewPending=false,playing=false,note,onDirect,onPreview}:{busy:boolean;reviewPending?:boolean;playing?:boolean;note:string;onDirect:(text:string)=>Promise<void>;onPreview:(text:string)=>void}){
  const [supported,setSupported]=useState(false),[listening,setListening]=useState(false),[text,setText]=useState(''),[interim,setInterim]=useState(''),[error,setError]=useState(''),[audio,setAudio]=useState(false);
  const recognition=useRef<Recognition|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),latest=useRef(''),busyRef=useRef(busy),sent=useRef(''),live=useRef(false),onDirectRef=useRef(onDirect),onPreviewRef=useRef(onPreview);
  const sending=useRef(false);
  busyRef.current=busy||playing;onDirectRef.current=onDirect;onPreviewRef.current=onPreview;
  useEffect(()=>{const browser=window as typeof window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};setSupported(!!(browser.SpeechRecognition||browser.webkitSpeechRecognition)&&window.isSecureContext);return()=>{live.current=false;recognition.current?.abort();if(timer.current)clearTimeout(timer.current);window.speechSynthesis?.cancel();};},[]);
  useEffect(()=>{if(audio&&note&&window.speechSynthesis){window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(note);utterance.rate=.97;window.speechSynthesis.speak(utterance);}return()=>window.speechSynthesis?.cancel();},[note,audio]);
  async function submit(){
    if(!latest.current.trim()||busyRef.current||sending.current)return;sending.current=true;
    if(timer.current)clearTimeout(timer.current);recognition.current?.stop();live.current=false;setListening(false);
    try{await onDirectRef.current(latest.current.trim());sent.current=latest.current;}catch{ /* The studio displays the actionable API error. */ }finally{sending.current=false;}
  }
  function toggle(){
    if(listening){if(latest.current.trim())void submit();else{live.current=false;recognition.current?.stop();setListening(false);setInterim('');if(timer.current)clearTimeout(timer.current);}return;}
    const browser=window as typeof window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};const Constructor=browser.SpeechRecognition||browser.webkitSpeechRecognition;
    if(!Constructor)return;if(latest.current===sent.current){latest.current='';setText('');}setError('');const instance=new Constructor();recognition.current=instance;instance.continuous=true;instance.interimResults=true;instance.lang='en-US';live.current=true;
    instance.onresult=event=>{
      let final='',partial='';for(let i=event.resultIndex;i<event.results.length;i++){if(event.results[i].isFinal)final+=event.results[i][0].transcript+' ';else partial+=event.results[i][0].transcript;}
      if(final){latest.current=(latest.current+' '+final).trim().slice(-2000);setText(latest.current);}
      setInterim(partial);if(!busyRef.current)onPreviewRef.current(latest.current+' '+partial);
      if(timer.current)clearTimeout(timer.current);
      timer.current=setTimeout(()=>{if(live.current&&!busyRef.current&&latest.current.trim()&&latest.current!==sent.current)void submit();},12000);
    };
    instance.onerror=event=>{live.current=false;setListening(false);setError(event.error==='not-allowed'?'Microphone access was declined. Allow it in browser settings, or type your idea.':event.error==='no-speech'?'No speech detected. Try the microphone again.':'Voice recognition is unavailable. Type your direction below.');};
    instance.onend=()=>{const wasLive=live.current;live.current=false;setListening(false);setInterim('');if(timer.current)clearTimeout(timer.current);if(wasLive&&latest.current.trim()&&latest.current!==sent.current&&!busyRef.current)void submit();};
    try{instance.start();setListening(true);}catch{live.current=false;setError('The microphone could not start. Try again or type your direction.');}
  }
  return <section className="director-strip" aria-label="Direct your blueprint">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><button onClick={toggle} disabled={!supported||busy||playing} className={`voice-button ${listening?'is-listening':''}`} aria-label={listening?'Stop listening':'Start voice direction'} aria-pressed={listening}>{listening?<Square size={18}/>:supported?<Mic size={21}/>:<MicOff size={21}/>}</button><div><p className="text-sm font-medium">{listening?'Thinking out loud…':reviewPending?'Review your draft above':busy?'Your drafter is working':playing?'Watch your blueprint run':'Your idea. Your blueprint.'}</p><p className="mt-1 text-[11px] text-mist">{listening?'Mentioned blocks appear live. Pause or send to connect them.':supported?'Tap the mic, or give a short direction below.':'Voice isn’t available here. You can still direct the canvas with text.'}</p></div></div><button className="icon-button" onClick={()=>setAudio(value=>!value)} aria-label={audio?'Mute spoken nudges':'Enable spoken nudges'} aria-pressed={audio}>{audio?<Volume2 size={17}/>:<VolumeX size={17}/>}</button></div>
    <form onSubmit={event=>{event.preventDefault();void submit();}} className="mt-4 flex items-end gap-3"><label className="sr-only" htmlFor="director-input">Your direction</label><textarea id="director-input" value={text} disabled={busy||playing} rows={2} maxLength={2000} onChange={event=>{setText(event.target.value);latest.current=event.target.value;}} placeholder="“Loop through the numbers. Check if we’ve seen this one before…”" className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-xs leading-6 placeholder:text-mist/60"/><button className="primary h-11 shrink-0 px-3" disabled={busy||playing||!text.trim()} aria-label="Update blueprint">{busy?<LoaderCircle size={17} className="animate-spin"/>:<ArrowUp size={18}/>}</button></form>
    {interim&&<p role="status" className="mt-2 text-xs text-iris">{interim}</p>}{error&&<p role="alert" className="mt-3 text-xs leading-5 text-rose-300">{error}</p>}
    <p className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-mist/75"><Keyboard size={12} className="mt-1 shrink-0"/>Voice uses your browser’s speech service, which may process audio remotely. Only text goes to the drafter. AI updates use your shared allowance; building and simulation are free.</p>
  </section>;
}
