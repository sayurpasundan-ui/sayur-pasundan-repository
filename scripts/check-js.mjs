import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root=process.cwd();const found=[];
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(["node_modules",".wrangler"].includes(entry.name))continue;const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else if(p.endsWith(".js")||p.endsWith(".mjs"))found.push(p);}}
await walk(root);let failed=0;
for(const file of found){const result=spawnSync(process.execPath,["--check",file],{encoding:"utf8"});if(result.status!==0){failed++;console.error(`FAIL ${path.relative(root,file)}\n${result.stderr||result.stdout}`);}else console.log(`OK   ${path.relative(root,file)}`);}
if(failed){console.error(`\n${failed} file gagal diperiksa.`);process.exit(1);}console.log(`\nSemua ${found.length} file JavaScript lolos syntax check.`);
