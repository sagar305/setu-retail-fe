/**
 * All user-facing copy lives here in Hinglish (Roman script).
 * Keeping it in one module means the app can be re-worded — or a second
 * language added — without touching any screen.
 */
export const strings = {
  tabs: {
    today: 'Aaj',
    chores: 'Kaam',
    household: 'Ghar',
    history: 'Hisaab',
  },

  history: {
    title: 'Purana hisaab',
    subtitle: (days: number) => `Pichhle ${days} din`,
    done: 'Ho gaya',
    skipped: 'Chhoda',
    missed: 'Reh gaya',
    summary: (done: number, total: number) => `${total} me se ${done} poore hue`,
    dayCount: (done: number, total: number) => `${done}/${total}`,
    emptyTitle: 'Abhi koi hisaab nahi',
    emptyMessage: 'Jaise jaise kaam poore honge, har din ka hisaab yahan dikhega.',
    byMember: 'Kisne kitne kiye',
    allMembers: 'Sabhi',
    perfectDay: 'Poora din saaf!',
  },

  today: {
    title: 'Aaj ke kaam',
    overdue: 'Reh gaye kaam',
    dueToday: 'Aaj karne hain',
    progress: (done: number, total: number) => `${total} me se ${done} ho gaye`,
    nothingTitle: 'Aaj kuch nahi hai',
    nothingFirstChore: 'Pehla kaam jodein — jis din wo aayega, yahin dikhega.',
    nothingElse: 'Aaram karein — agla kaam apne time par yahan aa jayega.',
    snoozedUntil: (time: string) => `${time} tak taala gaya`,
  },

  chores: {
    title: 'Saare kaam',
    filterAll: 'Sabhi',
    filterArchived: 'Archive',
    emptyTitle: 'Abhi koi kaam nahi',
    emptyMessage: '+ dabakar pehla kaam jodein — kitni baar karna hai aur kaun karega, dono chun sakte hain.',
    emptyFiltered: 'Is filter me kuch nahi',
    next: (when: string) => `Agla: ${when}`,
    archived: 'Archive kiya hua',
    noUpcoming: 'Aage koi date nahi',
  },

  household: {
    title: 'Ghar ke log',
    addPlaceholder: 'Kisi ko jodein…',
    add: 'Jodein',
    statsHeading: 'Pichhle 30 din',
    stats: (done: number, points: number, assigned: number) =>
      `${done} poore · ${points} points · ${assigned} zimme`,
    emptyTitle: 'Abhi koi nahi juda',
    emptyMessage: 'Ghar ke logon ko jodein. Phir har kaam kisi ek ke naam kar sakte hain.',
    removeTitle: (name: string) => `${name} ko hatayein?`,
    removeMessage: 'Unka naam ghar se hata diya jayega.',
    removeBlocked: (name: string, count: number) =>
      `${name} ke naam abhi ${count} kaam hain. Pehle wo kisi aur ke naam karein ya hata dein.`,
    inviteHeading: 'Ghar ka code',
    inviteHelp: 'Ye code ghar walon ko dein. App me sign up karke ye code daalenge, to unhe bhi wahi kaam dikhenge.',
    copy: 'Copy karein',
    copied: 'Copy ho gaya',
    rotate: 'Naya code banayein',
    rotateTitle: 'Naya code banayein?',
    rotateMessage: 'Purana code kaam karna band kar dega.',
    owner: 'Owner',
    you: 'Aap',
    dataHeading: 'Account',
    pendingWrites: (n: number) => `${n} badlav abhi bheje nahi gaye`,
    syncPending: 'Badlav abhi save nahi hue — net aate hi bhej denge',
    syncDropped: (n: number) =>
      `${n} badlav save nahi ho paye. Kaam dobara jodna pad sakta hai.`,
    offline: 'Offline — badlav phone me safe hain, net aate hi bhej denge',
    setupTitle: 'Ghar banayein ya judein',
    setupSubtitle: 'Naya ghar banayein, ya kisi ke diye code se judein.',
    createTab: 'Naya ghar',
    joinTab: 'Code se judein',
    householdName: 'Ghar ka naam',
    householdNamePlaceholder: 'Bansal Niwas',
    create: 'Ghar banayein',
    codeLabel: 'Ghar ka code',
    codePlaceholder: 'ABCD2345',
    join: 'Ghar se judein',
    joinFailed: 'Is code ka koi ghar nahi mila',
  },

  form: {
    newTitle: 'Naya kaam',
    editTitle: 'Kaam badlein',
    name: 'Kya karna hai?',
    namePlaceholder: 'Kachra bahar rakhna',
    room: 'Kamra ya jagah',
    roomPlaceholder: 'Rasoi',
    frequency: 'Kitni baar',
    frequencyPick: 'Kitni baar karna hai?',
    weekday: 'Kis din',
    customUnit: 'Har kitne din/hafte/mahine',
    customDays: 'In dino',
    customDates: 'Mahine ki in tareekhon ko',
    customDatesHint: 'Tareekh chunne ke liye number dabayein',
    reminderTime: 'Yaad kab dilayein',
    snooze: 'Na ho paye to kab yaad dilayein',
    snoozeCustomAmount: 'Kitna',
    snoozeCustomUnit: 'Ghante ya din',
    assignee: 'Kaun karega',
    assigneeRequired: 'Kisi ek ko chunna zaroori hai',
    noMembers: '"Ghar" tab me diya code apne ghar walon ko dein. Jab wo sign up karke judenge, tab kaam unke naam kar payenge.',
    points: 'Points',
    notes: 'Notes',
    notesPlaceholder: 'Koi khaas baat',
    save: 'Save karein',
    create: 'Kaam jodein',
    archive: 'Archive karein',
    unarchive: 'Wapas laayein',
    delete: 'Kaam hatayein',
    deleteTitle: (name: string) => `"${name}" hata dein?`,
    deleteMessage: 'Iska poora record bhi mit jayega.',
    cancel: 'Rehne dein',
    confirmDelete: 'Hatayein',
    confirmRemove: 'Hatayein',
    confirmClear: 'Hata dein',
  },

  auth: {
    signInTitle: 'Wapas aayein',
    signInSubtitle: 'Apne ghar ke kaam dekhne ke liye sign in karein.',
    signUpTitle: 'Naya account',
    signUpSubtitle: 'Ghar ke kaam sab ke saath baantne ke liye account banayein.',
    name: 'Aapka naam',
    namePlaceholder: 'Sagar',
    email: 'Email',
    emailPlaceholder: 'aap@example.com',
    password: 'Password',
    passwordHint: 'Kam se kam 6 characters',
    signIn: 'Sign in karein',
    signUp: 'Account banayein',
    toSignUp: 'Naya account banayein',
    toSignIn: 'Pehle se account hai? Sign in karein',
    forgot: 'Password bhool gaye?',
    forgotTitle: 'Password reset karein',
    forgotSubtitle: 'Apna email daalein, hum reset link bhej denge.',
    sendReset: 'Reset link bhejein',
    resetSent: 'Reset link bhej diya. Apna email dekhein.',
    confirmTitle: 'Email confirm karein',
    confirmMessage: (email: string) =>
      `Humne ${email} par ek link bheja hai. Us par click karke wapas aayein aur sign in karein.`,
    signOut: 'Sign out karein',
    signOutTitle: 'Sign out karein?',
    signOutMessage: 'Aapka data cloud me safe rahega.',
    back: 'Wapas',
  },

  common: {
    points: (n: number) => (n === 1 ? '1 point' : `${n} points`),
  },

  actions: {
    done: 'Ho gaya',
    undo: 'Wapas',
    snooze: 'Baad mein',
    skip: 'Chhod dein',
    skipped: 'Chhoda gaya',
    close: 'Band karein',
    snoozeTitle: 'Kab yaad dilayein?',
  },

  notification: {
    title: (chore: string) => `${chore} ka time ho gaya`,
    body: (room?: string) => (room ? `${room} me karna hai` : 'Aaj karna hai'),
    categoryDone: 'Ho gaya',
    categorySnooze: 'Baad mein',
    permissionTitle: 'Notification band hai',
    permissionMessage:
      'Yaad dilane ke liye notification ki permission chahiye. Phone ki settings me jaakar on karein.',
  },

  frequency: {
    once: 'Ek baar',
    daily: 'Roz',
    alternate: 'Ek din chhod kar',
    weekday: 'Somvar se Shanivar',
    sunday: 'Sirf Ravivar',
    monthly: 'Har 4 hafte',
    twiceMonthly: 'Har 2 hafte',
    alternateSunday: 'Ek Ravivar chhod kar',
    custom: 'Apni marzi se',
  },

  snooze: {
    '6h': '6 ghante baad',
    '12h': '12 ghante baad',
    '1d': '1 din baad',
    '1w': '1 hafte baad',
    custom: 'Apna time',
  },

  units: {
    hour: 'Ghante',
    day: 'Din',
    week: 'Hafte',
    month: 'Mahine',
  },

  days: {
    today: 'Aaj',
    tomorrow: 'Kal',
    yesterday: 'Beeta kal',
  },
} as const;

/** Sun–Sat, short form. */
export const WEEKDAY_LABELS = ['Ravi', 'Som', 'Mangal', 'Budh', 'Guru', 'Shukra', 'Shani'];

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
