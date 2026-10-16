/** Localised bot messages (English + Burmese). */

export type Lang = 'en' | 'my';

export interface Messages {
  draftTitle: string;
  unknown: string;
  labelProduct: string;
  labelBrand: string;
  labelSize: string;
  labelUnit: string;
  labelOldPrice: string;
  labelNewPrice: string;
  labelEffective: string;
  labelConfidence: string;
  labelMissing: string;

  start: string;
  help: string;
  unknownCommand: string;

  needLogin: string;
  loginUsage: string;
  loginChecking: string;
  loginSuccess: (business: string, role: string) => string;
  loginFailed: (reason: string) => string;
  logout: string;
  notLoggedIn: string;
  whoami: (username: string, business: string, role: string) => string;

  analyzing: string;
  extractFailed: (reason: string) => string;
  pickOrChange: string;
  noCandidates: string;
  chooseProductTitle: string;
  publish: string;
  changeProduct: string;
  cancel: string;
  cancelled: string;
  cancelledBtn: string;
  published: (product: string, oldPrice: string, newPrice: string, notified: number) => string;
  publishFailed: (reason: string) => string;

  productsTitle: string;
  noProducts: string;
  draftsTitle: string;
  noDrafts: string;

  langSet: string;
  langUsage: string;
  error: string;
}

export const en: Messages = {
  draftTitle: 'Price update draft',
  unknown: 'unknown',
  labelProduct: 'Product',
  labelBrand: 'Brand',
  labelSize: 'Package',
  labelUnit: 'Unit',
  labelOldPrice: 'Current price',
  labelNewPrice: 'New price',
  labelEffective: 'Effective',
  labelConfidence: 'Confidence',
  labelMissing: 'Missing',

  start:
    'Welcome to the PricePulse bot.\n\n' +
    'Send me a supplier message and I will prepare a price update for review — for example:\n' +
    '“Starting tomorrow, cooking oil will be 5,800 MMK instead of 5,000.”\n\n' +
    'First, sign in with /login <username> <password>. Send /help for all commands.',
  help:
    'Commands:\n' +
    '/login <username> <password> — sign in to PricePulse\n' +
    '/logout — sign out\n' +
    '/whoami — show the signed-in account\n' +
    '/products — list your wholesale catalog\n' +
    '/drafts — list pending price drafts\n' +
    '/lang <en|my> — switch language\n\n' +
    'Or just send a supplier message (Burmese, English or mixed) and I will extract the price update for you to confirm.',
  unknownCommand: 'Unknown command. Send /help to see what I can do.',

  needLogin: 'Please sign in first with /login <username> <password>.',
  loginUsage: 'Usage: /login <username> <password>',
  loginChecking: 'Signing in…',
  loginSuccess: (business, role) => `Signed in as ${business} (${role}). You can now send supplier messages.`,
  loginFailed: (reason) => `Sign-in failed: ${reason}`,
  logout: 'Signed out.',
  notLoggedIn: 'You are not signed in.',
  whoami: (username, business, role) => `Account: ${username}\nBusiness: ${business}\nRole: ${role}`,

  analyzing: 'Reading the message and preparing a draft…',
  extractFailed: (reason) => `Could not read that message: ${reason}`,
  pickOrChange: 'Choose the matching product below to continue.',
  noCandidates: 'I could not match a product. Pick one from your catalog:',
  chooseProductTitle: 'Choose a product:',
  publish: '✅ Publish',
  changeProduct: '🔁 Change product',
  cancel: '✖️ Cancel',
  cancelled: 'Draft cancelled.',
  cancelledBtn: 'Cancelled.',
  published: (product, oldPrice, newPrice, notified) =>
    `✅ Published: ${product}\n${oldPrice} → ${newPrice} MMK\n${notified} connected retailer(s) notified.`,
  publishFailed: (reason) => `Publish failed: ${reason}`,

  productsTitle: 'Your wholesale catalog:',
  noProducts: 'No products found in your catalog.',
  draftsTitle: 'Pending price drafts:',
  noDrafts: 'No pending drafts.',

  langSet: 'Language set to English.',
  langUsage: 'Usage: /lang <en|my>',
  error: 'Something went wrong. Please try again.',
};

export const my: Messages = {
  draftTitle: 'စျေးနှုန်း မူကြမ်း',
  unknown: 'မသိ',
  labelProduct: 'ကုန်ပစ္စည်း',
  labelBrand: 'အမှတ်တံဆိပ်',
  labelSize: 'အထုပ်',
  labelUnit: 'ယူနစ်',
  labelOldPrice: 'လက်ရှိစျေး',
  labelNewPrice: 'စျေးအသစ်',
  labelEffective: 'အသက်ဝင်မည့်ရက်',
  labelConfidence: 'ယုံကြည်စိတ်ချမှု',
  labelMissing: 'လိုအပ်ချက်',

  start:
    'PricePulse bot မှ ကြိုဆိုပါတယ်။\n\n' +
    'ကုန်သည်မက်ဆေ့ခ်ျ ပို့ပေးပါ၊ စျေးနှုန်း မူကြမ်း ပြင်ဆင်ပေးပါမယ် — ဥပမာ။\n' +
    '“မနက်ဖြန် စတင်၍ စားသုံးဆီ ၁ လီတာ ၅,၈၀၀ ကျပ် ဖြစ်မည်”\n\n' +
    'အရင် /login <username> <password> ဖြင့် ဝင်ရောက်ပါ။ အားလုံးသော command များအတွက် /help ပို့ပါ။',
  help:
    'Commands:\n' +
    '/login <username> <password> — PricePulse သို့ ဝင်ရောက်ရန်\n' +
    '/logout — ထွက်ရန်\n' +
    '/whoami — လက်ရှိအကောင့် ကြည့်ရန်\n' +
    '/products — သင့်ကုန်စည်စာရင်း ကြည့်ရန်\n' +
    '/drafts — စောင့်ဆိုင်းနေသော မူကြမ်းများ\n' +
    '/lang <en|my> — ဘာသာစကား ပြောင်းရန်\n\n' +
    'သို့မဟုတ် ကုန်သည်မက်ဆေ့ခ်ျ (မြန်မာ၊ အင်္ဂလိပ် သို့မဟုတ် ရောနှော) ကို တိုက်ရိုက်ပို့ပါ။',
  unknownCommand: 'မသိသော command ဖြစ်ပါသည်။ /help ပို့ပါ။',

  needLogin: 'အရင် /login <username> <password> ဖြင့် ဝင်ရောက်ပါ။',
  loginUsage: 'အသုံးပြုနည်း: /login <username> <password>',
  loginChecking: 'ဝင်ရောက်နေသည်…',
  loginSuccess: (business, role) => `${business} (${role}) အဖြစ် ဝင်ရောက်ပြီးပါပြီ။`,
  loginFailed: (reason) => `ဝင်ရောက်မှု မအောင်မြင်ပါ: ${reason}`,
  logout: 'ထွက်ပြီးပါပြီ။',
  notLoggedIn: 'သင်သည် ဝင်ရောက်မထားပါ။',
  whoami: (username, business, role) => `အကောင့်: ${username}\nလုပ်ငန်း: ${business}\nအခန်းကဏ္ဍ: ${role}`,

  analyzing: 'မက်ဆေ့ခ်ျကို ဖတ်ပြီး မူကြမ်း ပြင်ဆင်နေသည်…',
  extractFailed: (reason) => `မက်ဆေ့ခ်ျကို မဖတ်နိုင်ပါ: ${reason}`,
  pickOrChange: 'အောက်မှ ကိုက်ညီသော ကုန်ပစ္စည်းကို ရွေးပါ။',
  noCandidates: 'ကုန်ပစ္စည်း မကိုက်ညီပါ။ သင့်စာရင်းမှ ရွေးပါ။',
  chooseProductTitle: 'ကုန်ပစ္စည်း ရွေးပါ:',
  publish: '✅ ထုတ်ပြန်',
  changeProduct: '🔁 ကုန်ပစ္စည်း ပြောင်း',
  cancel: '✖️ ပယ်ဖျက်',
  cancelled: 'မူကြမ်း ပယ်ဖျက်ပြီးပါပြီ။',
  cancelledBtn: 'ပယ်ဖျက်ပြီး။',
  published: (product, oldPrice, newPrice, notified) =>
    `✅ ထုတ်ပြန်ပြီး: ${product}\n${oldPrice} → ${newPrice} ကျပ်\nရောင်းချမှု ဆက်သွယ်ထားသော လက်လီ ${notified} ဦး အသိပေးပြီး။`,
  publishFailed: (reason) => `ထုတ်ပြန်မှု မအောင်မြင်ပါ: ${reason}`,

  productsTitle: 'သင့်ကုန်စည်စာရင်း:',
  noProducts: 'ကုန်စည်စာရင်းထဲတွင် မတွေ့ပါ။',
  draftsTitle: 'စောင့်ဆိုင်းနေသော မူကြမ်းများ:',
  noDrafts: 'စောင့်ဆိုင်းနေသော မူကြမ်း မရှိပါ။',

  langSet: 'ဘာသာစကားကို မြန်မာ သတ်မှတ်ပြီးပါပြီ။',
  langUsage: 'အသုံးပြုနည်း: /lang <en|my>',
  error: 'တစ်ခုခု မှားယွင်းနေပါသည်။ ထပ်မံ ကြိုးစားပါ။',
};

export const messages: Record<Lang, Messages> = { en, my };

export function t(lang: Lang): Messages {
  return messages[lang] ?? en;
}
