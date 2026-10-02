const {spawnSync} = require('node:child_process');
const command = process.argv[2];
if (!['build','start'].includes(command)) throw new Error('Expected build or start');
const result=spawnSync(process.execPath,[require.resolve('next/dist/bin/next'),command,...process.argv.slice(3)],{stdio:'inherit',env:{...process.env,NEXT_DIST_DIR:'.next-build'}});
process.exit(result.status ?? 1);
