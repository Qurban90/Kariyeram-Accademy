# Təmiz mətnli test PDF-i + "test izah" PDF-i → idxal CSV-si (docs/templates/suallar-sablon.csv formatı).
# Giriş: ya iki mətn faylı (PDF-dən çıxarılmış mətn), ya da Claude Code sessiya jurnalı (.jsonl) və Drive-dakı fayl adları.
#   python3 law_parse.py <jurnal.jsonl | -> <test adı və ya fayl> <izah adı və ya fayl> <fənn kodu> <mövzu adı> <çıxış.csv> [istinad prefiksi]
# Skan olunmuş (OCR) PDF-lər üçün yaramır: onlar əl ilə təmizlənməlidir. Çıxış faylını repoya yazma.
# Yalnız 4 variantı tam olan və cavabı həm etalon cədvəli, həm də izah faylı ilə eyni olan suallar yazılır.
import csv, json, re, sys
tr, test_title, izah_title, subject, topic, out = sys.argv[1:7]
ref_prefix = sys.argv[7] if len(sys.argv) > 7 else ''

def find(title):
    if not tr.endswith('.jsonl'): return open(title, encoding='utf-8').read()
    best = None
    for line in open(tr, encoding='utf-8'):
        if title not in line: continue
        for m in re.finditer(r'\{\\?"fileContent\\?":', line):
            pass
        # tool nəticəsi JSON sətridir: içindəki ilk {"fileContent": ... "title": title ...} obyektini tap
        def walk(o):
            nonlocal best
            if isinstance(o, dict):
                for v in o.values(): walk(v)
            elif isinstance(o, list):
                for v in o: walk(v)
            elif isinstance(o, str) and '"fileContent"' in o and title in o:
                try:
                    d = json.loads(o)
                    if d.get('title') == title: best = d['fileContent']
                except Exception: pass
        try: walk(json.loads(line))
        except Exception: pass
    if best is None: sys.exit(f'tapılmadı: {title}')
    return best

FOOT = re.compile(r'\n\n\d{1,2}\n\n010 375 85 93 Dövlət Qulluğu-Magistratura Hazırladı: Əli Cümşüdov|010 375 85 93 Dövlət Qulluğu-Magistratura Hazırladı: Əli Cümşüdov')
def clean(s): return re.sub(r'\s+', ' ', s.replace('\\.', '.').replace('\\<', '<').replace('\\>', '>').replace('\\~', '~')).strip()

test = FOOT.sub('\n\n', find(test_title))
body, _, keypart = test.partition('ETALON CAVABLAR')
key = {int(n): l for n, l in re.findall(r'(\d{1,3}) ([A-E])\b', keypart)}
izah = FOOT.sub('\n\n', find(izah_title))
expl = {}
for m in re.finditer(r'(?:^|\n)\s*(\d{1,3}) → ([A-E]) ona görə ki (.*?)(?=\n\s*\d{1,3} → [A-E] ona görə ki |\Z)', izah, re.S):
    e = clean(m.group(3)); e = re.sub(r'\s+\d{1,2}$', '', e)
    expl[int(m.group(1))] = (m.group(2), e[0].upper() + e[1:])

# sualların başlanğıc mövqeləri: ardıcıl nömrələr
pos, n, at = [], 1, 0
while True:
    m = re.compile(r'(?:^|\n)\s*%d\\?\. ' % n).search(body, at)
    if not m: break
    pos.append((n, m.start(), m.end())); at = m.end(); n += 1
rows, skipped, article, seen = [], [], None, set()
HEAD = re.compile(r'\n\n(Maddə (\d+)\. [^\n]*|Preambula|Konstitusiyanın qəbulu və quruluşu|Qarışıq suallar[^\n]*)\s*$')
if pos:
    pre = re.findall(r'Maddə (\d+)\. ', body[:pos[0][1]])
    if pre: article = pre[-1]
for i, (n, s, e) in enumerate(pos):
    block = body[e: pos[i + 1][1] if i + 1 < len(pos) else len(body)]
    nxt = None
    h = HEAD.search(block)
    if h:
        nxt = h.group(2) or ''
        block = block[:h.start()]
    m = re.match(r'(.*?)\s*A\)\s*(.*?)\s+B\)\s*(.*?)\s+C\)\s*(.*?)\s+D\)\s*(.*)$', block, re.S)
    ok = bool(m) and n in key and n in expl and expl[n][0] == key[n]
    if ok:
        stem, *opts = [clean(x) for x in m.groups()]
        ok = all(opts) and len(stem) > 5
    if ok:
        ref = f'{ref_prefix}, maddə {article}' if (ref_prefix and article) else (ref_prefix or '')
        stem = re.sub(r'([?:])(\d\. )', r' ', stem)
        base, k = stem, 1
        if stem.lower() in seen:   # eyni mətnli suallar: maddə nömrəsi ilə fərqləndir
            stem = f'{base} (maddə {article})' if article else base
            while stem.lower() in seen:
                k += 1; stem = f'{base} (maddə {article}, {k}-ci sual)' if article else f'{base} ({k}-ci sual)'
        seen.add(stem.lower())
        rows.append([subject, topic, stem, *opts, '', key[n], expl[n][1], '', '', '', '', '', 'orta', 'xeyr', ref])
    else:
        skipped.append(n)
    if nxt is not None: article = nxt or None
w = csv.writer(open(out, 'w', encoding='utf-8', newline=''), delimiter=';')
w.writerow("Fənn;Mövzu;Sual;A;B;C;D;E;Düzgün;İzah;İzah A;İzah B;İzah C;İzah D;İzah E;Çətinlik;Tələ;İstinad".split(';'))
w.writerows(rows)
print(f'tapılan sual: {len(pos)}, açar: {len(key)}, izah: {len(expl)}, yazıldı: {len(rows)}, kənarda: {skipped}')
for r in (rows[0], rows[len(rows)//2], rows[-1]): print('  ·', r[2][:90], '|', r[3][:30], '|', r[6][:30], '|', r[8], '|', r[17])
