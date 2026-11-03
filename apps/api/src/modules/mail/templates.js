/**
 * Transactional email templates in French and Arabic.
 * Everything user-controlled (names) is HTML-escaped. Subjects are fixed strings, except the
 * invitation subject, whose variables are stripped of control characters (no header injection;
 * names are also validated without control characters). Arabic emails are rendered right-to-left.
 * Any copy field may be a function of the template variables.
 */

const COPY = {
  fr: {
    dir: 'ltr',
    greeting: (name) => (name ? `Bonjour ${name},` : 'Bonjour,'),
    footer: 'Tigmi — Votre maison, intelligemment organisée.',
    linkHint: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
    verifyEmail: {
      subject: 'Confirmez votre adresse e-mail — Tigmi',
      body: 'Bienvenue sur Tigmi ! Confirmez votre adresse e-mail pour activer votre compte. Ce lien expire dans 24 heures.',
      action: 'Confirmer mon adresse',
      note: 'Si vous n’avez pas créé de compte Tigmi, ignorez cet e-mail.',
    },
    accountExists: {
      subject: 'Vous avez déjà un compte Tigmi',
      body: 'Quelqu’un (peut-être vous) a essayé de créer un compte Tigmi avec cette adresse. Vous avez déjà un compte : connectez-vous, ou réinitialisez votre mot de passe si vous l’avez oublié.',
      action: 'Réinitialiser mon mot de passe',
      note: 'Si ce n’était pas vous, vous pouvez ignorer cet e-mail : rien n’a changé.',
    },
    passwordReset: {
      subject: 'Réinitialisation de votre mot de passe — Tigmi',
      body: 'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte. Ce lien expire dans 1 heure et ne peut être utilisé qu’une fois.',
      action: 'Choisir un nouveau mot de passe',
      note: 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe ne changera pas.',
    },
    passwordChanged: {
      subject: 'Votre mot de passe a été modifié — Tigmi',
      body: 'Le mot de passe de votre compte Tigmi vient d’être modifié et tous vos appareils ont été déconnectés.',
      action: 'Ce n’était pas moi : réinitialiser',
      note: 'Si vous êtes à l’origine de ce changement, aucune action n’est nécessaire.',
    },
    invitation: {
      subject: (v) => `${v.inviterName} vous invite à rejoindre « ${v.householdName} » sur Tigmi`,
      body: (v) =>
        `${v.inviterName} vous invite à rejoindre le foyer « ${v.householdName} » sur Tigmi en tant que ${v.role === 'ADMIN' ? 'administrateur' : 'membre'}. Tigmi vous aide à organiser ensemble budget, factures, courses et tâches. Cette invitation expire dans 7 jours.`,
      action: 'Rejoindre le foyer',
      note: 'Si vous ne connaissez pas cette personne, ignorez simplement cet e-mail.',
    },
  },
  ar: {
    dir: 'rtl',
    greeting: (name) => (name ? `مرحبًا ${name}،` : 'مرحبًا،'),
    footer: 'Tigmi — منزلك، منظَّم بذكاء.',
    linkHint: 'إذا لم يعمل الزر، انسخ هذا الرابط في متصفحك:',
    verifyEmail: {
      subject: 'تأكيد بريدك الإلكتروني — Tigmi',
      body: 'أهلًا بك في Tigmi! يُرجى تأكيد بريدك الإلكتروني لتفعيل حسابك. تنتهي صلاحية هذا الرابط خلال 24 ساعة.',
      action: 'تأكيد بريدي الإلكتروني',
      note: 'إذا لم تقم بإنشاء حساب في Tigmi، يُرجى تجاهل هذه الرسالة.',
    },
    accountExists: {
      subject: 'لديك حساب في Tigmi بالفعل',
      body: 'حاول شخص ما (ربما أنت) إنشاء حساب في Tigmi بهذا البريد الإلكتروني. لديك حساب بالفعل: سجّل الدخول، أو أعد تعيين كلمة المرور إذا نسيتها.',
      action: 'إعادة تعيين كلمة المرور',
      note: 'إذا لم تكن أنت، يمكنك تجاهل هذه الرسالة: لم يتغير شيء.',
    },
    passwordReset: {
      subject: 'إعادة تعيين كلمة المرور — Tigmi',
      body: 'تلقّينا طلبًا لإعادة تعيين كلمة مرور حسابك. تنتهي صلاحية هذا الرابط خلال ساعة واحدة ولا يمكن استخدامه إلا مرة واحدة.',
      action: 'اختيار كلمة مرور جديدة',
      note: 'إذا لم تطلب ذلك، تجاهل هذه الرسالة؛ لن تتغير كلمة المرور.',
    },
    passwordChanged: {
      subject: 'تم تغيير كلمة المرور — Tigmi',
      body: 'تم تغيير كلمة مرور حسابك في Tigmi للتو، وتم تسجيل خروجك من جميع الأجهزة.',
      action: 'لم أكن أنا: إعادة التعيين',
      note: 'إذا قمت بهذا التغيير بنفسك، فلا حاجة لأي إجراء.',
    },
    invitation: {
      subject: (v) => `${v.inviterName} يدعوك للانضمام إلى «${v.householdName}» على Tigmi`,
      body: (v) =>
        `يدعوك ${v.inviterName} للانضمام إلى منزل «${v.householdName}» على Tigmi بصفة ${v.role === 'ADMIN' ? 'مسؤول' : 'عضو'}. يساعدكم Tigmi على تنظيم الميزانية والفواتير والمشتريات والمهام معًا. تنتهي صلاحية هذه الدعوة خلال 7 أيام.`,
      action: 'الانضمام إلى المنزل',
      note: 'إذا كنت لا تعرف هذا الشخص، فتجاهل هذه الرسالة ببساطة.',
    },
  },
};

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

// Control characters (CR, LF, NUL…) must never reach an email header.
const stripControlChars = (value) => String(value).replace(/\p{Cc}+/gu, ' ');

/** Builds { subject, text, html } for a template in the user's language (fallback: fr). */
export function renderEmail(template, { language, name, actionUrl, vars = {} }) {
  const copy = COPY[language] ?? COPY.fr;
  const raw = copy[template];
  if (!raw) throw new Error(`Unknown email template: ${template}`);
  const safeVars = Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [key, stripControlChars(value)]),
  );
  const resolve = (field) => (typeof field === 'function' ? field(safeVars) : field);
  const t = {
    subject: stripControlChars(resolve(raw.subject)),
    body: resolve(raw.body),
    action: resolve(raw.action),
    note: resolve(raw.note),
  };

  const text = [
    copy.greeting(name),
    '',
    t.body,
    '',
    `${t.action}: ${actionUrl}`,
    '',
    t.note,
    '',
    '—',
    copy.footer,
  ].join('\n');

  const align = copy.dir === 'rtl' ? 'right' : 'left';
  const html = `<!doctype html>
<html lang="${language === 'ar' ? 'ar' : 'fr'}" dir="${copy.dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#080d18;font-family:system-ui,'Segoe UI',Tahoma,sans-serif;color:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#111827;border-radius:16px;">
    <tr><td style="padding:32px;text-align:${align};" dir="${copy.dir}">
      <p style="margin:0 0 24px;font-size:24px;font-weight:700;"><span dir="ltr">Tigmi<span style="color:#22d3ee;">.</span></span></p>
      <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(copy.greeting(name))}</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#cbd5e1;">${escapeHtml(t.body)}</p>
      <p style="margin:0 0 24px;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">${escapeHtml(t.action)}</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">${escapeHtml(copy.linkHint)}</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all;" dir="ltr"><a href="${escapeHtml(actionUrl)}" style="color:#22d3ee;">${escapeHtml(actionUrl)}</a></p>
      <p style="margin:0 0 24px;font-size:13px;color:#94a3b8;">${escapeHtml(t.note)}</p>
      <p style="margin:0;font-size:12px;color:#94a3b8;">${escapeHtml(copy.footer)}</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: t.subject, text, html };
}
