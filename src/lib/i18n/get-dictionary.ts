import { ar, type Dictionary } from './dictionaries/ar';
import { en } from './dictionaries/en';
import { type Locale } from './config';

export function getDictionary(locale: Locale): Dictionary {
  switch (locale) {
    case 'en':
      return en;
    case 'ar':
    default:
      return ar;
  }
}
