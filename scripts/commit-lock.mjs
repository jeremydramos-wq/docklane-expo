
import {readFileSync,existsSync} from 'node:fs';
if(!process.env.GITHUB_TOKEN||!process.env.GITHUB_REPOSITORY)process.exit(0);
const url='https://api.github.com/repos/'+process.env.GITHUB_REPOSITORY+'/contents/package-lock.json';
const headers={Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
const existing=await fetch(url,{headers});
if(existing.ok)process.exit(0);
if(existing.status!==404)throw new Error('Could not check dependency lock status: '+existing.status);
if(!existsSync('package-lock.json'))throw new Error('Validated dependency lock is missing.');
const result=await fetch(url,{method:'PUT',headers,body:JSON.stringify({message:'Pin validated native dependency lock',branch:'main',content:readFileSync('package-lock.json').toString('base64')})});
if(!result.ok)throw new Error('Could not save validated dependency lock: '+result.status);
console.log('Saved validated dependency lock.');
