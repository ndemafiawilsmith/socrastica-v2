import ExerciseLibrary from '@/components/ExerciseLibrary';
import { serverClient } from '@/lib/supabase/server';
export const metadata={title:'Exercises — Socrastica',description:'Practise currency conversion, numbers, lists, and text with visual plans and code.'};
export default async function ExercisesPage(){
 const db=await serverClient(),{data:{user}}=await db.auth.getUser();
 const progress:{exercise_id:string;verified:boolean;plan:unknown[]}[]=[];
 if(user){
  const [practice,studio]=await Promise.all([db.from('exercise_sessions').select('exercise_id,verified,plan').eq('user_id',user.id),db.from('learning_sessions').select('blueprint,draft_hash').eq('user_id',user.id).eq('challenge_id','contains-duplicate').maybeSingle()]);
  progress.push(...practice.data||[]);
  if(studio.data&&Array.isArray(studio.data.blueprint?.nodes)&&studio.data.blueprint.nodes.length>1)progress.push({exercise_id:'contains-duplicate',verified:!!studio.data.draft_hash,plan:studio.data.blueprint.nodes});
 }
 return <ExerciseLibrary progress={progress} signedIn={!!user}/>;
}
