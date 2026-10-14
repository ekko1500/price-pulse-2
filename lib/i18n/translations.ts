export type Language = 'en' | 'my';

export interface Strings {
  appName: string;
  tagline: string;
  signIn: string;
  signOut: string;
  register: string;
  username: string;
  password: string;
  phone: string;
  businessName: string;
  role: string;
  retailer: string;
  wholesaler: string;
  admin: string;
  loginTitle: string;
  registerTitle: string;
  demoAccess: string;
  demoMode: string;
  loading: string;
  save: string;
  cancel: string;
  confirm: string;
  close: string;
  search: string;
  actions: string;
  status: string;
  // navigation
  navOverview: string;
  navPriceUpdate: string;
  navCatalog: string;
  navConnections: string;
  navOrders: string;
  navHistory: string;
  navInventory: string;
  navSuppliers: string;
  navAlerts: string;
  navNotifications: string;
  navAccounts: string;
  navAudit: string;
  navDemo: string;
  navSell: string;
  navSales: string;
  navPricing: string;
  // pricing
  currentPrice: string;
  newPrice: string;
  previousPrice: string;
  priceChange: string;
  grossProfit: string;
  grossMargin: string;
  recommendedPrice: string;
  targetMargin: string;
  sellingPrice: string;
  wholesaleCost: string;
  effectiveDate: string;
  supplierMessage: string;
  extract: string;
  reviewAndPublish: string;
  publish: string;
  draft: string;
  confidence: string;
  warnings: string;
  missingFields: string;
  originalMessage: string;
  product: string;
  unit: string;
  packageSize: string;
  brand: string;
  category: string;
  // alerts / misc
  lowStock: string;
  expirySoon: string;
  unread: string;
  noData: string;
  cannotCompare: string;
  cheapest: string;
  connected: string;
  pending: string;
  approve: string;
  reject: string;
  requestConnection: string;
  confirmReceipt: string;
  total: string;
  payment: string;
  quantity: string;
  orderStatus: string;
  grossBefore: string;
  grossAfter: string;
  marginBefore: string;
  marginAfter: string;
  resetDemo: string;
  demoResetDone: string;
  error: string;
  success: string;
  disclaimer: string;
  // point of sale
  addToCart: string;
  cart: string;
  checkout: string;
  clearCart: string;
  receipt: string;
  exportPdf: string;
  customerName: string;
  customerPhone: string;
  discount: string;
  paymentMethod: string;
  amountPaid: string;
  changeDue: string;
  subtotal: string;
  completeSale: string;
  saleCompleted: string;
  newSale: string;
  voidSale: string;
  noSales: string;
  stock: string;
  image: string;
  addImage: string;
  removeImage: string;
}

export const translations: Record<Language, Strings> = {
  en: {
    appName: 'PricePulse Myanmar',
    tagline: 'AI-powered wholesale–retail pricing intelligence',
    signIn: 'Sign in',
    signOut: 'Sign out',
    register: 'Create account',
    username: 'Username',
    password: 'Password',
    phone: 'Phone number',
    businessName: 'Business name',
    role: 'I am a',
    retailer: 'Retailer',
    wholesaler: 'Wholesaler',
    admin: 'Administrator',
    loginTitle: 'Sign in to PricePulse',
    registerTitle: 'Create your PricePulse account',
    demoAccess: 'One-click demo access',
    demoMode: 'Demo mode',
    loading: 'Loading…',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    search: 'Search',
    actions: 'Actions',
    status: 'Status',
    navOverview: 'Overview',
    navPriceUpdate: 'Price update',
    navCatalog: 'Catalog',
    navConnections: 'Connections',
    navOrders: 'Orders',
    navHistory: 'Price history',
    navInventory: 'Inventory',
    navSuppliers: 'Suppliers',
    navAlerts: 'Price alerts',
    navNotifications: 'Notifications',
    navAccounts: 'Accounts',
    navAudit: 'Audit log',
    navDemo: 'Demo controls',
    navSell: 'Sell (POS)',
    navSales: 'Sales',
    navPricing: 'Pricing',
    currentPrice: 'Current price',
    newPrice: 'New price',
    previousPrice: 'Previous price',
    priceChange: 'Price change',
    grossProfit: 'Gross profit / unit',
    grossMargin: 'Gross margin',
    recommendedPrice: 'Recommended selling price',
    targetMargin: 'Target gross margin (%)',
    sellingPrice: 'Selling price',
    wholesaleCost: 'Wholesale cost',
    effectiveDate: 'Effective date',
    supplierMessage: 'Supplier message',
    extract: 'Analyse message',
    reviewAndPublish: 'Review & publish',
    publish: 'Publish price',
    draft: 'Draft',
    confidence: 'Confidence',
    warnings: 'Warnings',
    missingFields: 'Missing information',
    originalMessage: 'Original message (unchanged)',
    product: 'Product',
    unit: 'Unit',
    packageSize: 'Package size',
    brand: 'Brand',
    category: 'Category',
    lowStock: 'Low stock',
    expirySoon: 'Expiring soon',
    unread: 'unread',
    noData: 'Nothing here yet.',
    cannotCompare: 'Not directly comparable',
    cheapest: 'Lowest price',
    connected: 'Connected',
    pending: 'Pending',
    approve: 'Approve',
    reject: 'Reject',
    requestConnection: 'Request connection',
    confirmReceipt: 'Confirm receipt',
    total: 'Total',
    payment: 'Payment',
    quantity: 'Quantity',
    orderStatus: 'Order status',
    grossBefore: 'Before change',
    grossAfter: 'After change',
    marginBefore: 'Margin before',
    marginAfter: 'Margin after',
    resetDemo: 'Reset demo data',
    demoResetDone: 'Demo data restored.',
    error: 'Error',
    success: 'Success',
    disclaimer:
      'Illustrative figures. Gross profit is before operating expenses, taxes and other costs — it is not net profit. Sample prices are fictional, not live market data.',
    addToCart: 'Add',
    cart: 'Cart',
    checkout: 'Checkout',
    clearCart: 'Clear cart',
    receipt: 'Receipt',
    exportPdf: 'Export receipt (PDF)',
    customerName: 'Customer name',
    customerPhone: 'Customer phone',
    discount: 'Discount (MMK)',
    paymentMethod: 'Payment method',
    amountPaid: 'Amount paid',
    changeDue: 'Change due',
    subtotal: 'Subtotal',
    completeSale: 'Complete sale',
    saleCompleted: 'Sale completed',
    newSale: 'New sale',
    voidSale: 'Void sale',
    noSales: 'No sales recorded yet.',
    stock: 'Stock',
    image: 'Product image',
    addImage: 'Add image',
    removeImage: 'Remove',
  },
  my: {
    appName: 'PricePulse မြန်မာ',
    tagline: 'လက်ကား–လက်လီ စျေးနှုန်း ထောက်လှမ်းရေး',
    signIn: 'ဝင်ရောက်ရန်',
    signOut: 'ထွက်ရန်',
    register: 'အကောင့်ဖွင့်ရန်',
    username: 'အသုံးပြုသူအမည်',
    password: 'စကားဝှက်',
    phone: 'ဖုန်းနံပါတ်',
    businessName: 'လုပ်ငန်းအမည်',
    role: 'ကျွန်ုပ်သည်',
    retailer: 'လက်လီရောင်းချသူ',
    wholesaler: 'လက်ကားရောင်းချသူ',
    admin: 'စီမံခန့်ခွဲသူ',
    loginTitle: 'PricePulse သို့ ဝင်ရောက်ရန်',
    registerTitle: 'PricePulse အကောင့် ဖွင့်ရန်',
    demoAccess: 'ဒီမိုအကောင့် အလွယ်တကူ ဝင်ရန်',
    demoMode: 'ဒီမို မုဒ်',
    loading: 'ခဏစောင့်ပါ…',
    save: 'သိမ်းရန်',
    cancel: 'မလုပ်တော့ပါ',
    confirm: 'အတည်ပြုရန်',
    close: 'ပိတ်ရန်',
    search: 'ရှာရန်',
    actions: 'လုပ်ဆောင်ချက်',
    status: 'အခြေအနေ',
    navOverview: 'ခြုံငုံသုံးသပ်ချက်',
    navPriceUpdate: 'စျေးနှုန်းပြင်ဆင်ရန်',
    navCatalog: 'ကုန်စည်စာရင်း',
    navConnections: 'ဆက်သွယ်မှုများ',
    navOrders: 'အော်ဒါများ',
    navHistory: 'စျေးနှုန်းမှတ်တမ်း',
    navInventory: 'ကုန်လက်ကျန်',
    navSuppliers: 'ကုန်သည်',
    navAlerts: 'စျေးသတိပေးချက်',
    navNotifications: 'အသိပေးချက်များ',
    navAccounts: 'အကောင့်များ',
    navAudit: 'စစ်ဆေးမှတ်တမ်း',
    navDemo: 'ဒီမို ထိန်းချုပ်မှု',
    navSell: 'အရောင်း (POS)',
    navSales: 'အရောင်းမှတ်တမ်း',
    navPricing: 'စျေးနှုန်း သတ်မှတ်ခြင်း',
    currentPrice: 'လက်ရှိစျေး',
    newPrice: 'စျေးအသစ်',
    previousPrice: 'ယခင်စျေး',
    priceChange: 'စျေးပြောင်းလဲမှု',
    grossProfit: 'အမြတ် / တစ်ခု',
    grossMargin: 'အမြတ်နှုန်း',
    recommendedPrice: 'အကြံပြု ရောင်းစျေး',
    targetMargin: 'ရည်မှန်း အမြတ်နှုန်း (%)',
    sellingPrice: 'ရောင်းစျေး',
    wholesaleCost: 'လက်ကားကုန်ကျစရိတ်',
    effectiveDate: 'အသက်ဝင်သည့်ရက်',
    supplierMessage: 'ကုန်သည်၏ မက်ဆေ့ခ်ျ',
    extract: 'ခွဲခြမ်းစိတ်ဖြာရန်',
    reviewAndPublish: 'ပြန်လည်စစ်ဆေး၍ ထုတ်ပြန်ရန်',
    publish: 'စျေးထုတ်ပြန်ရန်',
    draft: 'မူကြမ်း',
    confidence: 'ယုံကြည်စိတ်ချမှု',
    warnings: 'သတိပေးချက်များ',
    missingFields: 'မရှိသေးသော အချက်အလက်',
    originalMessage: 'မူရင်း မက်ဆေ့ခ်ျ (မပြောင်းလဲ)',
    product: 'ကုန်ပစ္စည်း',
    unit: 'ယူနစ်',
    packageSize: 'အထုပ်အရွယ်အစား',
    brand: 'အမှတ်တံဆိပ်',
    category: 'အမျိုးအစား',
    lowStock: 'လက်ကျန်နည်း',
    expirySoon: 'သက်တမ်းကုန်ခါနီး',
    unread: 'မဖတ်ရသေး',
    noData: 'အချက်အလက် မရှိသေးပါ။',
    cannotCompare: 'တိုက်ရိုက် နှိုင်းယှဉ်၍မရပါ',
    cheapest: 'အနိမ့်ဆုံးစျေး',
    connected: 'ဆက်သွယ်ပြီး',
    pending: 'စောင့်ဆိုင်းနေ',
    approve: 'အတည်ပြု',
    reject: 'ပယ်ချ',
    requestConnection: 'ဆက်သွယ်ရန် တောင်းဆို',
    confirmReceipt: 'ကုန်လက်ခံရရှိကြောင်း အတည်ပြု',
    total: 'စုစုပေါင်း',
    payment: 'ငွေပေးချေမှု',
    quantity: 'အရေအတွက်',
    orderStatus: 'အော်ဒါ အခြေအနေ',
    grossBefore: 'မပြောင်းမီ',
    grossAfter: 'ပြောင်းပြီးနောက်',
    marginBefore: 'အမြတ်နှုန်း (မပြောင်းမီ)',
    marginAfter: 'အမြတ်နှုန်း (ပြောင်းပြီးနောက်)',
    resetDemo: 'ဒီမိုဒေတာ ပြန်လည်သတ်မှတ်ရန်',
    demoResetDone: 'ဒီမိုဒေတာ ပြန်လည်သတ်မှတ်ပြီးပါပြီ။',
    error: 'အမှား',
    success: 'အောင်မြင်ပါသည်',
    disclaimer:
      'ရုပ်ပုံပြပမာဏာများဖြစ်သည်။ အမြတ်သည် လုပ်ငန်းသုံးစရိတ်၊ အခွန်များ မနှုတ်မီ ဖြစ်သည် — အသားတင်အမြတ် မဟုတ်ပါ။ ပြစျေးများသည် စိတ်ကူးပြ စျေးများဖြစ်ပြီး အမှန်တကယ် စျေးကွက်စျေး မဟုတ်ပါ။',
    addToCart: 'ထည့်ရန်',
    cart: 'လှည်း',
    checkout: 'ငွေရှင်းရန်',
    clearCart: 'လှည်းရှင်းရန်',
    receipt: 'ပြေစာ',
    exportPdf: 'ပြေစာ PDF ထုတ်ရန်',
    customerName: 'ဝယ်သူအမည်',
    customerPhone: 'ဝယ်သူဖုန်း',
    discount: 'လျှော့စျေး (ကျပ်)',
    paymentMethod: 'ငွေပေးချေမှုနည်း',
    amountPaid: 'ပေးချေငွေ',
    changeDue: 'ပြန်အမ်းငွေ',
    subtotal: 'စုစုပေါင်းကုန်ကျ',
    completeSale: 'အရောင်းပြီးမြောက်ရန်',
    saleCompleted: 'အရောင်းပြီးမြောက်ပါပြီ',
    newSale: 'အရောင်းအသစ်',
    voidSale: 'ပြန်ဖျက်ရန်',
    noSales: 'အရောင်းမှတ်တမ်း မရှိသေးပါ။',
    stock: 'လက်ကျန်',
    image: 'ကုန်ပစ္စည်း ပုံ',
    addImage: 'ပုံထည့်ရန်',
    removeImage: 'ဖယ်ရှားရန်',
  },
};
