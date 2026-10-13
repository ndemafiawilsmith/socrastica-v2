import { z } from 'zod';
export type Value = number | string | boolean | number[];
export const operations = {
  multiply: ['Multiply', 'Scale a number by a factor.', true], divide: ['Divide', 'Split a number into equal parts.', true],
  add: ['Add', 'Increase a number by an amount.', true], subtract: ['Subtract', 'Take an amount away.', true],
  round: ['Round', 'Keep this many decimal places.', true], remainder: ['Remainder', 'Find what is left after division.', true],
  equals: ['Equals?', 'Return true when the number matches.', true], greater: ['Greater than?', 'Return true when the number is larger.', true],
  sum: ['Add the list', 'Loop through the list and add each number to a running total.', false],
  product: ['Multiply the list', 'Loop through the list and multiply its numbers together.', false],
  count: ['Count items', 'Find how many items are in a list.', false], even: ['Keep even numbers', 'Loop through the list. Keep numbers with no remainder when divided by two.', false],
  averageCount: ['Divide by original count', 'Divide the total by how many numbers came in. An empty list gives zero.', false],
  largest: ['Find the largest', 'Compare each number with the largest seen so far. An empty list gives zero.', false],
  smallest: ['Find the smallest', 'Compare each number with the smallest seen so far. An empty list gives zero.', false],
  sort: ['Sort low to high', 'Compare numbers and arrange them in increasing order.', false],
  reverse: ['Reverse text', 'Read the characters from the end to the beginning.', false],
  lowercase: ['Use lowercase', 'Make capital and lowercase letters match.', false],
  trimSpaces: ['Remove spaces', 'Remove whitespace from the text.', false],
  palindrome: ['Compare with reverse', 'Check whether the text is the same when read backwards.', false],
  textLength: ['Count characters', 'Count the characters in the text.', false],
} as const;
export type Operation = keyof typeof operations;
export const planSchema = z.array(z.object({op:z.enum(Object.keys(operations) as [Operation,...Operation[]]),amount:z.number().finite().min(-1e6).max(1e6).optional()}).strict()).max(12);
export type Plan = z.infer<typeof planSchema>;
export const inputSchema = z.union([z.number().finite().min(-1e9).max(1e9),z.string().max(500),z.array(z.number().finite().min(-1e9).max(1e9)).max(100)]);
export type Input = z.infer<typeof inputSchema>;
type Category = 'Money'|'Numbers'|'Lists'|'Text';
export type Exercise = {id:string;title:string;description:string;category:Category;level:'Starter'|'Developing';goal:string;concepts:string[];sample:Input;solution:Plan;cases:Input[];inputKind:'number'|'list'|'text';nonnegative?:boolean;pair?:boolean;integer?:boolean;hint:string};
const arithmetic=(op:Operation,amount:number):Plan[number]=>({op,amount});
const cents=arithmetic('round',2);
const numberCases=[0,1,20,99,1500,4500,30000];
export const exercises:Exercise[] = [
 {id:'naira-to-dollar',title:'Naira to dollars',description:'Turn a naira amount into US dollars.',category:'Money',level:'Starter',goal:'Convert naira to dollars using the practice rate ₦1,500 = $1. Round to two decimal places. This is a fixed learning example, not a live exchange rate.',concepts:['Division','Rounding'],sample:4500,solution:[arithmetic('divide',1500),cents],cases:[...numberCases,1.5,2250,999999],inputKind:'number',nonnegative:true,hint:'₦1,500 makes one dollar. How many groups of 1,500 fit inside your amount?'},
 {id:'dollar-to-naira',title:'Dollars to naira',description:'Convert dollars at a fixed practice rate.',category:'Money',level:'Starter',goal:'Convert dollars to naira using the practice rate $1 = ₦1,500. Round to two decimal places. This is not a live exchange rate.',concepts:['Multiplication','Rounding'],sample:3,solution:[arithmetic('multiply',1500),cents],cases:[0,1,.5,2.25,3,12.99,100],inputKind:'number',nonnegative:true,hint:'Each dollar is worth 1,500 naira in this example. What should happen for three dollars?'},
 {id:'discount-price',title:'A shop discount',description:'Find the price after a 20% discount.',category:'Money',level:'Starter',goal:'Return the price after taking 20% off. Round to two decimal places.',concepts:['Percentages','Multiplication'],sample:5000,solution:[arithmetic('multiply',.8),cents],cases:[0,1,100,5000,199.99,1250.75],inputKind:'number',nonnegative:true,hint:'After a 20% discount, you still pay 80% of the price.'},
 {id:'tip-total',title:'Add a restaurant tip',description:'Add a 10% tip to a restaurant bill.',category:'Money',level:'Starter',goal:'Return the bill plus a 10% tip, rounded to two decimal places.',concepts:['Percentages','Rounding'],sample:2000,solution:[arithmetic('multiply',1.1),cents],cases:[0,1,25,2000,99.99,123.45],inputKind:'number',nonnegative:true,hint:'The original bill is 100%. With a 10% tip, what percentage do you pay?'},
 {id:'celsius-fahrenheit',title:'Celsius to Fahrenheit',description:'Convert a temperature into another unit.',category:'Numbers',level:'Starter',goal:'Use Fahrenheit = Celsius × 1.8 + 32. Round to two decimal places.',concepts:['Order of steps','Multiplication'],sample:25,solution:[arithmetic('multiply',1.8),arithmetic('add',32),cents],cases:[-40,-10,0,25,37,100,12.34],inputKind:'number',hint:'Multiplication comes before addition in this formula. Test zero degrees.'},
 {id:'fahrenheit-celsius',title:'Fahrenheit to Celsius',description:'Work backwards through a temperature formula.',category:'Numbers',level:'Developing',goal:'Use Celsius = (Fahrenheit − 32) ÷ 1.8. Round to two decimal places.',concepts:['Order of steps','Division'],sample:77,solution:[arithmetic('subtract',32),arithmetic('divide',1.8),cents],cases:[-40,0,32,77,98.6,212,40.5],inputKind:'number',hint:'Undo the addition first, then undo the multiplication.'},
 {id:'minutes-seconds',title:'Minutes to seconds',description:'Turn a length of time into seconds.',category:'Numbers',level:'Starter',goal:'Return the number of seconds in the given minutes. Fractions of a minute are allowed.',concepts:['Units','Multiplication'],sample:2.5,solution:[arithmetic('multiply',60)],cases:[0,.5,1,2.5,10,60],inputKind:'number',nonnegative:true,hint:'One minute has 60 seconds. What about half a minute?'},
 {id:'rectangle-area',title:'Area of a rectangle',description:'Use two side lengths to find the area.',category:'Numbers',level:'Starter',goal:'The input is [width, height]. Return width × height. Both lengths must be nonnegative.',concepts:['Lists as inputs','Multiplication'],sample:[4,3],solution:[{op:'product'}],cases:[[0,3],[4,3],[1,1],[2.5,4],[10,20]],inputKind:'list',nonnegative:true,pair:true,hint:'Multiply the two side lengths. Adding them measures something different.'},
 {id:'rectangle-perimeter',title:'Around a rectangle',description:'Find the distance around all four sides.',category:'Numbers',level:'Developing',goal:'The input is [width, height]. Return 2 × (width + height). Both lengths must be nonnegative.',concepts:['Multiple steps','Lists'],sample:[4,3],solution:[{op:'sum'},arithmetic('multiply',2)],cases:[[0,3],[4,3],[1,1],[2.5,4],[10,20]],inputKind:'list',nonnegative:true,pair:true,hint:'There are two widths and two heights. Add a width and height, then double the result.'},
 {id:'even-number',title:'Even or odd?',description:'Decide whether a whole number is even.',category:'Numbers',level:'Starter',goal:'Return true for an even whole number and false for an odd one. Include zero and negative numbers.',concepts:['Remainders','Decisions'],sample:7,solution:[arithmetic('remainder',2),arithmetic('equals',0)],cases:[0,1,2,7,12,-3,-4,1001],inputKind:'number',integer:true,hint:'An even number leaves no remainder when divided by two.'},
 {id:'positive-number',title:'Is it positive?',description:'Make a decision about a number.',category:'Numbers',level:'Starter',goal:'Return true only when the number is greater than zero. Zero is not positive.',concepts:['Comparisons','Booleans'],sample:-4,solution:[arithmetic('greater',0)],cases:[-100,-4,-.1,0,.1,1,100],inputKind:'number',hint:'Pay attention to zero. Does “greater than” include it?'},
 {id:'sum-list',title:'Add a list of numbers',description:'Keep a running total as you go.',category:'Lists',level:'Starter',goal:'Return the total of all numbers. An empty list returns zero.',concepts:['Loops','Running totals'],sample:[3,5,2],solution:[{op:'sum'}],cases:[[],[1],[3,5,2],[-3,3],[1.5,2.5],[0,0],[1,2,3,4,5]],inputKind:'list',hint:'Start the total at zero. Add each number as you visit it.'},
 {id:'average-list',title:'Find the average',description:'Use the total and the number of items.',category:'Lists',level:'Developing',goal:'Add all numbers, divide by their original count, and round to two decimal places. An empty list returns zero.',concepts:['Loops','Division','Empty inputs'],sample:[10,20,30],solution:[{op:'sum'},{op:'averageCount'},cents],cases:[[],[1],[10,20,30],[-3,3],[1,2,2],[.1,.2]],inputKind:'list',hint:'First find the total. Divide by how many numbers you started with. What if there are none?'},
 {id:'count-even',title:'Count the even numbers',description:'Keep the numbers that match a rule.',category:'Lists',level:'Developing',goal:'Return how many even whole numbers are in the list. An empty list returns zero.',concepts:['Filtering','Counting'],sample:[1,2,3,4,6],solution:[{op:'even'},{op:'count'}],cases:[[],[1],[0],[-4,-3,2],[1,2,3,4,6],[2,2,2]],inputKind:'list',integer:true,hint:'First keep the even numbers. Then count the ones that remain.'},
 {id:'largest-number',title:'Find the largest number',description:'Compare values as you move through a list.',category:'Lists',level:'Developing',goal:'Return the largest number. For this activity, an empty list returns zero.',concepts:['Loops','Comparisons'],sample:[3,12,7],solution:[{op:'largest'}],cases:[[],[1],[3,12,7],[-9,-2,-5],[0,0],[.5,.25]],inputKind:'list',hint:'For a nonempty list, start with its first number. Starting at zero would fail a list of negative numbers.'},
 {id:'smallest-number',title:'Find the smallest number',description:'Keep track of the lowest value.',category:'Lists',level:'Developing',goal:'Return the smallest number. For this activity, an empty list returns zero.',concepts:['Loops','Comparisons'],sample:[3,12,7],solution:[{op:'smallest'}],cases:[[],[1],[3,12,7],[-9,-2,-5],[0,0],[.5,.25]],inputKind:'list',hint:'Compare each number with the smallest so far. Start with the first item, not zero.'},
 {id:'sort-list',title:'Put numbers in order',description:'Arrange numbers from lowest to highest.',category:'Lists',level:'Developing',goal:'Return a list sorted from low to high. Keep repeated values and handle negative numbers.',concepts:['Sorting','Numeric comparisons'],sample:[10,2,5],solution:[{op:'sort'}],cases:[[],[1],[10,2,5],[-1,-9,0],[2,2,1],[100,20,3]],inputKind:'list',hint:'Compare numbers by their value. Text-style sorting would put 10 before 2.'},
 {id:'reverse-text',title:'Reverse a word',description:'Read text from the end to the start.',category:'Text',level:'Starter',goal:'Return the characters in reverse order. Keep spaces, punctuation, and capital letters.',concepts:['Text','Order'],sample:'hello',solution:[{op:'reverse'}],cases:['','a','hello','Hi!','a b','🙂ab'],inputKind:'text',hint:'The last character becomes the first. Remember that a space is a character too.'},
 {id:'palindrome',title:'Same forwards and backwards?',description:'Check words like “level” and “racecar”.',category:'Text',level:'Developing',goal:'Ignore capitalization and spaces. Return true if the text reads the same forwards and backwards. Empty text returns true.',concepts:['Text cleaning','Comparisons'],sample:'Never odd or even',solution:[{op:'lowercase'},{op:'trimSpaces'},{op:'palindrome'}],cases:['','a','level','hello','RaceCar','Never odd or even','a b a','ab!'],inputKind:'text',hint:'Make letters lowercase and remove spaces before comparing the text with its reverse.'},
 {id:'text-length',title:'Count the characters',description:'Measure text, including spaces.',category:'Text',level:'Starter',goal:'Return how many characters are in the text, including spaces and punctuation. A single-symbol emoji like 🙂 counts as one character.',concepts:['Text','Counting'],sample:'hello!',solution:[{op:'textLength'}],cases:['','a','hello!','a b','🙂ab','12345'],inputKind:'text',hint:'Count characters, not words. An empty string has zero.'},
];
export const findExercise = (id:string) => exercises.find(exercise=>exercise.id===id);
export function validateInput(exercise:Exercise,input:unknown):Input {
  const value=inputSchema.parse(input);
  if(exercise.inputKind==='number'&&typeof value!=='number'||exercise.inputKind==='list'&&!Array.isArray(value)||exercise.inputKind==='text'&&typeof value!=='string')throw new Error(`Use a ${exercise.inputKind==='list'?'list of numbers':exercise.inputKind==='text'?'text string':'number'} for this activity.`);
  const numbers=Array.isArray(value)?value:typeof value==='number'?[value]:[];
  if(exercise.nonnegative&&numbers.some(n=>n<0))throw new Error('Use nonnegative values for this activity.');
  if(exercise.integer&&numbers.some(n=>!Number.isInteger(n)))throw new Error('Use whole numbers for this activity.');
  if(exercise.pair&&(!Array.isArray(value)||value.length!==2))throw new Error('Use exactly two side lengths: [width, height].');
  return value;
}
export function runPlan(plan:Plan,input:Input){
  let value:Value=Array.isArray(input)?[...input]:input;
  const frames:{step:number;value:Value;note:string}[]=[{step:-1,value,note:'Receive the input.'}];
  for(let i=0;i<plan.length;i++){
    const {op,amount}=plan[i];
    try {
      if(operations[op][2]&&amount===undefined)throw new Error('Set the number for this block.');
      const n=()=>{if(typeof value!=='number')throw new Error('This block needs a number.');return value;};
      const list=()=>{if(!Array.isArray(value))throw new Error('This block needs a list of numbers.');return value;};
      const text=()=>{if(typeof value!=='string')throw new Error('This block needs text.');return value;};
      switch(op){
        case 'multiply':value=n()*amount!;break;case 'divide':if(!amount)throw new Error('Cannot divide by zero.');value=n()/amount;break;
        case 'add':value=n()+amount!;break;case 'subtract':value=n()-amount!;break;
        case 'round':if(!Number.isInteger(amount)||amount!<0||amount!>6)throw new Error('Use 0 to 6 decimal places.');value=Math.round((n()+Number.EPSILON)*10**amount!)/10**amount!;break;
        case 'remainder':if(!amount)throw new Error('Cannot divide by zero.');value=n()%amount;break;
        case 'equals':value=n()===amount;break;case 'greater':value=n()>amount!;break;
        case 'sum':value=list().reduce((total,n)=>total+n,0);break;case 'product':value=list().reduce((total,n)=>total*n,1);break;
        case 'count':value=list().length;break;case 'even':value=list().filter(n=>n%2===0);break;
        case 'averageCount':if(!Array.isArray(input))throw new Error('The original input must be a list.');value=input.length?n()/input.length:0;break;
        case 'largest':{const values=list();value=values.length?Math.max(...values):0;break;}
        case 'smallest':{const values=list();value=values.length?Math.min(...values):0;break;}
        case 'sort':value=[...list()].sort((a,b)=>a-b);break;case 'reverse':value=Array.from(text()).reverse().join('');break;
        case 'lowercase':value=text().toLowerCase();break;case 'trimSpaces':value=text().replace(/\s/g,'');break;
        case 'palindrome':{const word=text();value=word===Array.from(word).reverse().join('');break;}
        case 'textLength':value=Array.from(text()).length;break;
      }
      if(typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>1e15))throw new Error('The result is outside the practice limits.');
      frames.push({step:i,value,note:operations[op][1]});
    }catch(error){return {frames,error:error instanceof Error?error.message:'This step could not run.',failedStep:i,result:value};}
  }
  return {frames,result:value,error:null,failedStep:null};
}
export function sameValue(a:Value,b:Value):boolean {return typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)):JSON.stringify(a)===JSON.stringify(b);}
export function checkPlan(exercise:Exercise,plan:Plan){return exercise.cases.map(input=>{const trace=runPlan(plan,input),expected=runPlan(exercise.solution,input).result;return {input,expected,actual:trace.result,passed:plan.length>0&&!trace.error&&sameValue(trace.result,expected),error:trace.error};});}
export const planKey=(plan:Plan)=>JSON.stringify(plan);
export function codeForPlan(plan:Plan){
 const lines=['function solve(input: number | number[] | string): number | number[] | string | boolean {','  let value: any = Array.isArray(input) ? [...input] : input;'];
 plan.forEach(({op,amount},index)=>{
  const expressions:Record<Operation,string>={multiply:`value * ${amount}`,divide:`value / ${amount}`,add:`value + ${amount}`,subtract:`value - ${amount}`,round:`Math.round((value + Number.EPSILON) * ${10**(amount||0)}) / ${10**(amount||0)}`,remainder:`value % ${amount}`,equals:`value === ${amount}`,greater:`value > ${amount}`,sum:'value.reduce((total: number, n: number) => total + n, 0)',product:'value.reduce((total: number, n: number) => total * n, 1)',count:'value.length',even:'value.filter((n: number) => n % 2 === 0)',averageCount:'(input as number[]).length ? value / (input as number[]).length : 0',largest:'value.length ? Math.max(...value) : 0',smallest:'value.length ? Math.min(...value) : 0',sort:'[...value].sort((a: number, b: number) => a - b)',reverse:"Array.from(value as string).reverse().join('')",lowercase:'value.toLowerCase()',trimSpaces:"value.replace(/\\s/g, '')",palindrome:"value === Array.from(value as string).reverse().join('')",textLength:'Array.from(value as string).length'};
  lines.push(`  // Step ${index+1}: ${operations[op][0]}`,`  value = ${expressions[op]};`);
 });lines.push('  return value;','}');return lines.join('\n');
}
