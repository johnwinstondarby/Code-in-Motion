import test from 'node:test';
import assert from 'node:assert/strict';
import {rewriteSources} from '../tools/ci/ubuntu-apt-mirror.mjs';

test('Deb822 mirror change preserves suite, components, signature key and CRLF',()=>{
 const source='Types: deb\r\nURIs: http://azure.archive.ubuntu.com/ubuntu/\r\nSuites: noble noble-updates noble-backports\r\nComponents: main restricted universe multiverse\r\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\r\n';
 const result=rewriteSources(source);
 assert.equal(result,source.replace('http://azure.archive.ubuntu.com/ubuntu/','https://archive.ubuntu.com/ubuntu/'));
 assert(!/trusted=yes|allow-insecure|AllowUnauthenticated/.test(result));
});
test('legacy list changes only the official archive URI and preserves repository options',()=>{
 const source='# http://azure.archive.ubuntu.com/ubuntu\n'+'deb [arch=amd64 signed-by=/keys/ubuntu.gpg] http://azure.archive.ubuntu.com/ubuntu noble main\n'+'deb-src https://azure.archive.ubuntu.com/ubuntu/ noble-updates universe\n'+'deb https://security.ubuntu.com/ubuntu noble-security main\n';
 const result=rewriteSources(source);
 assert.equal(result,'# http://azure.archive.ubuntu.com/ubuntu\n'+'deb [arch=amd64 signed-by=/keys/ubuntu.gpg] https://archive.ubuntu.com/ubuntu noble main\n'+'deb-src https://archive.ubuntu.com/ubuntu/ noble-updates universe\n'+'deb https://security.ubuntu.com/ubuntu noble-security main\n');
});
test('similar hosts, paths, comments and unrelated fields are never rewritten',()=>{
 const source=['URIs: https://azure.archive.ubuntu.com.evil.invalid/ubuntu','URIs: http://azure.archive.ubuntu.com/ubuntu-evil','URIs: https://archive.ubuntu.com/ubuntu','Other: http://azure.archive.ubuntu.com/ubuntu','# URIs: http://azure.archive.ubuntu.com/ubuntu','URIs: https://packages.example.invalid/ubuntu'].join('\n');
 assert.equal(rewriteSources(source),source);
});
test('invalid non-text source input is rejected without coercion',()=>{
 for(const source of [null,{},Buffer.from('URIs: anything'),42])assert.throws(()=>rewriteSources(source),TypeError);
});
