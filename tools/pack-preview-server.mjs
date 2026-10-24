import {createServer} from 'node:http';
export async function startV3Preview(source,{port=0}={}){
 const server=createServer((req,res)=>{res.writeHead(503,{'content-type':'text/html'});res.end('<!doctype html><p>Inert v3 preview stub.</p>');});
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',done);});return{server,url:'http://127.0.0.1:'+server.address().port};
}
