const {test} = require('node:test');
const assert = require('node:assert/strict');
const {grade} = require('./grade.cjs');
test('grades correct TypeScript and rejects incorrect results', async()=>{
  assert.equal((await grade('function containsDuplicate(nums:number[]):boolean { return new Set(nums).size !== nums.length; }')).passed,true);
  assert.equal((await grade('function containsDuplicate(nums:number[]):boolean { return false; }')).passed,false);
  assert.equal((await grade('function containsDuplicate(){ return "true"; }')).passed,false);
});
test('student code cannot access Node, network, or host environment',async()=>{
  assert.equal((await grade('function containsDuplicate(nums) { if(typeof process!=="undefined" || typeof require!=="undefined" || typeof fetch!=="undefined") return false; return new Set(nums).size !== nums.length; }')).passed,true);
  assert.equal((await grade('function containsDuplicate(){return process.env.AWS_SECRET_ACCESS_KEY;}')).passed,false);
});
test('stops loops, rejects modules, and isolates test contexts',async()=>{
  assert.equal((await grade('function containsDuplicate(){while(true){}}')).passed,false);
  assert.equal((await grade('import fs from "fs";')).passed,false);
  const result = await grade('let calls=0; function containsDuplicate(nums) { calls++; return calls===1 && new Set(nums).size!==nums.length; }');
  assert.equal(result.passed,true);
});
