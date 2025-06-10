/**
 * Serbian NLP Utilities for Ticket Categorization
 * Handles Serbian language specific preprocessing for AI model training
 */

export interface SerbianTextFeatures {
  normalized: string;
  tokens: string[];
  lemmas: string[];
  nGrams: {
    unigrams: string[];
    bigrams: string[];
    trigrams: string[];
  };
  keywords: string[];
  language: 'cyrillic' | 'latin';
}

export interface CategoryKeywords {
  [category: string]: string[];
}

/**
 * Serbian stop words (common words to filter out)
 */
export const SERBIAN_STOP_WORDS = new Set([
  // Básni čestice i veznici
  'i', 'a', 'u', 'na', 'za', 'sa', 'da', 'se', 'je', 'su', 'bi', 'ni', 'ili', 'ako',
  'kad', 'što', 'kako', 'gdje', 'kada', 'zašto', 'kojem', 'koji', 'koja', 'koje',
  
  // Ćirilica equivalent
  'и', 'а', 'у', 'на', 'за', 'са', 'да', 'се', 'је', 'су', 'би', 'ни', 'или', 'ако',
  'кад', 'што', 'како', 'где', 'када', 'зашто', 'којем', 'који', 'која', 'које',
  
  // Common verbs
  'biti', 'imati', 'moći', 'htjeti', 'trebati', 'doći', 'ići', 'dati', 'uzeti',
  'бити', 'имати', 'моћи', 'хтети', 'требати', 'доћи', 'ићи', 'дати', 'узети',
  
  // Pronouns
  'ja', 'ti', 'on', 'ona', 'ono', 'mi', 'vi', 'oni', 'one', 'ovaj', 'taj', 'ovako',
  'ја', 'ти', 'он', 'она', 'оно', 'ми', 'ви', 'они', 'оне', 'овај', 'тај', 'овако',
  
  // Numbers
  'jedan', 'dva', 'tri', 'četiri', 'pet', 'šest', 'sedam', 'osam', 'devet', 'deset',
  'један', 'два', 'три', 'четири', 'пет', 'шест', 'седам', 'осам', 'девет', 'десет',
  
  // Time expressions
  'danas', 'jučer', 'sutra', 'sada', 'uvijek', 'nikad', 'ponekad', 'često',
  'данас', 'јуче', 'сутра', 'сада', 'увек', 'никад', 'понекад', 'често',
  
  // Common prepositions
  'od', 'do', 'iz', 'kroz', 'oko', 'bez', 'osim', 'zbog', 'tokom', 'prije', 'poslije',
  'од', 'до', 'из', 'кроз', 'око', 'без', 'осим', 'због', 'током', 'пре', 'после'
]);

/**
 * Category-specific keywords for Serbian IT terminology
 */
export const CATEGORY_KEYWORDS: CategoryKeywords = {
  HARDWARE: [
    // Latin
    'računar', 'kompjuter', 'štampač', 'printer', 'skener', 'scanner', 'miš', 'mouse',
    'tastatura', 'keyboard', 'monitor', 'ekran', 'disk', 'hard', 'memorija', 'ram',
    'procesor', 'cpu', 'matična', 'motherboard', 'napajanje', 'power', 'ventilator',
    'fan', 'kablovi', 'cables', 'portovi', 'ports', 'usb', 'hdmi', 'vga',
    
    // Cyrillic
    'рачунар', 'компјутер', 'штампач', 'скенер', 'миш', 'тастатура', 'монитор', 
    'екран', 'диск', 'меморија', 'процесор', 'матична', 'напајање', 'вентилатор',
    'каблови', 'портови'
  ],
  
  SOFTWARE: [
    // Latin
    'program', 'aplikacija', 'softver', 'software', 'instalacija', 'installation',
    'ažuriranje', 'update', 'verzija', 'version', 'greška', 'error', 'bug',
    'windows', 'office', 'word', 'excel', 'powerpoint', 'outlook', 'chrome',
    'firefox', 'antivirus', 'firewall', 'adobe', 'pdf',
    
    // Cyrillic  
    'програм', 'апликација', 'софтвер', 'инсталација', 'ажурирање', 'верзија',
    'грешка', 'вирус', 'антивирус'
  ],
  
  NETWORK: [
    // Latin
    'internet', 'mreža', 'network', 'veza', 'konekcija', 'connection', 'wifi',
    'wireless', 'lan', 'ethernet', 'ruter', 'router', 'switch', 'modem',
    'ip', 'adresa', 'address', 'dns', 'server', 'bandwidth', 'brzina', 'speed',
    'vpn', 'firewall', 'proxy',
    
    // Cyrillic
    'интернет', 'мрежа', 'веза', 'конекција', 'рутер', 'адреса', 'сервер', 'брзина'
  ],
  
  ACCOUNT_ACCESS: [
    // Latin
    'nalog', 'account', 'korisničko', 'username', 'pristup', 'access', 'prava',
    'permissions', 'blokiran', 'blocked', 'aktivacija', 'activation', 'admin',
    'administrator', 'privilegije', 'privileges', 'autentifikacija', 'authentication',
    'autorizacija', 'authorization',
    
    // Cyrillic
    'налог', 'корисничко', 'приступ', 'права', 'блокиран', 'активација', 'админ',
    'администратор', 'привилегије', 'аутентификација', 'ауторизација'
  ],
  
  PASSWORDS: [
    // Latin
    'lozinka', 'password', 'šifra', 'code', 'pin', 'reset', 'resetovanje',
    'promena', 'change', 'forgot', 'zaboravio', 'istekla', 'expired',
    'prijavljivanje', 'login', 'signin', 'caps', 'lock',
    
    // Cyrillic
    'лозинка', 'шифра', 'ресет', 'ресетовање', 'промена', 'заборавио', 'истекла',
    'пријављивање'
  ],
  
  EMAIL: [
    // Latin
    'email', 'imejl', 'mail', 'pošta', 'elektronska', 'outlook', 'thunderbird',
    'gmail', 'slanje', 'sending', 'primanje', 'receiving', 'inbox', 'outbox',
    'spam', 'attachment', 'prilog', 'sinhronizacija', 'sync',
    
    // Cyrillic
    'имејл', 'пошта', 'електронска', 'слање', 'примање', 'прилог', 'синхронизација'
  ],
  
  SYSTEM_ERRORS: [
    // Latin
    'greška', 'error', 'crash', 'ruši', 'bsod', 'plavi', 'ekran', 'blue', 'screen',
    'restart', 'reboot', 'zaglavi', 'freeze', 'sporo', 'slow', 'performance',
    'memory', 'leak', 'critical', 'system', 'windows', 'fatal',
    
    // Cyrillic
    'грешка', 'руши', 'плави', 'екран', 'рестарт', 'заглави', 'споро', 'систем',
    'критична', 'фатална'
  ],
  
  TRAINING_SUPPORT: [
    // Latin
    'obuka', 'training', 'kako', 'how', 'uputstvo', 'instruction', 'manual',
    'pomoć', 'help', 'podrška', 'support', 'učenje', 'learning', 'tutorial',
    'kurs', 'course', 'procedura', 'procedure', 'objašnjenje', 'explanation',
    
    // Cyrillic
    'обука', 'како', 'упутство', 'помоћ', 'подршка', 'учење', 'курс', 'процедура',
    'објашњење'
  ],
  
  NEW_REQUESTS: [
    // Latin
    'novi', 'new', 'zahtev', 'request', 'instalacija', 'installation', 'setup',
    'postavljanje', 'konfiguracija', 'configuration', 'potreban', 'needed',
    'trebam', 'need', 'dodaj', 'add', 'kreiraj', 'create',
    
    // Cyrillic
    'нови', 'захтев', 'инсталација', 'постављање', 'конфигурација', 'потребан',
    'требам', 'додај', 'креирај'
  ],
  
  OTHER: [
    // Latin
    'ostalo', 'other', 'razno', 'misc', 'specijalno', 'special', 'custom',
    'neuobičajeno', 'unusual', 'drugo', 'different', 'nestandardno', 'nonstandard',
    
    // Cyrillic
    'остало', 'разно', 'специјално', 'друго', 'неуобичајено', 'нестандардно'
  ]
};

/**
 * Cyrillic to Latin transliteration map
 */
const CYRILLIC_TO_LATIN_MAP: { [key: string]: string } = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ђ': 'đ', 'е': 'e',
  'ж': 'ž', 'з': 'z', 'и': 'i', 'ј': 'j', 'к': 'k', 'л': 'l', 'љ': 'lj',
  'м': 'm', 'н': 'n', 'њ': 'nj', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's',
  'т': 't', 'ћ': 'ć', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'č',
  'џ': 'dž', 'ш': 'š',
  
  // Uppercase
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Ђ': 'Đ', 'Е': 'E',
  'Ж': 'Ž', 'З': 'Z', 'И': 'I', 'Ј': 'J', 'К': 'K', 'Л': 'L', 'Љ': 'Lj',
  'М': 'M', 'Н': 'N', 'Њ': 'Nj', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S',
  'Т': 'T', 'Ћ': 'Ć', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'Č',
  'Џ': 'Dž', 'Ш': 'Š'
};

/**
 * Detect if text is primarily in Cyrillic or Latin script
 */
export function detectScript(text: string): 'cyrillic' | 'latin' {
  const cyrillicChars = text.match(/[а-ш]/gi);
  const latinChars = text.match(/[a-z]/gi);
  
  const cyrillicCount = cyrillicChars ? cyrillicChars.length : 0;
  const latinCount = latinChars ? latinChars.length : 0;
  
  return cyrillicCount > latinCount ? 'cyrillic' : 'latin';
}

/**
 * Transliterate Cyrillic text to Latin
 */
export function transliterateCyrillicToLatin(text: string): string {
  return text.replace(/[а-шА-Ш]/g, (match) => {
    return CYRILLIC_TO_LATIN_MAP[match] || match;
  });
}

/**
 * Normalize Serbian text for processing
 */
export function normalizeSerbianText(text: string): string {
  // Convert to lowercase
  let normalized = text.toLowerCase();
  
  // Remove special characters and punctuation
  normalized = normalized.replace(/[^\wа-ш\s]/gi, ' ');
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Transliterate Cyrillic to Latin for consistency
  normalized = transliterateCyrillicToLatin(normalized);
  
  return normalized;
}

/**
 * Tokenize Serbian text into words
 */
export function tokenizeSerbianText(text: string): string[] {
  const normalized = normalizeSerbianText(text);
  const tokens = normalized.split(/\s+/).filter(token => 
    token.length > 1 && !SERBIAN_STOP_WORDS.has(token)
  );
  
  return tokens;
}

/**
 * Generate n-grams from tokens
 */
export function generateNGrams(tokens: string[], n: number): string[] {
  const nGrams: string[] = [];
  
  for (let i = 0; i <= tokens.length - n; i++) {
    const nGram = tokens.slice(i, i + n).join(' ');
    nGrams.push(nGram);
  }
  
  return nGrams;
}

/**
 * Basic Serbian lemmatization (simplified)
 * Removes common suffixes to get word stems
 */
export function lemmatizeSerbianText(tokens: string[]): string[] {
  const commonSuffixes = [
    // Verb endings
    'ati', 'iti', 'eti', 'ovati', 'ivati', 'avati',
    // Noun endings
    'ost', 'anje', 'enje', 'ić', 'ović', 'evič',
    // Adjective endings
    'ski', 'ški', 'čki', 'ačka', 'ička', 'ovni', 'alni'
  ];
  
  return tokens.map(token => {
    let lemma = token;
    
    // Try to remove common suffixes
    for (const suffix of commonSuffixes) {
      if (token.endsWith(suffix) && token.length > suffix.length + 2) {
        lemma = token.substring(0, token.length - suffix.length);
        break;
      }
    }
    
    return lemma;
  });
}

/**
 * Extract keywords from text based on category keywords
 */
export function extractKeywords(tokens: string[]): string[] {
  const allKeywords = Object.values(CATEGORY_KEYWORDS).flat();
  const foundKeywords: string[] = [];
  
  for (const token of tokens) {
    for (const keyword of allKeywords) {
      const normalizedKeyword = normalizeSerbianText(keyword);
      if (token.includes(normalizedKeyword) || normalizedKeyword.includes(token)) {
        if (!foundKeywords.includes(keyword)) {
          foundKeywords.push(keyword);
        }
      }
    }
  }
  
  return foundKeywords;
}

/**
 * Calculate category scores based on keyword presence
 */
export function calculateCategoryScores(tokens: string[]): { [category: string]: number } {
  const scores: { [category: string]: number } = {};
  
  // Initialize scores
  for (const category of Object.keys(CATEGORY_KEYWORDS)) {
    scores[category] = 0;
  }
  
  // Count keyword matches
  for (const token of tokens) {
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        const normalizedKeyword = normalizeSerbianText(keyword);
        if (token.includes(normalizedKeyword) || normalizedKeyword.includes(token)) {
          scores[category] += 1;
        }
      }
    }
  }
  
  return scores;
}

/**
 * Process Serbian text and extract all features
 */
export function processSerbianText(text: string): SerbianTextFeatures {
  const language = detectScript(text);
  const normalized = normalizeSerbianText(text);
  const tokens = tokenizeSerbianText(text);
  const lemmas = lemmatizeSerbianText(tokens);
  const keywords = extractKeywords(tokens);
  
  const unigrams = tokens;
  const bigrams = generateNGrams(tokens, 2);
  const trigrams = generateNGrams(tokens, 3);
  
  return {
    normalized,
    tokens,
    lemmas,
    nGrams: {
      unigrams,
      bigrams,
      trigrams
    },
    keywords,
    language
  };
}

/**
 * Create TF-IDF features for a collection of documents
 */
export function calculateTFIDF(documents: string[]): { [term: string]: number[] } {
  const allTokens = new Set<string>();
  const docTokens: string[][] = [];
  
  // Tokenize all documents
  for (const doc of documents) {
    const tokens = tokenizeSerbianText(doc);
    docTokens.push(tokens);
    tokens.forEach(token => allTokens.add(token));
  }
  
  const vocab = Array.from(allTokens);
  const tfidf: { [term: string]: number[] } = {};
  
  // Calculate TF-IDF for each term
  for (const term of vocab) {
    const scores: number[] = [];
    
    // Calculate document frequency
    const df = docTokens.filter(tokens => tokens.includes(term)).length;
    const idf = Math.log(documents.length / (df + 1));
    
    for (const tokens of docTokens) {
      // Calculate term frequency
      const tf = tokens.filter(token => token === term).length / tokens.length;
      const tfidfScore = tf * idf;
      scores.push(tfidfScore);
    }
    
    tfidf[term] = scores;
  }
  
  return tfidf;
}

/**
 * Validate Serbian text quality for training
 */
export function validateSerbianText(text: string): {
  isValid: boolean;
  issues: string[];
  score: number;
} {
  const issues: string[] = [];
  let score = 100;
  
  // Check minimum length
  if (text.length < 10) {
    issues.push('Text too short (minimum 10 characters)');
    score -= 30;
  }
  
  // Check for meaningful content
  const tokens = tokenizeSerbianText(text);
  if (tokens.length < 3) {
    issues.push('Too few meaningful words (minimum 3)');
    score -= 25;
  }
  
  // Check for mixed scripts (could indicate encoding issues)
  const hasCyrillic = /[а-ш]/i.test(text);
  const hasLatin = /[a-z]/i.test(text);
  if (hasCyrillic && hasLatin) {
    // This is actually normal for IT texts, just note it
    score -= 5;
  }
  
  // Check for excessive special characters
  const specialCharRatio = (text.match(/[^а-шa-z\s]/gi) || []).length / text.length;
  if (specialCharRatio > 0.3) {
    issues.push('Too many special characters');
    score -= 15;
  }
  
  // Check for keyword presence
  const keywords = extractKeywords(tokens);
  if (keywords.length === 0) {
    issues.push('No IT-related keywords found');
    score -= 10;
  }
  
  return {
    isValid: score >= 50,
    issues,
    score: Math.max(0, score)
  };
}

export default {
  processSerbianText,
  normalizeSerbianText,
  tokenizeSerbianText,
  detectScript,
  transliterateCyrillicToLatin,
  generateNGrams,
  lemmatizeSerbianText,
  extractKeywords,
  calculateCategoryScores,
  calculateTFIDF,
  validateSerbianText,
  CATEGORY_KEYWORDS,
  SERBIAN_STOP_WORDS
}; 