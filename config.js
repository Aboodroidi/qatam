// ============================================================
//  إعدادات الاتصال بقاعدة البيانات (Supabase)
//  Fill these two values in after creating your free Supabase
//  project. See README.md for step-by-step instructions.
// ============================================================

window.QATAM_CONFIG = {
  // من Supabase → Project Settings → API
  SUPABASE_URL: "",       // مثال: https://abcdxyz.supabase.co
  SUPABASE_ANON_KEY: "",  // المفتاح العام (anon public)

  // عملة المزرعة (تظهر بجانب المبالغ)
  CURRENCY: "ريال",

  // اسم المزرعة (يظهر في الأعلى)
  FARM_NAME: "قطم لإنتاج الزيتون والفستق",

  // الشريكان
  PARTNERS: [
    { id: "abo_abdulrahman", name: "أبو عبدالرحمن" },
    { id: "abo_abdullah", name: "أبو عبدالله" },
  ],

  // فئات المصاريف
  CATEGORIES: [
    // مرحلة التأسيس والأرض
    { id: "official_fees", name: "رسوم رسمية" },
    { id: "registration", name: "تسجيل الشركة" },
    { id: "legal", name: "قانوني ومحاماة" },
    { id: "survey", name: "مساحة ومسح" },
    { id: "roadworks", name: "أعمال طرق ومقاولات" },
    { id: "development", name: "تطوير واشتراكات" },
    // مرحلة التشغيل
    { id: "feed", name: "علف" },
    { id: "seeds", name: "بذور وشتلات" },
    { id: "fuel", name: "وقود" },
    { id: "labor", name: "عمالة" },
    { id: "water", name: "مياه وري" },
    { id: "equipment", name: "معدات" },
    { id: "maintenance", name: "صيانة" },
    { id: "other", name: "أخرى" },
  ],
};
