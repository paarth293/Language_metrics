/**
 * languages.ts — Centralized language and proficiency level configuration
 *
 * Every language taught on the platform and its official level system.
 * All proficiency dropdowns, filters, and database values pull from here.
 */

export interface LanguageLevel {
  value: string;   // Stored in DB (e.g., "A1", "HSK 3", "N2")
  label: string;   // Display name (e.g., "A1 — Beginner", "HSK 3")
  shortLabel: string; // Abbreviated (e.g., "A1", "HSK 3")
  description: string; // User-friendly description
}

export interface LanguageConfig {
  name: string;
  code: string;       // ISO 639-1
  flag: string;       // Flag emoji
  levelSystem: string; // e.g., "CEFR", "HSK", "JLPT"
  levels: LanguageLevel[];
}

export const LANGUAGES: LanguageConfig[] = [
  // ── CEFR Languages ──────────────────────────────────────────────────
  {
    name: "English", code: "en", flag: "🇬🇧", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Beginner", shortLabel: "A1", description: "Can understand and use basic phrases" },
      { value: "A2", label: "A2 — Elementary", shortLabel: "A2", description: "Can communicate in simple, routine tasks" },
      { value: "B1", label: "B1 — Intermediate", shortLabel: "B1", description: "Can deal with most travel situations" },
      { value: "B2", label: "B2 — Upper Intermediate", shortLabel: "B2", description: "Can interact with fluency and spontaneity" },
      { value: "C1", label: "C1 — Advanced", shortLabel: "C1", description: "Can use language flexibly for social and professional purposes" },
      { value: "C2", label: "C2 — Mastery", shortLabel: "C2", description: "Near-native command of the language" },
    ],
  },
  {
    name: "French", code: "fr", flag: "🇫🇷", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Débutant", shortLabel: "A1", description: "Peut comprendre et utiliser des expressions familières" },
      { value: "A2", label: "A2 — Élémentaire", shortLabel: "A2", description: "Peut communiquer dans des tâches simples" },
      { value: "B1", label: "B1 — Intermédiaire", shortLabel: "B1", description: "Peut gérer la plupart des situations de voyage" },
      { value: "B2", label: "B2 — Intermédiaire supérieur", shortLabel: "B2", description: "Peut interagir avec aisance et spontanéité" },
      { value: "C1", label: "C1 — Avancé", shortLabel: "C1", description: "Peut utiliser la langue avec souplesse" },
      { value: "C2", label: "C2 — Maîtrise", shortLabel: "C2", description: "Maîtrise quasi-native de la langue" },
    ],
  },
  {
    name: "Spanish", code: "es", flag: "🇪🇸", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Principiante", shortLabel: "A1", description: "Puede comprender y usar expresiones básicas" },
      { value: "A2", label: "A2 — Elemental", shortLabel: "A2", description: "Puede comunicarse en tareas simples" },
      { value: "B1", label: "B1 — Intermedio", shortLabel: "B1", description: "Puede manejar la mayoría de situaciones de viaje" },
      { value: "B2", label: "B2 — Intermedio alto", shortLabel: "B2", description: "Puede interactuar con fluidez y espontaneidad" },
      { value: "C1", label: "C1 — Avanzado", shortLabel: "C1", description: "Puede usar el idioma con flexibilidad" },
      { value: "C2", label: "C2 — Dominio", shortLabel: "C2", description: "Dominio casi nativo del idioma" },
    ],
  },
  {
    name: "Portuguese", code: "pt", flag: "🇵🇹", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Iniciante", shortLabel: "A1", description: "Pode compreender e usar expressões básicas" },
      { value: "A2", label: "A2 — Elemental", shortLabel: "A2", description: "Pode comunicar em tarefas simples" },
      { value: "B1", label: "B1 — Intermediário", shortLabel: "B1", description: "Pode lidar com a maioria das situações de viagem" },
      { value: "B2", label: "B2 — Intermediário superior", shortLabel: "B2", description: "Pode interagir com fluência e espontaneidade" },
      { value: "C1", label: "C1 — Avançado", shortLabel: "C1", description: "Pode usar o idioma com flexibilidade" },
      { value: "C2", label: "C2 — Domínio", shortLabel: "C2", description: "Domínio quase nativo do idioma" },
    ],
  },
  {
    name: "Italian", code: "it", flag: "🇮🇹", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Principiante", shortLabel: "A1", description: "Capace di comprendere e usare espressioni base" },
      { value: "A2", label: "A2 — Elementare", shortLabel: "A2", description: "Capace di comunicare in compiti semplici" },
      { value: "B1", label: "B1 — Intermedio", shortLabel: "B1", description: "Capace di gestire la maggior parte dei viaggi" },
      { value: "B2", label: "B2 — Intermedio superiore", shortLabel: "B2", description: "Capace di interagire con scioltezza" },
      { value: "C1", label: "C1 — Avanzato", shortLabel: "C1", description: "Capace di usare la lingua con flessibilità" },
      { value: "C2", label: "C2 — Padronanza", shortLabel: "C2", description: "Padronanza quasi madrelingua" },
    ],
  },
  {
    name: "German", code: "de", flag: "🇩🇪", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Anfänger", shortLabel: "A1", description: "Kann grundlegende Ausdrücke verstehen und verwenden" },
      { value: "A2", label: "A2 — Grundstufe", shortLabel: "A2", description: "Kann in einfachen Alltagssituationen kommunizieren" },
      { value: "B1", label: "B1 — Mittelstufe", shortLabel: "B1", description: "Kann die meisten Reisesituationen bewältigen" },
      { value: "B2", label: "B2 — Obere Mittelstufe", shortLabel: "B2", description: "Kann fließend und spontan interagieren" },
      { value: "C1", label: "C1 — Fortgeschritten", shortLabel: "C1", description: "Kann die Sprache flexibel使用" },
      { value: "C2", label: "C2 — Meisterschaft", shortLabel: "C2", description: "Muttersprachliche Kompetenz" },
    ],
  },
  {
    name: "Dutch", code: "nl", flag: "🇳🇱", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Beginner", shortLabel: "A1", description: "Kan eenvoudige uitdrukkingen begrijpen" },
      { value: "A2", label: "A2 — Basis", shortLabel: "A2", description: "Kan communiceren in eenvoudige situaties" },
      { value: "B1", label: "B1 — Gemiddeld", shortLabel: "B1", description: "Kan de meeste reissituaties aan" },
      { value: "B2", label: "B2 — Boven gemiddeld", shortLabel: "B2", description: "Kan vlot en spontaan communiceren" },
      { value: "C1", label: "C1 — Gevorderd", shortLabel: "C1", description: "Kan de taal flexibel gebruiken" },
      { value: "C2", label: "C2 — Beheersing", shortLabel: "C2", description: "Bijna moedertaalniveau" },
    ],
  },
  {
    name: "Swedish", code: "sv", flag: "🇸🇪", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Nybörjare", shortLabel: "A1", description: "Kan förstå och använda enkla uttryck" },
      { value: "A2", label: "A2 — Grundläggande", shortLabel: "A2", description: "Kan kommunicera i enkla situationer" },
      { value: "B1", label: "B1 — Medel", shortLabel: "B1", description: "Kan hantera de flesta resesituationer" },
      { value: "B2", label: "B2 — Över medel", shortLabel: "B2", description: "Kan interagera flytande och spontant" },
      { value: "C1", label: "C1 — Avancerad", shortLabel: "C1", description: "Kan använda språket flexibelt" },
      { value: "C2", label: "C2 — Behärskning", shortLabel: "C2", description: "Nästan modersmålsnivå" },
    ],
  },
  {
    name: "Norwegian", code: "no", flag: "🇳🇴", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Nybegynner", shortLabel: "A1", description: "Kan forstå og bruke enkle uttrykk" },
      { value: "A2", label: "A2 — Grunnleggende", shortLabel: "A2", description: "Kan kommunisere i enkle situasjoner" },
      { value: "B1", label: "B1 — Mellom", shortLabel: "B1", description: "Kan håndtere de fleste reisesituasjoner" },
      { value: "B2", label: "B2 — Over mellom", shortLabel: "B2", description: "Kan samhandle flytende og spontant" },
      { value: "C1", label: "C1 — Avansert", shortLabel: "C1", description: "Kan bruke språket fleksibelt" },
      { value: "C2", label: "C2 — Beherskelse", shortLabel: "C2", description: "Nesten morsmålsnivå" },
    ],
  },
  {
    name: "Danish", code: "da", flag: "🇩🇰", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Begynder", shortLabel: "A1", description: "Kan forstå og bruge enkle udtryk" },
      { value: "A2", label: "A2 — Grundlæggende", shortLabel: "A2", description: "Kan kommunikere i enkle situationer" },
      { value: "B1", label: "B1 — Mellem", shortLabel: "B1", description: "Kan håndtere de fleste rejsesituationer" },
      { value: "B2", label: "B2 — Over mellem", shortLabel: "B2", description: "Kan interagere flydende og spontant" },
      { value: "C1", label: "C1 — Avanceret", shortLabel: "C1", description: "Kan bruge sproget fleksibelt" },
      { value: "C2", label: "C2 — Beherskelse", shortLabel: "C2", description: "Næsten modersmålsniveau" },
    ],
  },
  {
    name: "Finnish", code: "fi", flag: "🇫🇮", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Aloittelija", shortLabel: "A1", description: "Ymmärtää ja käyttää peruslauseita" },
      { value: "A2", label: "A2 — Perus", shortLabel: "A2", description: "Voi kommunikoida yksinkertaisissa tilanteissa" },
      { value: "B1", label: "B1 — Keskitaso", shortLabel: "B1", description: "Pystyy käsittelemään useimmat matkatilanteet" },
      { value: "B2", label: "B2 — Ylempi keskitaso", shortLabel: "B2", description: "Pystyy sujuvaan ja spontaaniin vuorovaikutukseen" },
      { value: "C1", label: "C1 — Edistynyt", shortLabel: "C1", description: "Pystyy käyttämään kieltä joustavasti" },
      { value: "C2", label: "C2 — Hallinta", shortLabel: "C2", description: "Lähes äidinkielinen taso" },
    ],
  },
  {
    name: "Polish", code: "pl", flag: "🇵🇱", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Początkujący", shortLabel: "A1", description: "Rozumie i używa podstawowych wyrażeń" },
      { value: "A2", label: "A2 — Podstawowy", shortLabel: "A2", description: "Może komunikować się w prostych sytuacjach" },
      { value: "B1", label: "B1 — Średniozaawansowany", shortLabel: "B1", description: "Radzi sobie w większości sytuacji podróżniczych" },
      { value: "B2", label: "B2 — Średniozaawansowany wyższy", shortLabel: "B2", description: "Może interakcjonować płynnie i spontanicznie" },
      { value: "C1", label: "C1 — Zaawansowany", shortLabel: "C1", description: "Może używać języka elastycznie" },
      { value: "C2", label: "C2 — Biegłość", shortLabel: "C2", description: "Prawie native speaker level" },
    ],
  },
  {
    name: "Czech", code: "cs", flag: "🇨🇿", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Začátečník", shortLabel: "A1", description: "Rozumí a používá základní fráze" },
      { value: "A2", label: "A2 — Základní", shortLabel: "A2", description: "Může komunikovat v jednoduchých situacích" },
      { value: "B1", label: "B1 — Střední", shortLabel: "B1", description: "Zvládne většinu cestovních situací" },
      { value: "B2", label: "B2 — Nad střední", shortLabel: "B2", description: "Může plynule a spontánně interagovat" },
      { value: "C1", label: "C1 — Pokročilý", shortLabel: "C1", description: "Může jazyk používat flexibilně" },
      { value: "C2", label: "C2 — Zvládnutí", shortLabel: "C2", description: "Téměř na úrovni rodilého mluvčího" },
    ],
  },
  {
    name: "Greek", code: "el", flag: "🇬🇷", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Αρχάριος", shortLabel: "A1", description: "Κατανοεί και χρησιμοποιεί βασικές φράσεις" },
      { value: "A2", label: "A2 — Βασικός", shortLabel: "A2", description: "Μπορεί να επικοινωνήσει σε απλές καταστάσεις" },
      { value: "B1", label: "B1 — Μεσαίος", shortLabel: "B1", description: "Αντιμετωπίζει τις περισσότερες καταστάσεις ταξιδιού" },
      { value: "B2", label: "B2 — Υπερμεσαίος", shortLabel: "B2", description: "Μπορεί να αλληλεπιδράσει άνετα" },
      { value: "C1", label: "C1 — Προχωρημένος", shortLabel: "C1", description: "Χρησιμοποιεί τη γλώσσα ευέλικτα" },
      { value: "C2", label: "C2 — Εξουσία", shortLabel: "C2", description: "Σχεδόν σε επίπεδο μητρικής" },
    ],
  },
  {
    name: "Russian", code: "ru", flag: "🇷🇺", levelSystem: "CEFR / TORFL",
    levels: [
      { value: "A1", label: "A1 — ТЭУ (Элементарный)", shortLabel: "A1", description: "Понимает и использует простые фразы" },
      { value: "A2", label: "A2 — ТБУ (Базовый)", shortLabel: "A2", description: "Может общаться в простых ситуациях" },
      { value: "B1", label: "B1 — ТРКИ-1 (Первый сертификат)", shortLabel: "B1", description: "Справляется с большинством ситуаций" },
      { value: "B2", label: "B2 — ТРКИ-2 (Второй сертификат)", shortLabel: "B2", description: "Может взаимодействовать свободно" },
      { value: "C1", label: "C1 — ТРКИ-3 (Третий сертификат)", shortLabel: "C1", description: "Владеет языком гибко" },
      { value: "C2", label: "C2 — ТРКИ-4 (Четвёртый сертификат)", shortLabel: "C2", description: "Почти на уровне носителя" },
    ],
  },
  {
    name: "Ukrainian", code: "uk", flag: "🇺🇦", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Початковий", shortLabel: "A1", description: "Розуміє та використовує прості фрази" },
      { value: "A2", label: "A2 — Базовий", shortLabel: "A2", description: "Може спілкуватися в простих ситуаціях" },
      { value: "B1", label: "B1 — Середній", shortLabel: "B1", description: "Справляється з більшістю ситуацій" },
      { value: "B2", label: "B2 — Вище середнього", shortLabel: "B2", description: "Може взаємодіяти вільно" },
      { value: "C1", label: "C1 — Просунутий", shortLabel: "C1", description: "Володіє мовою гнучко" },
      { value: "C2", label: "C2 — Володіння", shortLabel: "C2", description: "Майже на рівні носія" },
    ],
  },
  {
    name: "Turkish", code: "tr", flag: "🇹🇷", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Başlangıç", shortLabel: "A1", description: "Temel ifadeleri anlayabilir ve kullanabilir" },
      { value: "A2", label: "A2 — Temel", shortLabel: "A2", description: "Basit durumlarda iletişim kurabilir" },
      { value: "B1", label: "B1 — Orta", shortLabel: "B1", description: "Çoğu seyahat durumunu idare edebilir" },
      { value: "B2", label: "B2 — Orta Üstü", shortLabel: "B2", description: "Akıcı ve spontane etkileşim kurabilir" },
      { value: "C1", label: "C1 — İleri", shortLabel: "C1", description: "Dili esnek kullanabilir" },
      { value: "C2", label: "C2 — Hakimiyet", shortLabel: "C2", description: "Anadili düzeyine yakın" },
    ],
  },
  // ── South Asian (CEFR-inspired) ──────────────────────────────────────
  {
    name: "Hindi", code: "hi", flag: "🇮🇳", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — शुरुआती", shortLabel: "A1", description: "Basic phrases samajh sakte hain" },
      { value: "A2", label: "A2 — आधारभूत", shortLabel: "A2", description: "Simple situations mein baat kar sakte hain" },
      { value: "B1", label: "B1 — मध्यम", shortLabel: "B1", description: "Zyadatar situations handle kar sakte hain" },
      { value: "B2", label: "B2 — उन्नत मध्यम", shortLabel: "B2", description: "Fluent aur spontaneous baat kar sakte hain" },
      { value: "C1", label: "C1 — उन्नत", shortLabel: "C1", description: "Bhasha ka flexible upyog kar sakte hain" },
      { value: "C2", label: "C2 — दक्षता", shortLabel: "C2", description: "Lagbhag native jaisi bhasha" },
    ],
  },
  {
    name: "Bengali", code: "bn", flag: "🇧🇩", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — শিক্ষার্থী", shortLabel: "A1", description: "Basic phrases bujhte parben" },
      { value: "A2", label: "A2 — প্রাথমিক", shortLabel: "A2", description: "Simple situations e kotha bolte parben" },
      { value: "B1", label: "B1 — মধ্যম", shortLabel: "B1", description: "Beshirbhag situations manage korte parben" },
      { value: "B2", label: "B2 — উন্নত মধ্যম", shortLabel: "B2", description: "Fluent aur spontaneous kotha bolte parben" },
      { value: "C1", label: "C1 — উন্নত", shortLabel: "C1", description: "Bhasha flexible vabe byabohar korte parben" },
      { value: "C2", label: "C2 — দক্ষতা", shortLabel: "C2", description: "Pray native er moto bhasha" },
    ],
  },
  {
    name: "Tamil", code: "ta", flag: "🇮🇳", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — ஆரம்பநிலை", shortLabel: "A1", description: "Basic vagai-galai purinjikollam" },
      { value: "A2", label: "A2 — அடிப்படை", shortLabel: "A2", description: "Eludhiya nilaigalil pesalam" },
      { value: "B1", label: "B1 — நடுத்தர", shortLabel: "B1", description: "Paguthi-ya nilaigalai sernthu-kollalam" },
      { value: "B2", label: "B2 — உயர் நடுத்தர", shortLabel: "B2", description: "Silamana mozhi pesalam" },
      { value: "C1", label: "C1 — மேம்பட்ட", shortLabel: "C1", description: "Mozhi-yai neyamaiaga paadhugaikollalam" },
      { value: "C2", label: "C2 — தேர்ச்சி", shortLabel: "C2", description: "Iyalbana mozhi-aatra mozhi" },
    ],
  },
  {
    name: "Telugu", code: "te", flag: "🇮🇳", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — ప్రారంభ", shortLabel: "A1", description: "Basic matalu ardamavutayi" },
      { value: "A2", label: "A2 — ప్రాథమిక", shortLabel: "A2", description: "Simple situations lo matladavachu" },
      { value: "B1", label: "B1 — మధ్యస్థ", shortLabel: "B1", description: "Chala situations handle cheyachu" },
      { value: "B2", label: "B2 — ఉన్నత మధ్యస్థ", shortLabel: "B2", description: "Fluent ga matladavachu" },
      { value: "C1", label: "C1 — అధునాతన", shortLabel: "C1", description: "Bhasha nu flexible ga veyyochu" },
      { value: "C2", label: "C2 — నైపుణ్యం", shortLabel: "C2", description: "Daadapu native bhasha" },
    ],
  },
  {
    name: "Marathi", code: "mr", flag: "🇮🇳", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — सुरुवातीला", shortLabel: "A1", description: "Basic वाक्ये समजू शकता" },
      { value: "A2", label: "A2 — आधारभूत", shortLabel: "A2", description: "सोप्या परिस्थितीत बोलू शकता" },
      { value: "B1", label: "B1 — मध्यम", shortLabel: "B1", description: "बहुतेक परिस्थिती हाताळू शकता" },
      { value: "B2", label: "B2 — उन्नत मध्यम", shortLabel: "B2", description: "अस्खलित आणि स्पॉन्टेनिअस बोलू शकता" },
      { value: "C1", label: "C1 — उन्नत", shortLabel: "C1", description: "भाषा लवचिकपणे वापरू शकता" },
      { value: "C2", label: "C2 — कुशलता", shortLabel: "C2", description: "जवळजवळ मातृभाषी स्तर" },
    ],
  },
  {
    name: "Punjabi", code: "pa", flag: "🇮🇳", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — ਸ਼ੁਰੂਆਤੀ", shortLabel: "A1", description: "Basic shabad samajh sakde ho" },
      { value: "A2", label: "A2 — ਬੁਨਿਆਦੀ", shortLabel: "A2", description: "Simple sthitiyan vich galat kar sakde ho" },
      { value: "B1", label: "B1 — ਦਰਮਿਆਨਾ", shortLabel: "B1", description: "Zyadatar sthitiyan sambhal sakde ho" },
      { value: "B2", label: "B2 — ਉੱਚ ਦਰਮਿਆਨਾ", shortLabel: "B2", description: "Fluent te spontaneous galat kar sakde ho" },
      { value: "C1", label: "C1 — ਤੇਜ਼", shortLabel: "C1", description: "Bhasha nu lachari naal varto sakde ho" },
      { value: "C2", label: "C2 — ਮਹਾਰਥ", shortLabel: "C2", description: "Lagbhag mool bhashi warga" },
    ],
  },
  {
    name: "Gujarati", code: "gu", flag: "🇮🇳", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — શરૂઆત", shortLabel: "A1", description: "Basic shabdo samajhi shakte chho" },
      { value: "A2", label: "A2 — પ્રાથમિક", shortLabel: "A2", description: "Simple paristhitiyo ma bolI shakte chho" },
      { value: "B1", label: "B1 — મધ્યમ", shortLabel: "B1", description: "Beshatar paristhitiyo sambhaLi shakte chho" },
      { value: "B2", label: "B2 — ઉચ્ચ મધ્યમ", shortLabel: "B2", description: "Fluent ane spontaneous bolI shakte chho" },
      { value: "C1", label: "C1 — અદ્યતન", shortLabel: "C1", description: "Bhasha ne flexible rite vaproI shakte chho" },
      { value: "C2", label: "C2 — નિપુણતા", shortLabel: "C2", description: "Lagbhag母语 jaisi bhasha" },
    ],
  },
  {
    name: "Malayalam", code: "ml", flag: "🇮🇳", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — ആരംഭം", shortLabel: "A1", description: "Basic vaakyangal manasilakkan kazhiyum" },
      { value: "A2", label: "A2 — അടിസ്ഥാന", shortLabel: "A2", description: "Eluppamulla avasthakalil samsarikkan kazhiyum" },
      { value: "B1", label: "B1 — ഇടത്തരം", shortLabel: "B1", description: "Bhoomi bhaga avasthakal nilkkann kazhiyum" },
      { value: "B2", label: "B2 — മുകളിലെ ഇടത്തരം", shortLabel: "B2", description: "Fluent aayi samsarikkan kazhiyum" },
      { value: "C1", label: "C1 — വിദഗ്ധം", shortLabel: "C1", description: "Bhashayodu flexible aayi upayogikkan kazhiyum" },
      { value: "C2", label: "C2 — നൈപുണ്യം", shortLabel: "C2", description: "Jeevitham: matrubhashayodu thulyam" },
    ],
  },
  // ── Southeast Asian ──────────────────────────────────────────────────
  {
    name: "Indonesian", code: "id", flag: "🇮🇩", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Pemula", shortLabel: "A1", description: "Dapat memahami dan menggunakan frasa dasar" },
      { value: "A2", label: "A2 — Dasar", shortLabel: "A2", description: "Dapat berkomunikasi dalam situasi sederhana" },
      { value: "B1", label: "B1 — Menengah", shortLabel: "B1", description: "Dapat menangani sebagian besar situasi perjalanan" },
      { value: "B2", label: "B2 — Menengah Atas", shortLabel: "B2", description: "Dapat berinteraksi dengan lancar" },
      { value: "C1", label: "C1 — Mahir", shortLabel: "C1", description: "Dapat menggunakan bahasa dengan fleksibel" },
      { value: "C2", label: "C2 — Penguasaan", shortLabel: "C2", description: "Hampir setara penutur asli" },
    ],
  },
  {
    name: "Malay", code: "ms", flag: "🇲🇾", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Pemula", shortLabel: "A1", description: "Boleh memahami dan menggunakan frasa asas" },
      { value: "A2", label: "A2 — Asas", shortLabel: "A2", description: "Boleh berkomunikasi dalam situasi mudah" },
      { value: "B1", label: "B1 — Pertengahan", shortLabel: "B1", description: "Boleh mengendalikan kebanyakan situasi perjalanan" },
      { value: "B2", label: "B2 — Pertengahan Atas", shortLabel: "B2", description: "Boleh berinteraksi dengan lancar dan spontan" },
      { value: "C1", label: "C1 — Mahir", shortLabel: "C1", description: "Boleh menggunakan bahasa dengan fleksibel" },
      { value: "C2", label: "C2 — Penguasaan", shortLabel: "C2", description: "Hampir setaraf penutur asli" },
    ],
  },
  {
    name: "Vietnamese", code: "vi", flag: "🇻🇳", levelSystem: "Vietnamese Framework",
    levels: [
      { value: "Level 1", label: "Level 1 — Sơ cấp", shortLabel: "L1", description: "Cơ bản, giao tiếp đơn giản" },
      { value: "Level 2", label: "Level 2 — Sơ cấp cao", shortLabel: "L2", description: "Giao tiếp trong tình huống quen thuộc" },
      { value: "Level 3", label: "Level 3 — Trung cấp", shortLabel: "L3", description: "Giao tiếp trong hầu hết các tình huống" },
      { value: "Level 4", label: "Level 4 — Trung cấp cao", shortLabel: "L4", description: "Giao tiếp trôi chảy và tự nhiên" },
      { value: "Level 5", label: "Level 5 — Cao cấp", shortLabel: "L5", description: "Sử dụng linh hoạt trong mọi tình huống" },
      { value: "Level 6", label: "Level 6 — Thành thạo", shortLabel: "L6", description: "Gần như người bản xứ" },
    ],
  },
  {
    name: "Thai", code: "th", flag: "🇹🇭", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — _BEGINNER_", shortLabel: "A1", description: "เข้าใจและใช้สำนวนพื้นฐาน" },
      { value: "A2", label: "A2 — พื้นฐาน", shortLabel: "A2", description: "สื่อสารในสถานการณ์ง่ายๆ" },
      { value: "B1", label: "B1 — ปานกลาง", shortLabel: "B1", description: "จัดการกับสถานการณ์ส่วนใหญ่" },
      { value: "B2", label: "B2 — ปานกลางสูง", shortLabel: "B2", description: "สื่อสารได้อย่างคล่องแคล่ว" },
      { value: "C1", label: "C1 — สูง", shortLabel: "C1", description: "ใช้ภาษาได้อย่างยืดหยุ่น" },
      { value: "C2", label: "C2 — เชี่ยวชาญ", shortLabel: "C2", description: "ใกล้เคียงเจ้าของภาษา" },
    ],
  },
  // ── East Asian (Unique Systems) ──────────────────────────────────────
  {
    name: "Mandarin Chinese", code: "zh", flag: "🇨🇳", levelSystem: "HSK",
    levels: [
      { value: "HSK 1", label: "HSK 1 — Beginner", shortLabel: "HSK 1", description: "Knows 150 words, basic daily expressions" },
      { value: "HSK 2", label: "HSK 2 — Elementary", shortLabel: "HSK 2", description: "Knows 300 words, simple conversations" },
      { value: "HSK 3", label: "HSK 3 — Intermediate", shortLabel: "HSK 3", description: "Knows 600 words, daily communication" },
      { value: "HSK 4", label: "HSK 4 — Upper Intermediate", shortLabel: "HSK 4", description: "Knows 1200 words, fluent discussions" },
      { value: "HSK 5", label: "HSK 5 — Advanced", shortLabel: "HSK 5", description: "Knows 2500 words, read newspapers" },
      { value: "HSK 6", label: "HSK 6 — Mastery", shortLabel: "HSK 6", description: "Knows 5000+ words, near-native" },
    ],
  },
  {
    name: "Japanese", code: "ja", flag: "🇯🇵", levelSystem: "JLPT",
    levels: [
      { value: "N5", label: "N5 — Beginner", shortLabel: "N5", description: "Basic hiragana/katakana, ~800 words" },
      { value: "N4", label: "N4 — Elementary", shortLabel: "N4", description: "Basic conversations, ~1500 words" },
      { value: "N3", label: "N3 — Intermediate", shortLabel: "N3", description: "Everyday situations, ~3750 words" },
      { value: "N2", label: "N2 — Upper Intermediate", shortLabel: "N2", description: "Newspapers, professional contexts, ~6000 words" },
      { value: "N1", label: "N1 — Advanced", shortLabel: "N1", description: "Complex texts, near-native, ~10000 words" },
    ],
  },
  {
    name: "Korean", code: "ko", flag: "🇰🇷", levelSystem: "TOPIK",
    levels: [
      { value: "TOPIK I-1", label: "TOPIK I Level 1 — Beginner", shortLabel: "TOPIK 1", description: "Basic hangul and simple phrases" },
      { value: "TOPIK I-2", label: "TOPIK I Level 2 — Elementary", shortLabel: "TOPIK 2", description: "Basic daily conversations" },
      { value: "TOPIK II-3", label: "TOPIK II Level 3 — Intermediate", shortLabel: "TOPIK 3", description: "Independent travel and social situations" },
      { value: "TOPIK II-4", label: "TOPIK II Level 4 — Upper Intermediate", shortLabel: "TOPIK 4", description: "Professional and abstract topics" },
      { value: "TOPIK II-5", label: "TOPIK II Level 5 — Advanced", shortLabel: "TOPIK 5", description: "Academic and professional fluency" },
      { value: "TOPIK II-6", label: "TOPIK II Level 6 — Mastery", shortLabel: "TOPIK 6", description: "Near-native proficiency" },
    ],
  },
  // ── Middle Eastern ───────────────────────────────────────────────────
  {
    name: "Arabic", code: "ar", flag: "🇸🇦", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — مبتدئ", shortLabel: "A1", description: "يفهم ويستخدم عبارات بسيطة" },
      { value: "A2", label: "A2 — أساسي", shortLabel: "A2", description: "يستطيع التواصل في مواقف بسيطة" },
      { value: "B1", label: "B1 — متوسط", shortLabel: "B1", description: "يتعامل مع معظم مواقف السفر" },
      { value: "B2", label: "B2 — فوق متوسط", shortLabel: "B2", description: "يتفاعل بطلاقة وعفوية" },
      { value: "C1", label: "C1 — متقدم", shortLabel: "C1", description: "يستخدم اللغة بمرونة" },
      { value: "C2", label: "C2 — إتقان", shortLabel: "C2", description: "تقريبًا اللغة الأم" },
    ],
  },
  {
    name: "Hebrew", code: "he", flag: "🇮🇱", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — מתחיל", shortLabel: "A1", description: "מבין ומשתמש ביטויים בסיסיים" },
      { value: "A2", label: "A2 — בסיסי", shortLabel: "A2", description: "יכול לתקשר במצבים פשוטים" },
      { value: "B1", label: "B1 — בינוני", shortLabel: "B1", description: "מתמודד עם רוב מצבות הנסיעה" },
      { value: "B2", label: "B2 — מעל בינוני", shortLabel: "B2", description: "יכול לקיים אינטראקציה שוטפת" },
      { value: "C1", label: "C1 — מתקדם", shortLabel: "C1", description: "משתמש בשפה באופן גמיש" },
      { value: "C2", label: "C2 — שליטה", shortLabel: "C2", description: "כמעט ברמת שפת אם" },
    ],
  },
  {
    name: "Persian", code: "fa", flag: "🇮🇷", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — مبتدی", shortLabel: "A1", description: "عبارات ساده را می‌فهمد" },
      { value: "A2", label: "A2 — پایه", shortLabel: "A2", description: "می‌تواند در موقعیت‌های ساده ارتباط برقرار کند" },
      { value: "B1", label: "B1 — متوسط", shortLabel: "B1", description: "با بیشتر موقعیت‌ها کنار می‌آید" },
      { value: "B2", label: "B2 — بالاتر از متوسط", shortLabel: "B2", description: "می‌تواند روان و خودجوش تعامل کند" },
      { value: "C1", label: "C1 — پیشرفته", shortLabel: "C1", description: "زبان را انعطاف‌پذیر استفاده می‌کند" },
      { value: "C2", label: "C2 — تسلط", shortLabel: "C2", description: "تقریباً هم‌سطح زبان مادری" },
    ],
  },
  // ── European ─────────────────────────────────────────────────────────
  {
    name: "Irish", code: "ga", flag: "🇮🇪", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Tusaim", shortLabel: "A1", description: "Tuigeann agus úsáideann frásaí bunúsacha" },
      { value: "A2", label: "A2 — Bunsraith", shortLabel: "A2", description: "Is féidir cumarsáid a dhéanamh i gcásanna simplí" },
      { value: "B1", label: "B1 — Meán", shortLabel: "B1", description: "Déileálann le formharchásanna taistil" },
      { value: "B2", label: "B2 — Meán Ard", shortLabel: "B2", description: "Is féidir idirghníomhú go líofa" },
      { value: "C1", label: "C1 — Ard", shortLabel: "C1", description: "Úsáideann an teanga solúbtha" },
      { value: "C2", label: "C2 — Máistreacht", shortLabel: "C2", description: "Beagnach ar leibhéal dúchais" },
    ],
  },
  {
    name: "Romanian", code: "ro", flag: "🇷🇴", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Începător", shortLabel: "A1", description: "Înțelege și folosește expresii de bază" },
      { value: "A2", label: "A2 — Elementar", shortLabel: "A2", description: "Poate comunica în situații simple" },
      { value: "B1", label: "B1 — Mijlociu", shortLabel: "B1", description: "Face față majorității situațiilor de călătorie" },
      { value: "B2", label: "B2 — Peste mijlociu", shortLabel: "B2", description: "Poate interacționa fluent și spontan" },
      { value: "C1", label: "C1 — Avansat", shortLabel: "C1", description: "Poate folosi limba flexibil" },
      { value: "C2", label: "C2 — Stăpânire", shortLabel: "C2", description: "Aproape la nivel de vorbitor nativ" },
    ],
  },
  {
    name: "Hungarian", code: "hu", flag: "🇭🇺", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Kezdő", shortLabel: "A1", description: "Megért és alapfordulatokat használ" },
      { value: "A2", label: "A2 — Alapszintű", shortLabel: "A2", description: "Egyszerű helyzetekben tud kommunikálni" },
      { value: "B1", label: "B1 — Középfokú", shortLabel: "B1", description: "Megbirkózik a legtöbb utazási helyzettel" },
      { value: "B2", label: "B2 — Felső középfokú", shortLabel: "B2", description: "Folyékonyan és spontán tud kommunikálni" },
      { value: "C1", label: "C1 — Haladó", shortLabel: "C1", description: "Rugalmassan tudja használni a nyelvet" },
      { value: "C2", label: "C2 — Felsőfokú", shortLabel: "C2", description: "Majdnem anyanyelvi szint" },
    ],
  },
  {
    name: "Slovak", code: "sk", flag: "🇸🇰", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Začiatočník", shortLabel: "A1", description: "Rozumie a používa základné frázy" },
      { value: "A2", label: "A2 — Základný", shortLabel: "A2", description: "Dokáže komunikovať v jednoduchých situáciách" },
      { value: "B1", label: "B1 — Stredný", shortLabel: "B1", description: "Zvládne väčšinu cestovných situácií" },
      { value: "B2", label: "B2 — Nad stredný", shortLabel: "B2", description: "Dokáže plynule a spontánne komunikovať" },
      { value: "C1", label: "C1 — Pokročilý", shortLabel: "C1", description: "Dokáže jazyk používať flexibilne" },
      { value: "C2", label: "C2 — Zvládnutie", shortLabel: "C2", description: "Takmer na úrovni rodilého hovorcu" },
    ],
  },
  {
    name: "Slovenian", code: "sl", flag: "🇸🇮", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Začetnik", shortLabel: "A1", description: "Razume in uporablja osnovne fraze" },
      { value: "A2", label: "A2 — Osnovni", shortLabel: "A2", description: "Lahko komunicira v preprostih situacijah" },
      { value: "B1", label: "B1 — Srednji", shortLabel: "B1", description: "Obvladuje večino potnih situacij" },
      { value: "B2", label: "B2 — Nad srednji", shortLabel: "B2", description: "Lahko komunicira tekoče in spontano" },
      { value: "C1", label: "C1 — Napredni", shortLabel: "C1", description: "Lahko jezik uporablja prožno" },
      { value: "C2", label: "C2 — Obvladanje", shortLabel: "C2", description: "Skoraj na ravni maternega" },
    ],
  },
  {
    name: "Croatian", code: "hr", flag: "🇭🇷", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Početnik", shortLabel: "A1", description: "Razumije i koristi osnovne fraze" },
      { value: "A2", label: "A2 — Osnovni", shortLabel: "A2", description: "Može komunicirati u jednostavnim situacijama" },
      { value: "B1", label: "B1 — Srednji", shortLabel: "B1", description: "Nosi se s većinom situacija putovanja" },
      { value: "B2", label: "B2 — Iznad srednjeg", shortLabel: "B2", description: "Može komunicirati tečno i spontano" },
      { value: "C1", label: "C1 — Napredni", shortLabel: "C1", description: "Može jezik koristiti fleksibilno" },
      { value: "C2", label: "C2 — Vještina", shortLabel: "C2", description: "Gotovo na razini izvornog" },
    ],
  },
  {
    name: "Serbian", code: "sr", flag: "🇷🇸", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Početnik", shortLabel: "A1", description: "Razume i koristi osnovne fraze" },
      { value: "A2", label: "A2 — Osnovni", shortLabel: "A2", description: "Može komunicirati u jednostavnim situacijama" },
      { value: "B1", label: "B1 — Srednji", shortLabel: "B1", description: "Nosi se sa većinom situacija putovanja" },
      { value: "B2", label: "B2 — Iznad srednjeg", shortLabel: "B2", description: "Može komunicirati tečno i spontano" },
      { value: "C1", label: "C1 — Napredni", shortLabel: "C1", description: "Može jezik koristiti fleksibilno" },
      { value: "C2", label: "C2 — Sposobnost", shortLabel: "C2", description: "Gotovo na nivou izvornog" },
    ],
  },
  {
    name: "Bulgarian", code: "bg", flag: "🇧🇬", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Начинаещ", shortLabel: "A1", description: "Разбира и използва основни фрази" },
      { value: "A2", label: "A2 — Основен", shortLabel: "A2", description: "Може да комуникира в прости ситуации" },
      { value: "B1", label: "B1 — Среден", shortLabel: "B1", description: "Справя се с повечето пътни ситуации" },
      { value: "B2", label: "B2 — Над среден", shortLabel: "B2", description: "Може да взаимодейства свободно" },
      { value: "C1", label: "C1 — Напреднал", shortLabel: "C1", description: "Може да използва езика гъвкаво" },
      { value: "C2", label: "C2 — Владеене", shortLabel: "C2", description: "Почти на ниво на роден език" },
    ],
  },
  {
    name: "Lithuanian", code: "lt", flag: "🇱🇹", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Pradedantis", shortLabel: "A1", description: "Supranta ir naudoja pagrindines frazes" },
      { value: "A2", label: "A2 — Pagrindinis", shortLabel: "A2", description: "Gali bendrauti paprastose situacijose" },
      { value: "B1", label: "B1 — Vidutinis", shortLabel: "B1", description: "Susidoroja su dauguma kelionių situacijų" },
      { value: "B2", label: "B2 — Virš vidutinio", shortLabel: "B2", description: "Gali sklandžiai ir spontaniškai bendrauti" },
      { value: "C1", label: "C1 — Pažengęs", shortLabel: "C1", description: "Gali lanksčiai naudoti kalbą" },
      { value: "C2", label: "C2 — Įvaldymas", shortLabel: "C2", description: "Beveik gimtoji kalba" },
    ],
  },
  {
    name: "Latvian", code: "lv", flag: "🇱🇻", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Iesācējs", shortLabel: "A1", description: "Saprot un lieto pamata frāzes" },
      { value: "A2", label: "A2 — Pamata", shortLabel: "A2", description: "Var sazināties vienkāršās situācijās" },
      { value: "B1", label: "B1 — Vidējs", shortLabel: "B1", description: "Tiek galā ar lielāko daļu ceļojuma situāciju" },
      { value: "B2", label: "B2 — Virs vidējā", shortLabel: "B2", description: "Var sazināties plūstoši un spontāni" },
      { value: "C1", label: "C1 — Augstāks", shortLabel: "C1", description: "Var elastīgi lietot valodu" },
      { value: "C2", label: "C2 — Pārvaldīšana", shortLabel: "C2", description: "Gandrīz kā dzimtā valoda" },
    ],
  },
  {
    name: "Estonian", code: "et", flag: "🇪🇪", levelSystem: "CEFR",
    levels: [
      { value: "A1", label: "A1 — Algaja", shortLabel: "A1", description: "Mõistab ja kasutab põhilisi fraase" },
      { value: "A2", label: "A2 — Põhi", shortLabel: "A2", description: "Suudab suhelda lihtsates olukordades" },
      { value: "B1", label: "B1 — Keskmine", shortLabel: "B1", description: "Tuleb toime enamiku reisisituatsioonidega" },
      { value: "B2", label: "B2 — Üle keskmise", shortLabel: "B2", description: "Suudab suhelda sujuvalt ja spontaanselt" },
      { value: "C1", label: "C1 — Kõrgem", shortLabel: "C1", description: "Suudab keelt paindlikult kasutada" },
      { value: "C2", label: "C2 — Valdamine", shortLabel: "C2", description: "Peaaegu emakeele tase" },
    ],
  },
];

// ── Lookup helpers ─────────────────────────────────────────────────────

/**
 * Get the level options for a specific language.
 * Falls back to CEFR if the language is not found.
 */
export function getLevelsForLanguage(languageName: string): LanguageLevel[] {
  const lang = LANGUAGES.find(
    (l) =>
      l.name.toLowerCase() === languageName.toLowerCase() ||
      l.code.toLowerCase() === languageName.toLowerCase()
  );
  return lang?.levels ?? LANGUAGES[0].levels; // Default to English/CEFR
}

/**
 * Get the full language config for a specific language.
 */
export function getLanguageConfig(languageName: string): LanguageConfig | undefined {
  return LANGUAGES.find(
    (l) =>
      l.name.toLowerCase() === languageName.toLowerCase() ||
      l.code.toLowerCase() === languageName.toLowerCase()
  );
}

/**
 * Get all language names for dropdowns.
 */
export function getAllLanguageNames(): string[] {
  return LANGUAGES.map((l) => l.name);
}

/**
 * Validate that a proficiency level is valid for a given language.
 */
export function isValidLevel(languageName: string, level: string): boolean {
  const levels = getLevelsForLanguage(languageName);
  return levels.some((l) => l.value === level);
}

/**
 * Get the display label for a level value.
 */
export function getLevelLabel(languageName: string, levelValue: string): string {
  const levels = getLevelsForLanguage(languageName);
  const level = levels.find((l) => l.value === levelValue);
  return level?.label ?? levelValue;
}

// ── Backward-compatible exports ────────────────────────────────────────

/** Legacy export used by onboarding, teacher register, and API routes */
export const TEACHING_LANGUAGES = LANGUAGES.map((l) => ({
  name: l.name,
  code: l.code,
  flag: l.flag,
}));
