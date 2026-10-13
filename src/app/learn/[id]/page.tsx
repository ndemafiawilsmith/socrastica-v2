import { notFound,redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { findExercise } from '@/lib/exercises';
import ExerciseWorkspace from '@/components/ExerciseWorkspace';
export default async function ExercisePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params,exercise=findExercise(id);if(!exercise)notFound();
 const db=await serverClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect(`/login?next=/learn/${exercise.id}`);
 return <ExerciseWorkspace key={exercise.id} exercise={exercise}/>;
}
