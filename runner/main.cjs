const {grade} = require('./grade.cjs');
// No cloud credentials/task role. Only two short-lived, object-specific URLs.
const watchdog = setTimeout(()=>process.exit(2), 45000);
async function main() {
  const inputURL = process.env.JOB_INPUT_URL;
  const resultURL = process.env.JOB_RESULT_URL;
  if (!inputURL || !resultURL) throw new Error('Missing job URLs');
  delete process.env.JOB_INPUT_URL; delete process.env.JOB_RESULT_URL;
  const response = await fetch(inputURL, {signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('Input unavailable');
  const body = await response.text();
  if (Buffer.byteLength(body)>65000) throw new Error('Input too large');
  const job = JSON.parse(body);
  const result = await grade(job.code);
  const upload = await fetch(resultURL,{method:'PUT', headers:{'Content-Type':'application/json'},body:JSON.stringify(result),signal:AbortSignal.timeout(12000)});
  if (!upload.ok) throw new Error('Result upload failed');
  console.log('Execution completed.');
}
main().catch(()=>{console.error('Execution failed; sensitive details omitted.');process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
