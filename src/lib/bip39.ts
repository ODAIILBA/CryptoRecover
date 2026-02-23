/**
 * BIP39 English Wordlist (Abbreviated for demo - expand to full 2048 words in production)
 * Source: https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt
 */

// NOTE: This is abbreviated. In production, include all 2048 BIP39 words
export const BIP39_WORDLIST = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
  "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
  "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
  "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
  "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert",
  "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter",
  "always", "amateur", "amazing", "among", "amount", "amused", "analyst", "anchor", "ancient", "anger",
  "angle", "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
  "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april", "arch", "arctic",
  "area", "arena", "argue", "arm", "armed", "armor", "army", "around", "arrange", "arrest",
  // Add more words here - total should be 2048 words
  "arrest", "arrive", "arrow", "art", "artefact", "artist", "artwork", "ask", "aspect", "assault",
  "asset", "assist", "assume", "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract",
  "auction", "audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado", "avoid",
  "awake", "aware", "away", "awesome", "awful", "awkward", "axis", "baby", "bachelor", "bacon",
  "badge", "bag", "balance", "balcony", "ball", "bamboo", "banana", "banner", "bar", "barely",
  "bargain", "barrel", "base", "basic", "basket", "battle", "beach", "bean", "beauty", "because",
  "become", "beef", "before", "begin", "behave", "behind", "believe", "below", "belt", "bench",
  "benefit", "best", "betray", "better", "between", "beyond", "bicycle", "bid", "bike", "bind",
  "biology", "bird", "birth", "bitter", "black", "blade", "blame", "blanket", "blast", "bleak",
  "bless", "blind", "blood", "blossom", "blouse", "blue", "blur", "blush", "board", "boat",
  "body", "boil", "bomb", "bone", "bonus", "book", "boost", "border", "boring", "borrow",
  "boss", "bottom", "bounce", "box", "boy", "bracket", "brain", "brand", "brass", "brave",
  "bread", "breeze", "brick", "bridge", "brief", "bright", "bring", "brisk", "broccoli", "broken",
  "bronze", "broom", "brother", "brown", "brush", "bubble", "buddy", "budget", "buffalo", "build",
  "bulb", "bulk", "bullet", "bundle", "bunker", "burden", "burger", "burst", "bus", "business",
  "busy", "butter", "buyer", "buzz", "cabbage", "cabin", "cable", "cactus", "cage", "cake"
];

const BIP39_SET = new Set(BIP39_WORDLIST);

/**
 * Validate if a word is in the BIP39 wordlist
 */
export function isValidBIP39Word(word: string): boolean {
  return BIP39_SET.has(word.toLowerCase());
}

/**
 * Get suggestions for a partial word (autocomplete)
 */
export function getSuggestions(partial: string, limit = 10): string[] {
  const lower = partial.toLowerCase();
  return BIP39_WORDLIST.filter((word) => word.startsWith(lower)).slice(0, limit);
}

/**
 * Validate a complete seed phrase
 */
export function validateSeedPhrase(phrase: string): {
  valid: boolean;
  wordCount: number;
  invalidWords: string[];
} {
  const words = phrase.trim().toLowerCase().split(/\s+/);
  const invalidWords = words.filter((w) => !isValidBIP39Word(w));

  return {
    valid: (words.length === 12 || words.length === 24) && invalidWords.length === 0,
    wordCount: words.length,
    invalidWords,
  };
}

/**
 * Analyze a partial seed phrase for common mistakes
 */
export function analyzeSeedPhrase(phrase: string): {
  words: string[];
  validWords: string[];
  invalidWords: string[];
  missingWords: number;
  commonMistakes: string[];
} {
  const words = phrase.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const validWords = words.filter((w) => isValidBIP39Word(w));
  const invalidWords = words.filter((w) => !isValidBIP39Word(w));

  const commonMistakes: string[] = [];

  // Check for common mistakes
  invalidWords.forEach((word) => {
    // Similar word suggestions
    const similar = findSimilarWords(word, 2);
    if (similar.length > 0) {
      commonMistakes.push(`"${word}" might be "${similar[0]}" (typo detected)`);
    }

    // Check for common substitutions
    if (word.includes("0")) {
      commonMistakes.push(`"${word}" contains "0" - did you mean "o"?`);
    }
    if (word.includes("1")) {
      commonMistakes.push(`"${word}" contains "1" - did you mean "l" or "i"?`);
    }
  });

  return {
    words,
    validWords,
    invalidWords,
    missingWords: (words.length <= 12 ? 12 : 24) - validWords.length,
    commonMistakes,
  };
}

/**
 * Find similar words using Levenshtein distance
 */
function findSimilarWords(word: string, maxDistance = 2, limit = 3): string[] {
  return BIP39_WORDLIST.filter((w) => levenshteinDistance(word, w) <= maxDistance).slice(0, limit);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
