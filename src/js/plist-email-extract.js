/**
 * Parse Apple XML plist mobileconfig and extract email-related payloads into
 * a normalized shape for Android UI (no iOS-specific installation semantics).
 */

function parsePlistValue(el) {
  if (!el) return null;
  const t = el.tagName?.toLowerCase();
  if (t === 'string') return el.textContent ?? '';
  if (t === 'integer') return parseInt(el.textContent || '0', 10);
  if (t === 'real') return parseFloat(el.textContent || '0');
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'dict') return parsePlistDict(el);
  if (t === 'array') return [...el.children].map((c) => parsePlistValue(c));
  if (t === 'data') return null;
  return null;
}

function parsePlistDict(dictEl) {
  const obj = {};
  const children = [...dictEl.children];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.tagName !== 'key') continue;
    const key = child.textContent;
    const valEl = children[i + 1];
    if (!valEl) break;
    const v = parsePlistValue(valEl);
    if (key && key.toLowerCase().includes('password')) continue;
    obj[key] = v;
    i++;
  }
  return obj;
}

function collectPayloadDicts(node, out = []) {
  if (node == null) return out;
  if (Array.isArray(node)) {
    node.forEach((n) => collectPayloadDicts(n, out));
    return out;
  }
  if (typeof node === 'object') {
    if (node.PayloadType && isEmailRelatedPayload(node)) out.push(node);
    if (node.PayloadContent != null) {
      const pc = node.PayloadContent;
      collectPayloadDicts(Array.isArray(pc) ? pc : [pc], out);
    }
  }
  return out;
}

function isEmailRelatedPayload(p) {
  const pt = String(p.PayloadType || '');
  const low = pt.toLowerCase();
  return (
    low.includes('mail.managed') ||
    low.includes('eas.account') ||
    low.includes('exchange') ||
    (low.includes('mail') && low.includes('account'))
  );
}

function inferProtocol(payload) {
  const pt = String(payload.PayloadType || '');
  if (pt.includes('eas') || pt.includes('EAS') || pt.includes('exchange')) return 'exchange';
  const t = payload.EmailAccountType;
  if (t === 'EmailTypeIMAP' || t === 1) return 'imap';
  if (t === 'EmailTypePOP' || t === 0) return 'pop';
  if (payload.IncomingMailServerIMAPPathPrefix != null) return 'imap';
  if (payload.IncomingMailServerHostName && !payload.OutgoingMailServerHostName) return 'exchange';
  return 'imap';
}

function sslLabel(useSsl) {
  if (useSsl === false || useSsl === 0) return 'Off — not recommended';
  return 'On (SSL/TLS)';
}

function normalizeFromManagedMail(payload) {
  const protocol = inferProtocol(payload);
  const email = payload.EmailAddress || payload.EmailAccountName || '';
  const incSsl = payload.IncomingMailServerUseSSL !== false && payload.IncomingMailServerUseSSL !== 0;
  const outSsl = payload.OutgoingMailServerUseSSL !== false && payload.OutgoingMailServerUseSSL !== 0;
  const incPort =
    payload.IncomingMailServerPortNumber ||
    (protocol === 'imap' ? (incSsl ? 993 : 143) : incSsl ? 995 : 110);
  const outPort =
    payload.OutgoingMailServerPortNumber || (outSsl ? 465 : 587);

  return {
    source: 'managed-mail',
    protocol,
    displayName: payload.EmailAccountDescription || payload.EmailAccountName || '',
    emailAddress: String(email).trim(),
    incoming: {
      host: String(payload.IncomingMailServerHostName || '').trim(),
      port: incPort,
      ssl: incSsl,
      sslLabel: sslLabel(incSsl),
      username: String(
        payload.IncomingMailServerUsername || payload.EmailAddress || ''
      ).trim(),
      authentication: payload.IncomingMailServerAuthentication,
    },
    outgoing: {
      host: String(payload.OutgoingMailServerHostName || '').trim(),
      port: outPort,
      ssl: outSsl,
      sslLabel: sslLabel(outSsl),
      username: String(
        payload.OutgoingMailServerUsername || payload.EmailAddress || ''
      ).trim(),
      authentication: payload.OutgoingMailServerAuthentication,
    },
  };
}

function normalizeFromEas(payload) {
  const host = String(payload.Host || payload.EASHost || payload.Server || '').trim();
  const email = String(payload.EmailAddress || payload.UserName || '').trim();
  const ssl = payload.SSL !== false && payload.SSL !== 0;
  const port = payload.ServerPortNumber || 443;

  return {
    source: 'eas',
    protocol: 'exchange',
    displayName: payload.AccountDescription || '',
    emailAddress: email,
    incoming: {
      host,
      port,
      ssl,
      sslLabel: sslLabel(ssl),
      username: String(payload.UserName || email).trim(),
      authentication: 'Exchange',
    },
    outgoing: {
      host: host || '',
      port,
      ssl,
      sslLabel: sslLabel(ssl),
      username: String(payload.UserName || email).trim(),
      authentication: 'Exchange',
    },
  };
}

function normalizePayload(payload) {
  const pt = String(payload.PayloadType || '');
  if (pt.includes('eas.account') || pt.includes('EAS')) {
    return normalizeFromEas(payload);
  }
  if (pt.includes('mail.managed') || payload.IncomingMailServerHostName) {
    return normalizeFromManagedMail(payload);
  }
  return null;
}

/**
 * Build the same normalized shape as parse-from-plist, from documents.json
 * `mailSettingsForAndroid` when the hosted .mobileconfig is PKCS#7-signed (GoDaddy etc.)
 * and cannot be read in the browser.
 */
export function normalizedFromMailSettingsJson(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const protocol = spec.protocol === 'exchange' ? 'exchange' : 'imap';
  const emailAddress = String(spec.emailAddress || '').trim();
  const inc = spec.incoming || {};
  const out = spec.outgoing || {};
  const incSsl = inc.ssl !== false && inc.ssl !== 0;
  const outSsl = out.ssl !== false && out.ssl !== 0;
  const incPort =
    Number(inc.port) ||
    (protocol === 'imap' ? (incSsl ? 993 : 143) : incSsl ? 995 : 110);
  const outPort = Number(out.port) || (outSsl ? 465 : 587);

  return {
    source: 'documents-json',
    protocol,
    displayName: String(spec.displayName || '').trim(),
    emailAddress,
    incoming: {
      host: String(inc.host || '').trim(),
      port: incPort,
      ssl: incSsl,
      sslLabel: sslLabel(incSsl),
      username: String(inc.username || emailAddress || '').trim(),
      authentication: inc.authentication,
    },
    outgoing: {
      host: String(out.host || '').trim(),
      port: outPort,
      ssl: outSsl,
      sslLabel: sslLabel(outSsl),
      username: String(out.username || emailAddress || '').trim(),
      authentication: out.authentication,
    },
  };
}

/**
 * @param {string} url - absolute path to .mobileconfig on same origin
 * @returns {Promise<{ ok: boolean, normalized: object | null, reason?: string }>}
 */
export async function extractMailSettingsFromMobileConfigUrl(url) {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return { ok: false, normalized: null, reason: 'not-found' };

    const buf = await res.arrayBuffer();
    const u8 = new Uint8Array(buf);
    if (u8.length >= 6 && u8[0] === 0x62 && u8[1] === 0x70 && u8[2] === 0x6c && u8[3] === 0x69 && u8[4] === 0x73 && u8[5] === 0x74) {
      return { ok: false, normalized: null, reason: 'binary-plist' };
    }
    // GoDaddy / Apple signed configuration profiles (DER PKCS#7), not XML plist
    if (u8[0] === 0x30 && u8[1] === 0x82) {
      return { ok: false, normalized: null, reason: 'signed-pkcs7' };
    }
    if (u8[0] !== 0x3c) {
      return { ok: false, normalized: null, reason: 'not-xml' };
    }

    const text = new TextDecoder('utf-8').decode(buf);
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) {
      return { ok: false, normalized: null, reason: 'xml-error' };
    }

    const dictEl = doc.querySelector('plist > dict') || doc.querySelector('plist dict');
    if (!dictEl) return { ok: false, normalized: null, reason: 'no-plist' };

    const root = parsePlistDict(dictEl);
    const payloads = collectPayloadDicts(root).filter(isEmailRelatedPayload);
    if (!payloads.length) return { ok: false, normalized: null, reason: 'no-mail-payload' };

    for (const p of payloads) {
      const n = normalizePayload(p);
      if (n && (n.incoming.host || n.protocol === 'exchange')) return { ok: true, normalized: n };
    }

    const n = normalizePayload(payloads[0]);
    if (n) return { ok: true, normalized: n };
    return { ok: false, normalized: null, reason: 'unrecognized-payload' };
  } catch (e) {
    console.warn(e);
    return { ok: false, normalized: null, reason: 'network' };
  }
}
