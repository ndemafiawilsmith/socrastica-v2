import { findExercise } from './exercises';
export function authDestination(next:string|null|undefined){
 if(next==='/studio'||next==='/instructor'||next==='/exercises')return next;
 if(next?.startsWith('/learn/')&&findExercise(next.slice(7)))return next;
 return '/exercises';
}
