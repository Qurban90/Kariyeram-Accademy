# Pillə

Abituriyent, magistr və dövlət qulluğu hazırlığı üçün **Qala + Usta** oyun əsaslı PWA.

Hər fənn qalanın bir mərtəbəsidir. Düzgün cavab daş qoyur. Unudulan və ya səhv cavablanan mövzu divarda **çat** açır, "Səhvlərim" çatı təmir etməkdir. Yuxarıda komissiya otağı var: qapı hər mərtəbə yarıya çatanda açılır. Bələdçi **Usta** adlı qurucudur.

## İşə salmaq

```bash
npm install
npm run dev      # yerli server
npm test         # mühərrik testləri (Vitest)
npm run build    # PWA build (dist/)
npm run preview  # build edilmiş versiyanı yoxla
```

## Nə hazırdır

- İnteraktiv ilk tur (Usta, 5 addım, Profil-dən təkrarlanır)
- Qala (SVG, animasiya), mərtəbə paneli (konspekt + test)
- Bugünkü 5 dəqiqə, çat təmiri, mərtəbə testi, sevimli suallar
- Günün sualı: hamıya eyni sual, paylaşıla bilən nəticə kartı
- Komissiya otağı: qapı məntiqi, ssenari mühərriki ilə mətn müsahibə, 4 meyar üzrə bal aralığı
- Oflayn rejim, quraşdırma, səs/titrəyiş, mövzu və yazı ölçüsü

## Quruluş

| Qovluq | Nə |
| --- | --- |
| `src/engine` | Saf məntiq: `leitner.ts` (1, 3, 7, 14 gün), `tower.ts` (daş, çat, qapı), `queue.ts`, `daily.ts`, `usta.ts` |
| `src/content` | Sxem (`schema.ts`), nümunə məzmun (`sample.ts`), yükləyici (`index.ts`) |
| `src/features` | Ekranlar: `tower`, `quiz`, `daily`, `interview`, `tour`, `profile` |
| `src/store` | Vəziyyət (Zustand, `localStorage`-a saxlanır) |

## Məzmun (vacib)

Repo **public** olduğu üçün real test və konspektlər repoya yazılmır. Real məzmun `content/pack.json` faylıdır, `.gitignore`-dadır. Fayl varsa tətbiq onu, yoxdursa `src/content/sample.ts`-dəki orijinal nümunəni istifadə edir. Sxem: `src/content/schema.ts`. Nümunə suallar real DİM sualları deyil.

Qanun dəyişəndə sualın statusu `stale` olur və sessiyalardan çıxır.

## AI müsahibəyə hazırlıq

`src/features/interview/engine.ts` içində `InterviewEngine` interfeysi var. İndi `scriptedEngine` işləyir (açar sözlərə baxır, real qiymətləndirmə deyil). AI qoşulanda eyni interfeysi həyata keçirən `LlmEngine` əlavə olunacaq. Meyarlar `criteria.json`-dadır (4 meyar, 2–5, keçid həddi 16).

## Məlum məhdudiyyətlər

- Xatırlatma vaxtı saxlanılır, amma telefona bildiriş göndərmək üçün server (web push) lazımdır, hələ qoşulmayıb.
- iOS-da bildiriş yalnız ana ekrana əlavə edilmiş PWA üçün mümkündür.
- Saxlama `localStorage`-dır. Hesab və sinxronizasiya sonrakı mərhələdir (Supabase planlaşdırılır).
- Taymerli sınaq ekranı hələ yoxdur.
- `.docx` və `.pdf` idxal skripti nümunə fayl gələndən sonra yazılacaq.

## Yayımlamaq

`main` budağına push edəndə `.github/workflows/pages.yml` testləri işlədib GitHub Pages-ə yerləşdirir. Əvvəl repo parametrlərində Pages mənbəyini "GitHub Actions" seçmək lazımdır.
