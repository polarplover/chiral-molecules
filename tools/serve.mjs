// No dependencies. Serves the project under both / and /socrates-question/ for Pages-path checks.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.md':'text/plain; charset=utf-8'};
createServer(async(req,res)=>{try{
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/socrates-question(?=\/)/,'');
  if(name.endsWith('/'))name+='index.html';
  const path=resolve(root,'.'+name);
  if(!path.startsWith(resolve(root)+sep)||name.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return;}
  const body=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`Local preview: http://127.0.0.1:${port}/socrates-question/`));
