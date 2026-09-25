import dns from 'node:dns/promises';
import net from 'node:net';

const blocked = new net.BlockList();
for (const [addr,prefix,family] of [
  ['0.0.0.0',8,'ipv4'],['10.0.0.0',8,'ipv4'],['100.64.0.0',10,'ipv4'],['127.0.0.0',8,'ipv4'],
  ['169.254.0.0',16,'ipv4'],['172.16.0.0',12,'ipv4'],['192.0.0.0',24,'ipv4'],['192.0.2.0',24,'ipv4'],
  ['192.168.0.0',16,'ipv4'],['198.18.0.0',15,'ipv4'],['198.51.100.0',24,'ipv4'],['203.0.113.0',24,'ipv4'],
  ['224.0.0.0',4,'ipv4'],['240.0.0.0',4,'ipv4'],
  ['::',128,'ipv6'],['::1',128,'ipv6'],['fc00::',7,'ipv6'],['fe80::',10,'ipv6'],['ff00::',8,'ipv6'],['2001:db8::',32,'ipv6']
]) blocked.addSubnet(addr,prefix,family);

export function isBlockedIp(ip) {
  const family = net.isIP(ip);
  if (!family) return false;
  return blocked.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

export async function resolveTarget(raw, opts={}) {
  const {allowHttp=false,allowPrivate=false} = opts;
  let url;
  try { url = new URL(raw); } catch { throw new Error('invalid_target_url'); }
  if (url.hash) throw new Error('url_fragment_not_allowed');
  if (!['https:', ...(allowHttp?['http:']:[])].includes(url.protocol)) throw new Error('unsupported_target_scheme');
  if (url.username || url.password) throw new Error('userinfo_not_allowed');
  if (!url.hostname) throw new Error('missing_hostname');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
    if (!allowPrivate) throw new Error('private_target_blocked');
  }
  let answers;
  if (net.isIP(url.hostname)) answers=[{address:url.hostname,family:net.isIP(url.hostname)}];
  else {
    answers = await dns.lookup(url.hostname,{all:true,verbatim:true});
    if (!answers.length) throw new Error('dns_no_answers');
  }
  const normalized=answers.map(a=>({address:a.address,family:Number(a.family)}));
  if (!allowPrivate && normalized.some(a=>isBlockedIp(a.address))) throw new Error('dns_resolves_blocked_range');
  const selected = normalized.find(a=>allowPrivate || !isBlockedIp(a.address));
  if (!selected) throw new Error('no_allowed_target_address');
  return {url,hostname:url.hostname,address:selected.address,family:selected.family,answers:normalized};
}

export async function validateTarget(raw, opts={}) { return (await resolveTarget(raw,opts)).url; }
