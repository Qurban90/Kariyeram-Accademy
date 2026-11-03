import type { Pack } from './schema'

/**
 * Orijinal NÜMUNƏ məzmun. Real DİM sualları deyil.
 * Real məzmun `content/pack.json` faylından gəlir (repoya daxil edilmir, .gitignore-dadır).
 */
export const samplePack: Pack = {
  stage: 'Dövlət qulluğu (nümunə)',
  subjects: [
    {
      id: 'dil',
      name: 'Azərbaycan dili',
      note: 'Nitq hissələri: isim (kim? nə?), sifət (necə? hansı?), say (neçə?), feil (nə etmək?), zərf (necə? nə vaxt?). Sinonimlər yaxın mənalı, antonimlər əks mənalı sözlərdir.',
    },
    {
      id: 'inf',
      name: 'İnformatika',
      note: '1 bayt 8 bitdir. Əməliyyat sistemi aparat ilə proqramlar arasında vasitəçidir. RAM müvəqqəti, disk isə daimi yaddaşdır.',
    },
    {
      id: 'mantiq',
      name: 'Məntiq',
      note: 'Deduktiv nəticə ümumi qaydadan xüsusi hala keçir. Əgər A olarsa B olar, A var, deməli B var. Əgər A olarsa B olar, B yoxdur, deməli A da yoxdur.',
    },
    {
      id: 'qanun',
      name: 'Qanunvericilik',
      note: 'Konstitusiya dövlətin əsas qanunudur. Qanunun cari redaksiyasını rəsmi hüquqi məlumat bazasında yoxlayın. Bu mətn nümunədir, sizin konspektlərinizlə əvəz olunacaq.',
    },
  ],
  questions: [
    { id: 'd1', subject: 'dil', topic: 'Leksikologiya', text: '“Uzaq” sözünün antonimi hansıdır?', options: ['Böyük', 'Yaxın', 'Qədim', 'Dərin'], answer: 1, explain: 'Antonim əks mənalı sözdür. “Uzaq” və “yaxın” bir cütdür.', status: 'reviewed', version: 1 },
    { id: 'd2', subject: 'dil', topic: 'Qrammatika', text: 'Hansı söz isimdir?', options: ['Yazmaq', 'Gözəl', 'Kitab', 'Tez'], answer: 2, explain: '“Kitab” əşya bildirir və “nə?” sualına cavab verir. “Gözəl” sifət, “tez” zərf, “yazmaq” feildir.', status: 'reviewed', version: 1 },
    { id: 'd3', subject: 'dil', topic: 'Qrammatika', text: 'Hansı söz sifətdir?', options: ['Yazı', 'Gözəl', 'Getmək', 'Dörd'], answer: 1, explain: 'Sifət əşyanın əlamətini bildirir və “necə?” sualına cavab verir. “Gözəl” sifətdir, “dörd” saydır.', status: 'reviewed', version: 1 },
    { id: 'd4', subject: 'dil', topic: 'Leksikologiya', text: '“Dost” sözünün sinonimi hansıdır?', options: ['Düşmən', 'Rəqib', 'Yoldaş', 'Yad'], answer: 2, explain: 'Sinonim yaxın mənalı sözdür. “Dost” və “yoldaş” yaxın mənalıdır.', status: 'reviewed', version: 1 },

    { id: 'i1', subject: 'inf', topic: 'Kompüterin quruluşu', text: '1 bayt neçə bitdir?', options: ['4', '8', '16', '1024'], answer: 1, explain: '1 bayt 8 bitdən ibarətdir.', status: 'reviewed', version: 1 },
    { id: 'i2', subject: 'inf', topic: 'Əməliyyat sistemləri', text: 'Aşağıdakılardan hansı əməliyyat sistemidir?', options: ['Excel', 'Chrome', 'Linux', 'Wi-Fi'], answer: 2, explain: 'Linux əməliyyat sistemidir. Excel və Chrome tətbiq proqramı, Wi-Fi isə şəbəkə texnologiyasıdır.', status: 'reviewed', version: 1 },
    { id: 'i3', subject: 'inf', topic: 'Fayllar', text: 'Hansı fayl uzantısı mətn sənədinə aiddir?', options: ['.mp3', '.jpg', '.docx', '.exe'], answer: 2, explain: '.docx Word mətn sənədinin uzantısıdır. .mp3 səs, .jpg şəkil, .exe isə proqram faylıdır.', status: 'reviewed', version: 1 },
    { id: 'i4', subject: 'inf', topic: 'Kompüterin quruluşu', text: 'RAM nə üçün istifadə olunur?', options: ['Faylları həmişəlik saxlamaq', 'Proqramlar işləyərkən müvəqqəti məlumat saxlamaq', 'Şəbəkəyə qoşulmaq', 'Ekrana təsvir çıxarmaq'], answer: 1, explain: 'RAM operativ yaddaşdır. Proqramlar işləyərkən məlumatı müvəqqəti saxlayır, söndürəndə silinir.', status: 'reviewed', version: 1 },

    { id: 'm1', subject: 'mantiq', topic: 'Deduktiv nəticə', text: 'Bütün müəllimlər savadlıdır. Aynur müəllimdir. Hansı nəticə doğrudur?', options: ['Aynur savadlıdır', 'Aynur savadlı deyil', 'Bütün savadlılar müəllimdir', 'Aynur yalnız savadlıdır'], answer: 0, explain: 'Ümumi şərtdən xüsusi hala keçən deduktiv nəticədir. Aynur müəllimlər çoxluğuna daxildirsə, onların ümumi xüsusiyyətinə də malikdir.', status: 'reviewed', version: 1 },
    { id: 'm2', subject: 'mantiq', topic: 'Ardıcıllıqlar', text: '2, 4, 8, 16, ? ardıcıllığında növbəti ədəd hansıdır?', options: ['24', '30', '32', '64'], answer: 2, explain: 'Hər hədd əvvəlkinin iki mislidir: 16 × 2 = 32.', status: 'reviewed', version: 1 },
    { id: 'm3', subject: 'mantiq', topic: 'Deduktiv nəticə', text: 'Əgər yağış yağırsa, yer islanır. Yer islanmayıb. Hansı nəticə doğrudur?', options: ['Yağış yağıb', 'Yağış yağmayıb', 'Yer quru olduğu üçün hava günəşlidir', 'Nəticə çıxarmaq olmaz'], answer: 1, explain: 'Şərtin nəticəsi baş verməyibsə, səbəb də baş verməyib. Bu “modus tollens” qaydasıdır.', status: 'reviewed', version: 1 },
    { id: 'm4', subject: 'mantiq', topic: 'Ardıcıllıqlar', text: '1, 4, 9, 16, ? ardıcıllığında növbəti ədəd hansıdır?', options: ['20', '24', '25', '36'], answer: 2, explain: 'Bunlar ardıcıl ədədlərin kvadratlarıdır: 1², 2², 3², 4², növbəti 5² = 25.', status: 'reviewed', version: 1 },

    { id: 'q1', subject: 'qanun', topic: 'Konstitusiya', text: 'Hansı akt Azərbaycan Respublikasının əsas qanunudur?', options: ['Mülki Məcəllə', 'Konstitusiya', 'Nazirlər Kabinetinin qərarı', 'Prezidentin sərəncamı'], answer: 1, explain: 'Konstitusiya dövlətin əsas qanunudur, digər aktlar ona zidd ola bilməz.', lawRef: 'Konstitusiya · maddə ▢ (nümunə, bazanızdan gələcək)', status: 'reviewed', version: 1 },
    { id: 'q2', subject: 'qanun', topic: 'Qəbul qaydası', text: 'Dövlət qulluğuna qəbul testdən başqa hansı mərhələni də əhatə edir?', options: ['Müsahibə', 'Lotereya', 'Tövsiyə məktubu yazmaq', 'Sosial şəbəkə reytinqi'], answer: 0, explain: 'Qəbul test imtahanından və müsahibədən ibarətdir. Dəqiq qayda sizin materiallarınızla yenilənəcək.', lawRef: 'Qəbul qaydası · maddə ▢ (nümunə)', status: 'draft', version: 1 },
    { id: 'q3', subject: 'qanun', topic: 'Mənbələr', text: 'Qanunun hazırda qüvvədə olan variantını harada yoxlamaq düzgündür?', options: ['Sosial şəbəkə paylaşımında', 'Rəsmi hüquqi məlumat bazasında', 'Dostun konspektində', 'İstənilən saytda'], answer: 1, explain: 'Qanunun cari redaksiyası rəsmi mənbədə yoxlanılır.', lawRef: 'Mənbə · maddə ▢', status: 'stale', version: 2 },
  ],
}
