import { describe, expect, it } from 'vitest'
import { normHeader, parseCsv, validateRows } from './importQuestions.ts'

const HEAD = 'Fənn;Mövzu;Sual;A;B;C;D;Düzgün;İzah;İzah A;İzah B;İzah C;İzah D;Çətinlik;Tələ;İstinad'

describe('sual idxalı', () => {
  it('CSV: BOM, ; ayırıcı, dırnaq, sətir içində yeni sətir', () => {
    const rows = parseCsv('﻿a;b;c\r\n"x;1";"iki\nsətir";"de ""dırnaq"""\n\n')
    expect(rows).toEqual([['a', 'b', 'c'], ['x;1', 'iki\nsətir', 'de "dırnaq"']])
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
    expect(() => parseCsv('a;"b')).toThrow()
  })
  it('başlıqlar normallaşır', () => {
    expect(['Fənn', 'Mövzu', 'İzah A', 'Çətinlik', 'Tələ', 'Düzgün'].map(normHeader)).toEqual(['fenn', 'movzu', 'izah_a', 'cetinlik', 'tele', 'duzgun'])
  })
  it('düzgün sətir sual layihəsinə çevrilir', () => {
    const r = validateRows(parseCsv(`${HEAD}\ninformatika;Say sistemləri;1 bayt neçə bitdir?;4;8;16;;B;1 bayt = 8 bit;yarım bayt;düzdür;2 bayt;;asan;xeyr;`))
    expect(r.errors).toEqual([])
    expect(r.questions[0]).toMatchObject({ subject: 'informatika', options: ['4', '8', '16'], answerIndex: 1, level: 1, trap: false, lawRef: null, optionExplanations: ['yarım bayt', 'düzdür', '2 bayt'] })
  })
  it('səhvləri sətir nömrəsi ilə göstərir', () => {
    const csv = [HEAD,
      'Informatika;T;S1;a;b;;;A;;;;;;;;',     // fənn kodu böyük hərflə
      'informatika;T;S2;a;;c;;A;;;;;;;;',      // boşluq
      'informatika;T;S3;a;b;;;D;;;;;;;;',      // olmayan variant
      'informatika;T;S4;a;A;;;A;;;;;;;;',      // eyni variant
      'informatika;T;S5;a;b;;;A;;;;;;9;;',     // çətinlik
      'informatika;T;S6;a;b;;;A;;;;;;;bəlkə;',  // tələ
      'informatika;T;S7;a;b;;;A;izah;;;;;;;',
      'informatika;T;s7;a;b;;;B;;;;;;;;',      // təkrar (böyük-kiçik hərf fərqi)
    ].join('\n')
    const r = validateRows(parseCsv(csv))
    const rowsWithErr = [...new Set(r.errors.map((e) => e.row))]
    expect(rowsWithErr).toEqual([2, 3, 4, 5, 6, 7, 9])
    expect(r.questions.map((q) => q.stem)).toEqual(['S7'])
    expect(r.warnings.some((w) => w.row === 8 && w.message.includes('2 variantın izahı'))).toBe(true)
  })
  it('məcburi sütun yoxdursa', () => {
    expect(validateRows(parseCsv('fenn;sual\nx;y')).errors.map((e) => e.message)).toContain('Sütun yoxdur: movzu')
  })
})
