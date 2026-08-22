// Whitelist-HTML-sanitatie voor de MASS-scheepswrakomschrijvingen (018-mass-
// scheepswrakken.md) - de eerste plek in Doorzoeker die ruwe HTML uit een
// externe bron rendert in plaats van platte SPARQL-literal-tekst. MASS is
// een wiki-achtig, door individuele vrijwilligers bewerkt systeem (zie de
// wisselende `sdo:creator`-namen), dus de HTML moet als onvertrouwd worden
// behandeld, ook al is er geen concrete aanwijzing voor kwaadaardige inhoud.
//
// Bewust geen regex-op-de-hele-string (kan HTML principieel niet correct
// parsen - aanhalingstekens, comments, malformed markup breken dat al snel
// stil) en bewust geen dependency zoals sanitize-html/htmlparser2 (trekt
// postcss/domutils/enz. mee, terwijl Doorzoeker consequent hand-rolled
// parsers gebruikt waar de scope beperkt genoeg is - zie lib/rce/geometry.ts
// voor hetzelfde patroon bij WKT). In plaats daarvan: een echte
// karakter-voor-karakter tokenizer die aanhalingstekens binnen attributen
// correct bijhoudt, met een expliciete toegestane-tags/attributenlijst
// (018-mass-scheepswrakken.md, beslissing 2, bevestigd door de eigenaar).

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  h1: [],
  h2: [],
  h3: [],
  p: [],
  ul: [],
  ol: [],
  li: [],
  a: ["href"],
  img: ["src", "alt"],
  figure: [],
  figcaption: [],
  strong: [],
  em: [],
  br: [],
  table: [],
  tbody: [],
  tr: [],
  th: [],
  td: [],
};

// Tags waarvan ook de inhoud volledig weg moet - niet alleen de tag zelf
// (in tegenstelling tot bv. <div>, die wordt "uitgepakt": tag weg, inhoud
// blijft). Een <script>- of <style>-lichaam is geen leesbare tekst en mag
// nooit zichtbaar worden, ook niet als kale tekst.
const STRIP_CONTENT_TAGS = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template"]);

const VOID_TAGS = new Set(["br", "img"]);

// HTML staat karakterverwijzingen (&#58; of &#x3a;) toe in attribuutwaarden
// en decodeert die tijdens attribute-value tokenizing, vóórdat de browser de
// waarde als URL gebruikt - "javascript&#58;alert(1)" bevat dus geen
// letterlijke ":" op het moment dat hieronder gecontroleerd wordt, maar
// wordt door de browser alsnog als "javascript:alert(1)" geïnterpreteerd.
// Gemeld door een externe review (22-08-2026), geverifieerd tegen de HTML
// Standard (whatwg.org/#attribute-value-(double-quoted)-state). Decodeer
// daarom eerst, zodat het schema niet in een karakterverwijzing verstopt kan
// worden.
function decodeEntitiesForUrlCheck(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_match, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&amp;?/gi, "&");
}

// Allowlist in plaats van blokkeerlijst: een blokkeerlijst moet elk gevaarlijk
// schema kennen (en elke manier om het te verbergen), een allowlist hoeft
// alleen te weten wat wél mag. Relatieve URL's (geen schema) horen altijd bij
// de eigen origin en zijn dus altijd toegestaan.
function isAllowedUrl(value: string, allowedSchemes: ReadonlySet<string>): boolean {
  // Zelfde tab/regeleinde-omzeiling als voorheen ("java\tscript:") blijft
  // afgevangen door alle whitespace te verwijderen vóór de schema-check.
  const normalized = decodeEntitiesForUrlCheck(value).trim().replace(/\s/g, "").toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(normalized)?.[1];
  return !scheme || allowedSchemes.has(`${scheme}:`);
}

const ALLOWED_LINK_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:", "mailto:"]);
const ALLOWED_IMAGE_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:"]);

// Geen &-escaping: de brondata levert al correct geëncodeerde entiteiten
// (bv. &rsquo;) door - die blindelings ook nog eens escapen zou er
// &amp;rsquo; van maken en zichtbaar corrumperen. Een kale "&" zonder
// entiteit erachter is in HTML altijd veilig als losse tekst; dit is geen
// XSS-vector, alleen "<"/">" markeren echte opmaak.
function escapeText(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttributeValue(value: string): string {
  return value.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type ParsedTag = {
  closing: boolean;
  name: string;
  attributes: Map<string, string>;
  selfClosing: boolean;
  nextIndex: number;
};

// Leest één tag vanaf `start` (de positie van '<'). Loopt karakter voor
// karakter door de attributen zodat een '>' binnen een aanhalingsteken
// (bv. href="foo>bar") niet per ongeluk het einde van de tag lijkt - precies
// de fout waarom een simpele regex hier niet volstaat.
function parseTag(html: string, start: number): ParsedTag | undefined {
  let i = start + 1;
  const closing = html[i] === "/";
  if (closing) i++;
  const nameStart = i;
  while (i < html.length && /[a-zA-Z0-9]/.test(html[i])) i++;
  if (i === nameStart) return undefined;
  const name = html.slice(nameStart, i).toLowerCase();
  const attributes = new Map<string, string>();
  let selfClosing = false;
  while (i < html.length) {
    while (i < html.length && /\s/.test(html[i])) i++;
    if (html[i] === ">") {
      i++;
      break;
    }
    if (html[i] === "/" && html[i + 1] === ">") {
      selfClosing = true;
      i += 2;
      break;
    }
    if (i >= html.length) return undefined;
    const attrNameStart = i;
    while (i < html.length && /[^\s=/>]/.test(html[i])) i++;
    if (i === attrNameStart) return undefined;
    const attrName = html.slice(attrNameStart, i).toLowerCase();
    while (i < html.length && /\s/.test(html[i])) i++;
    let attrValue = "";
    if (html[i] === "=") {
      i++;
      while (i < html.length && /\s/.test(html[i])) i++;
      const quote = html[i] === '"' || html[i] === "'" ? html[i] : undefined;
      if (quote) {
        i++;
        const valueStart = i;
        while (i < html.length && html[i] !== quote) i++;
        attrValue = html.slice(valueStart, i);
        i++;
      } else {
        const valueStart = i;
        while (i < html.length && !/[\s>]/.test(html[i])) i++;
        attrValue = html.slice(valueStart, i);
      }
    }
    attributes.set(attrName, attrValue);
  }
  return { closing, name, attributes, selfClosing, nextIndex: i };
}

// Rendert de omschrijving van een MASS-scheepswrak naar veilige HTML voor
// dangerouslySetInnerHTML. `imageBaseUrl` lost relatieve <img src="/photos/
// ...">-paden op (de brondata embedt alleen relatieve paden, geen absolute
// URL's - zie 018-mass-scheepswrakken.md, bevinding 6).
export function sanitizeMassDescriptionHtml(html: string, imageBaseUrl: string): string {
  let out = "";
  let i = 0;
  let skipDepth = 0;
  const skipTagName: string[] = [];
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      if (skipDepth === 0) out += escapeText(html.slice(i));
      break;
    }
    if (skipDepth === 0) out += escapeText(html.slice(i, lt));

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      const end = html.indexOf(">", lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    const tag = parseTag(html, lt);
    if (!tag) {
      // Geen geldige tag ("<" die geen markup blijkt) - als kale tekst
      // tonen i.p.v. laten verdwijnen, wél geëscaped.
      if (skipDepth === 0) out += "&lt;";
      i = lt + 1;
      continue;
    }
    i = tag.nextIndex;

    if (STRIP_CONTENT_TAGS.has(tag.name)) {
      if (tag.closing) {
        if (skipDepth > 0 && skipTagName[skipTagName.length - 1] === tag.name) {
          skipTagName.pop();
          skipDepth--;
        }
      } else if (!tag.selfClosing) {
        skipTagName.push(tag.name);
        skipDepth++;
      }
      continue;
    }
    if (skipDepth > 0) continue;

    const allowedAttrs = ALLOWED_ATTRIBUTES[tag.name];
    if (allowedAttrs === undefined) {
      // Onbekende/niet-toegestane tag: "uitpakken" - de tag zelf verdwijnt,
      // de inhoud blijft gewoon staan (bv. de <div lang="en">-wrappers in de
      // brondata dragen geen betekenis die verloren mag gaan).
      continue;
    }
    if (VOID_TAGS.has(tag.name) && !tag.closing) {
      out += renderOpenTag(tag, allowedAttrs, imageBaseUrl);
      continue;
    }
    if (tag.closing) {
      out += `</${tag.name}>`;
    } else {
      out += renderOpenTag(tag, allowedAttrs, imageBaseUrl);
      if (tag.selfClosing) out += `</${tag.name}>`;
    }
  }
  return out;
}

function renderOpenTag(tag: ParsedTag, allowedAttrs: string[], imageBaseUrl: string): string {
  const parts = [tag.name];
  for (const attrName of allowedAttrs) {
    let value = tag.attributes.get(attrName);
    if (value === undefined) continue;
    if (attrName === "href" && !isAllowedUrl(value, ALLOWED_LINK_SCHEMES)) continue;
    if (attrName === "src" && !isAllowedUrl(value, ALLOWED_IMAGE_SCHEMES)) continue;
    if (attrName === "src" && value.startsWith("/")) value = imageBaseUrl + value;
    parts.push(`${attrName}="${escapeAttributeValue(value)}"`);
  }
  return `<${parts.join(" ")}>`;
}
