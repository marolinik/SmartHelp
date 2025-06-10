/**
 * Serbian Spell Checker Service
 * Provides spell checking and text suggestions for Serbian language
 */

interface SpellCheckResult {
  isCorrect: boolean;
  suggestions: string[];
  position?: {
    start: number;
    end: number;
  };
}

interface SpellCheckError {
  word: string;
  suggestions: string[];
  start: number;
  end: number;
  type: 'spelling' | 'grammar';
}

class SerbianSpellChecker {
  private commonWords: Set<string>;
  private technicalTerms: Set<string>;
  private grammarRules: Map<string, string[]>;

  constructor() {
    this.commonWords = new Set();
    this.technicalTerms = new Set();
    this.grammarRules = new Map();
    this.initializeDictionaries();
  }

  /**
   * Иницијализује речнике и правила
   */
  private initializeDictionaries() {
    // Основни српски речник - најчешће коришћене речи
    const basicWords = [
      // Заменице
      'ја', 'ти', 'он', 'она', 'оно', 'ми', 'ви', 'они', 'оне',
      'мене', 'тебе', 'њега', 'ње', 'нас', 'вас', 'њих',
      'мој', 'твој', 'његов', 'њен', 'наш', 'ваш', 'њихов',
      'овај', 'тај', 'онај', 'који', 'која', 'које',
      
      // Глаголи
      'јесам', 'јеси', 'јесте', 'јесмо', 'јесте', 'јесу',
      'бити', 'имати', 'моћи', 'хтети', 'знати', 'ићи', 'доћи',
      'рећи', 'дати', 'узети', 'видети', 'чути', 'радити',
      'живети', 'волети', 'мислити', 'говорити', 'писати',
      'читати', 'учити', 'играти', 'певати', 'спавати',
      
      // Именице
      'човек', 'жена', 'дете', 'мушкарац', 'девојка', 'дечак',
      'мајка', 'отац', 'син', 'ћерка', 'брат', 'сестра',
      'кућа', 'стан', 'соба', 'кухиња', 'купатило',
      'школа', 'посао', 'рад', 'време', 'дан', 'ноћ',
      'јутро', 'вече', 'година', 'месец', 'недеља',
      'понедељак', 'уторак', 'среда', 'четвртак', 'петак', 'субота', 'недеља',
      'јануар', 'фебруар', 'март', 'април', 'мај', 'јун',
      'јул', 'август', 'септембар', 'октобар', 'новембар', 'децембар',
      
      // Придеви
      'добар', 'лош', 'велик', 'мали', 'нов', 'стар',
      'лепо', 'ружно', 'брз', 'спор', 'јак', 'слаб',
      'паметан', 'глуп', 'висок', 'низак', 'дебео', 'танак',
      
      // Прилози
      'данас', 'јуче', 'сутра', 'сада', 'тада', 'овде', 'тамо',
      'горе', 'доле', 'лево', 'десно', 'напред', 'назад',
      'брзо', 'споро', 'добро', 'лоше', 'много', 'мало',
      
      // Предлози и везници
      'у', 'на', 'за', 'од', 'до', 'из', 'са', 'без', 'кроз',
      'преко', 'испод', 'изнад', 'поред', 'између', 'око',
      'и', 'а', 'али', 'или', 'да', 'ако', 'када', 'док',
      'јер', 'што', 'како', 'где', 'куда', 'одакле',
      
      // Бројеви
      'један', 'два', 'три', 'четири', 'пет', 'шест', 'седам',
      'осам', 'девет', 'десет', 'једанаест', 'дванаест',
      'тринаест', 'четрнаест', 'петнаест', 'шеснаест',
      'седамнаест', 'осамнаест', 'деветнаест', 'двадесет',
      'тридесет', 'четрдесет', 'педесет', 'шездесет',
      'седамдесет', 'осамдесет', 'деведесет', 'сто', 'хиљаду'
    ];

    // Технички термини за IT подршку
    const techTerms = [
      // Рачунарски термини
      'рачунар', 'компјутер', 'лаптоп', 'тастатура', 'миш',
      'монитор', 'екран', 'штампач', 'скенер', 'камера',
      'микрофон', 'звучници', 'слушалице',
      
      // Софтвер
      'софтвер', 'програм', 'апликација', 'систем', 'база',
      'подаци', 'фајл', 'документ', 'слика', 'видео',
      'аудио', 'музика', 'филм', 'игра',
      
      // Интернет
      'интернет', 'веб', 'сајт', 'страница', 'линк', 'веза',
      'емаил', 'порука', 'чет', 'форум', 'блог',
      'друштвене', 'мреже', 'фејсбук', 'твитер', 'инстаграм',
      
      // Безбедност
      'лозинка', 'шифра', 'безбедност', 'заштита', 'вирус',
      'малвер', 'хакер', 'напад', 'заштитни', 'зид',
      
      // Мрежа
      'мрежа', 'рутер', 'модем', 'кабел', 'бежично',
      'вајфај', 'блутут', 'конекција', 'веза',
      
      // Техничка подршка
      'подршка', 'помоћ', 'решење', 'проблем', 'грешка',
      'упутство', 'водич', 'туторијал', 'инсталација',
      'ажурирање', 'надоградња', 'поправка', 'сервис'
    ];

    // Додај речи у речнике
    basicWords.forEach(word => this.commonWords.add(word.toLowerCase()));
    techTerms.forEach(word => this.technicalTerms.add(word.toLowerCase()));

    // Граматичка правила - чести облици
    this.grammarRules.set('јесам', ['сам', 'јесам']);
    this.grammarRules.set('јеси', ['си', 'јеси']);
    this.grammarRules.set('јесте', ['је', 'јесте']);
    this.grammarRules.set('јесмо', ['смо', 'јесмо']);
    this.grammarRules.set('јесте', ['сте', 'јесте']);
    this.grammarRules.set('јесу', ['су', 'јесу']);
  }

  /**
   * Проверава правопис речи
   */
  checkWord(word: string): SpellCheckResult {
    const cleanWord = this.cleanWord(word);
    const lowerWord = cleanWord.toLowerCase();

    // Провери у речницима
    if (this.commonWords.has(lowerWord) || this.technicalTerms.has(lowerWord)) {
      return {
        isCorrect: true,
        suggestions: []
      };
    }

    // Генериши предлоге
    const suggestions = this.generateSuggestions(cleanWord);

    return {
      isCorrect: false,
      suggestions: suggestions.slice(0, 5) // Врати максимално 5 предлога
    };
  }

  /**
   * Проверава правопис целог текста
   */
  checkText(text: string): SpellCheckError[] {
    const errors: SpellCheckError[] = [];
    const words = this.extractWords(text);

    words.forEach(({ word, start, end }) => {
      const result = this.checkWord(word);
      if (!result.isCorrect) {
        errors.push({
          word,
          suggestions: result.suggestions,
          start,
          end,
          type: 'spelling'
        });
      }
    });

    return errors;
  }

  /**
   * Извлачи речи из текста са позицијама
   */
  private extractWords(text: string): Array<{ word: string; start: number; end: number }> {
    const words: Array<{ word: string; start: number; end: number }> = [];
    const wordRegex = /[а-шђчћжА-ШЂЧЋЖ]+/g;
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
      words.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return words;
  }

  /**
   * Чисти реч од интерпункције
   */
  private cleanWord(word: string): string {
    return word.replace(/[^\wа-шђчћжА-ШЂЧЋЖ]/g, '');
  }

  /**
   * Генерише предлоге за неисправну реч
   */
  private generateSuggestions(word: string): string[] {
    const suggestions: string[] = [];
    const lowerWord = word.toLowerCase();

    // Провери све речи у речницима
    const allWords = [...this.commonWords, ...this.technicalTerms];

    // Пронађи сличне речи користећи Levenshtein distance
    allWords.forEach(dictWord => {
      const distance = this.levenshteinDistance(lowerWord, dictWord);
      const maxDistance = Math.max(1, Math.floor(word.length / 3));

      if (distance <= maxDistance) {
        suggestions.push(dictWord);
      }
    });

    // Сортирај по сличности
    suggestions.sort((a, b) => {
      const distA = this.levenshteinDistance(lowerWord, a);
      const distB = this.levenshteinDistance(lowerWord, b);
      return distA - distB;
    });

    // Додај варијанте са честим грешкама
    const commonMistakes = this.getCommonMistakeVariants(word);
    commonMistakes.forEach(variant => {
      if (!suggestions.includes(variant) && 
          (this.commonWords.has(variant) || this.technicalTerms.has(variant))) {
        suggestions.unshift(variant);
      }
    });

    return suggestions;
  }

  /**
   * Рачуна Levenshtein distance између две речи
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Генерише варијанте са честим грешкама у куцању
   */
  private getCommonMistakeVariants(word: string): string[] {
    const variants: string[] = [];
    const lowerWord = word.toLowerCase();

    // Чести замени карактера
    const substitutions = [
      ['ц', 'ч'], ['ч', 'ц'], ['ћ', 'ч'], ['ч', 'ћ'],
      ['ђ', 'дж'], ['дж', 'ђ'], ['ж', 'з'], ['з', 'ж'],
      ['ш', 'с'], ['с', 'ш'], ['х', 'к'], ['к', 'х']
    ];

    substitutions.forEach(([from, to]) => {
      if (lowerWord.includes(from)) {
        variants.push(lowerWord.replace(new RegExp(from, 'g'), to));
      }
    });

    // Додавање/уклањање карактера на крају
    if (lowerWord.length > 2) {
      variants.push(lowerWord.slice(0, -1)); // Уклони последњи карактер
      variants.push(lowerWord + 'а'); // Додај 'а'
      variants.push(lowerWord + 'е'); // Додај 'е'
      variants.push(lowerWord + 'и'); // Додај 'и'
    }

    return variants;
  }

  /**
   * Додаје нову реч у кориснички речник
   */
  addToUserDictionary(word: string): void {
    const cleanWord = this.cleanWord(word).toLowerCase();
    if (cleanWord) {
      this.technicalTerms.add(cleanWord);
      // У стварној имплементацији би се ово сачувало у localStorage или backend
      localStorage.setItem('userDictionary', 
        JSON.stringify([...this.technicalTerms].filter(w => !this.commonWords.has(w)))
      );
    }
  }

  /**
   * Учитава кориснички речник
   */
  loadUserDictionary(): void {
    try {
      const saved = localStorage.getItem('userDictionary');
      if (saved) {
        const userWords = JSON.parse(saved);
        userWords.forEach((word: string) => this.technicalTerms.add(word));
      }
    } catch (error) {
      console.warn('Не могу да учитам кориснички речник:', error);
    }
  }

  /**
   * Проверава да ли је реч у речнику
   */
  isInDictionary(word: string): boolean {
    const cleanWord = this.cleanWord(word).toLowerCase();
    return this.commonWords.has(cleanWord) || this.technicalTerms.has(cleanWord);
  }

  /**
   * Враћа предлоге за аутокомплетирање
   */
  getAutocompleteSuggestions(prefix: string, limit: number = 10): string[] {
    const lowerPrefix = prefix.toLowerCase();
    const suggestions: string[] = [];

    // Пронађи речи које почињу са префиксом
    [...this.commonWords, ...this.technicalTerms].forEach(word => {
      if (word.startsWith(lowerPrefix) && word !== lowerPrefix) {
        suggestions.push(word);
      }
    });

    // Сортирај по дужини (краће речи прво)
    suggestions.sort((a, b) => a.length - b.length);

    return suggestions.slice(0, limit);
  }
}

// Експортуј singleton инстанцу
export const serbianSpellChecker = new SerbianSpellChecker();
export default serbianSpellChecker;
export type { SpellCheckResult, SpellCheckError }; 