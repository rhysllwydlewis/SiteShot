import { makeIssue } from '../core/issues.mjs';

export async function runAuthModule(page, url) {
  const data = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const forms = [...document.querySelectorAll('form')].map(form => {
      const fields = [...form.querySelectorAll('input, select, textarea')].map(input => ({
        tag: input.tagName.toLowerCase(),
        type: (input.getAttribute('type') || '').toLowerCase(),
        name: input.getAttribute('name') || '',
        id: input.id || '',
        placeholder: input.getAttribute('placeholder') || '',
        autocomplete: input.getAttribute('autocomplete') || '',
        required: input.required
      }));
      return {
        action: form.action || '',
        method: (form.method || 'get').toLowerCase(),
        fields,
        submitText: [...form.querySelectorAll('button, input[type="submit"]')].map(b => b.innerText || b.value || '').join(' ').trim()
      };
    });

    const passwordFields = [...document.querySelectorAll('input[type="password"]')].map(i => ({
      name: i.name || '',
      autocomplete: i.getAttribute('autocomplete') || '',
      formAction: i.closest('form')?.action || ''
    })).slice(0, 30);

    const loginLinks = [...document.querySelectorAll('a[href], button')].filter(el => /log\s*in|login|sign\s*in|signin|account|dashboard|portal|my account/i.test(`${el.innerText || ''} ${el.getAttribute('href') || ''} ${el.getAttribute('aria-label') || ''}`)).map(el => ({
      text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 80),
      href: el.href || ''
    })).slice(0, 60);

    const authWallText = /log in to continue|sign in to continue|please log in|please sign in|access denied|unauthori[sz]ed|you do not have permission|session expired|create an account/i.test(text);
    const hasLoginForm = passwordFields.length > 0 || forms.some(f => f.fields.some(field => field.type === 'password'));
    const csrfInputs = [...document.querySelectorAll('input[type="hidden"]')].filter(i => /csrf|token|authenticity|nonce/i.test(`${i.name || ''} ${i.id || ''}`)).map(i => i.name || i.id).slice(0, 30);
    const insecurePasswordForms = passwordFields.filter(p => p.formAction && /^http:\/\//i.test(p.formAction));
    const missingAutocomplete = passwordFields.filter(p => !/current-password|new-password|one-time-code/i.test(p.autocomplete || ''));
    const accountLikePaths = loginLinks.filter(l => /dashboard|account|portal|admin|login|signin|sign-in/i.test(l.href || l.text));

    return { hasLoginForm, authWallText, passwordFields, loginLinks, csrfInputs, insecurePasswordForms, missingAutocomplete, accountLikePaths };
  });

  const issues = [];
  const add = obj => issues.push(makeIssue({ module: 'auth', category: 'Auth / Session Readiness', url, ...obj }));

  if (data.authWallText) add({ severity: 'Info', title: 'Authentication wall detected', description: 'The page appears to contain text suggesting login or restricted access.', evidence: 'Auth-wall wording detected in visible page text.', recommendation: 'For now, this tool reports auth-gated areas but does not log in. Audit those areas later with a safe manual-session mode.' });
  if (data.hasLoginForm) add({ severity: 'Info', title: 'Login form detected', description: 'The page contains password/login form signals.', evidence: `${data.passwordFields.length} password field(s) found.`, recommendation: 'No login attempt was made. Review login UX, password manager support and security headers manually.' });
  if (data.insecurePasswordForms.length) add({ severity: 'High', title: 'Password form may submit over HTTP', description: 'A password field is inside a form with an HTTP action.', evidence: data.insecurePasswordForms.map(p => p.formAction).join('\n'), recommendation: 'Ensure all login/password forms submit over HTTPS only.' });
  if (data.missingAutocomplete.length) add({ severity: 'Low', title: 'Password fields missing autocomplete hints', description: 'Password fields may not support password manager/autofill best practice.', evidence: `${data.missingAutocomplete.length} password field(s) missing recognised autocomplete values.`, recommendation: 'Use autocomplete="current-password", "new-password" or "one-time-code" where appropriate.' });
  if (data.hasLoginForm && !data.csrfInputs.length) add({ severity: 'Medium', title: 'No obvious CSRF token on login/auth form', description: 'No hidden CSRF/authenticity token was detected near the form. This is a heuristic only.', recommendation: 'Confirm server-side CSRF protection is implemented for state-changing forms.' });
  if (data.accountLikePaths.length) add({ severity: 'Info', title: 'Account/dashboard paths discovered', description: 'The public page contains links to account, dashboard, login or portal areas.', evidence: data.accountLikePaths.slice(0, 12).map(l => `${l.text} ${l.href}`).join('\n'), recommendation: 'These routes can be included in a later authenticated/manual-session audit mode.' });

  return { data, issues };
}
