import { makeIssue } from '../core/issues.mjs';

function fieldType(field) {
  if (field.tag === 'textarea') return 'textarea';
  if (field.tag === 'select') return 'select';
  return field.type || 'text';
}

export async function runFormsModule(page, url) {
  const data = await page.evaluate(() => {
    const forms = [...document.querySelectorAll('form')].map((form, index) => {
      const rect = form.getBoundingClientRect();
      const fields = [...form.querySelectorAll('input, select, textarea')].map((input, fieldIndex) => {
        const type = (input.getAttribute('type') || '').toLowerCase();
        const tag = input.tagName.toLowerCase();
        const id = input.id || '';
        const name = input.getAttribute('name') || '';
        const placeholder = input.getAttribute('placeholder') || '';
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.innerText?.trim() || '' : input.closest('label')?.innerText?.trim() || '';
        return {
          fieldIndex,
          tag,
          type,
          id,
          name,
          placeholder,
          label,
          required: input.required,
          disabled: input.disabled,
          readOnly: input.readOnly,
          visible: rect.width > 0 && rect.height > 0,
          autocomplete: input.getAttribute('autocomplete') || '',
          ariaInvalid: input.getAttribute('aria-invalid') || '',
          pattern: input.getAttribute('pattern') || '',
          minLength: input.getAttribute('minlength') || '',
          maxLength: input.getAttribute('maxlength') || ''
        };
      });

      const buttons = [...form.querySelectorAll('button, input[type="submit"], input[type="button"]')].map((button, buttonIndex) => ({
        buttonIndex,
        text: (button.innerText || button.value || button.getAttribute('aria-label') || '').trim(),
        type: (button.getAttribute('type') || button.tagName === 'BUTTON' ? 'submit' : '').toLowerCase(),
        disabled: button.disabled
      }));

      return {
        index,
        action: form.getAttribute('action') || '',
        resolvedAction: form.action || '',
        method: (form.getAttribute('method') || 'get').toLowerCase(),
        noValidate: form.noValidate,
        fields,
        buttons,
        requiredCount: fields.filter(f => f.required).length,
        hasSubmit: buttons.some(b => /submit|send|enquire|contact|continue|next|save|register|sign/i.test(`${b.type} ${b.text}`))
      };
    });
    return { forms };
  });

  const issues = [];
  const add = obj => issues.push(makeIssue({ module: 'forms', category: 'Forms / Flow Dry Run', url, ...obj }));

  if (!data.forms.length) return { data, issues };

  for (const form of data.forms) {
    const label = `Form ${form.index + 1}`;
    if (!form.hasSubmit) add({ severity: 'Medium', title: `${label}: no clear submit/next action found`, description: 'The form does not have an obvious submit, continue or send button.', evidence: JSON.stringify(form.buttons), recommendation: 'Ensure forms have a clear action button with accessible text.' });
    if (!form.action && form.method === 'get') add({ severity: 'Info', title: `${label}: form uses default GET/current-page action`, description: 'The form has no explicit action or method.', recommendation: 'Confirm this is intentional and the frontend handles the submission correctly.' });
    if (/^http:\/\//i.test(form.resolvedAction)) add({ severity: 'High', title: `${label}: insecure form action`, description: 'The form appears to submit to an HTTP URL.', evidence: form.resolvedAction, recommendation: 'Use HTTPS for all form submissions.' });
    if (form.noValidate) add({ severity: 'Low', title: `${label}: browser validation disabled`, description: 'The form uses novalidate, so native validation will not run.', recommendation: 'Make sure equivalent custom validation and accessible error messages are provided.' });

    const fields = form.fields.filter(f => !['hidden', 'submit', 'button', 'reset'].includes(fieldType(f)));
    const missingNames = fields.filter(f => !f.name && !f.id).slice(0, 20);
    if (missingNames.length) add({ severity: 'Medium', title: `${label}: fields missing name/id`, description: 'Some fields have neither a name nor an id, making submission and labelling harder.', evidence: `${missingNames.length} field(s).`, recommendation: 'Give fields stable names/ids and pair them with labels.' });

    const missingLabels = fields.filter(f => !f.label && !f.placeholder && !f.name).slice(0, 20);
    if (missingLabels.length) add({ severity: 'High', title: `${label}: fields lack clear label/placeholder/name`, description: 'Some form controls do not appear to have clear visible or programmatic naming.', evidence: `${missingLabels.length} field(s).`, recommendation: 'Provide visible labels and accessible names for all fields.' });

    const requiredWithoutNames = fields.filter(f => f.required && !f.label && !f.placeholder).slice(0, 20);
    if (requiredWithoutNames.length) add({ severity: 'Medium', title: `${label}: required fields may be unclear`, description: 'Required fields may not be clearly labelled.', evidence: `${requiredWithoutNames.length} required field(s).`, recommendation: 'Clearly mark required fields and provide accessible validation messages.' });

    const disabledSubmit = form.buttons.filter(b => /submit|send|continue|next|save|register|sign/i.test(`${b.type} ${b.text}`) && b.disabled);
    if (disabledSubmit.length) add({ severity: 'Info', title: `${label}: submit/next button starts disabled`, description: 'The form action button is disabled by default.', evidence: disabledSubmit.map(b => b.text || b.type).join(', '), recommendation: 'Confirm users receive clear guidance on how to enable the action.' });

    const emailFields = fields.filter(f => /email/i.test(`${f.type} ${f.name} ${f.id} ${f.placeholder} ${f.label}`));
    for (const field of emailFields) {
      if (field.type !== 'email') add({ severity: 'Low', title: `${label}: email field may not use type=email`, description: 'A field appears to collect email but is not type=email.', evidence: JSON.stringify(field), recommendation: 'Use type="email" to improve mobile keyboard and native validation.' });
      if (!field.autocomplete) add({ severity: 'Low', title: `${label}: email field missing autocomplete`, description: 'An email field does not include autocomplete.', recommendation: 'Use autocomplete="email" where appropriate.' });
    }

    const telFields = fields.filter(f => /phone|tel|mobile/i.test(`${f.type} ${f.name} ${f.id} ${f.placeholder} ${f.label}`));
    for (const field of telFields) {
      if (field.type !== 'tel') add({ severity: 'Low', title: `${label}: phone field may not use type=tel`, description: 'A field appears to collect a phone number but is not type=tel.', evidence: JSON.stringify(field), recommendation: 'Use type="tel" to improve mobile keyboard behaviour.' });
    }
  }

  // Safe dry-run: click submit on cloned form logic is risky, so this is intentionally static/non-submitting.
  if (data.forms.some(f => f.requiredCount > 0)) {
    add({ severity: 'Info', title: 'Safe form dry-run completed without submission', description: 'Forms were inspected for required fields, labels, actions, button state and mobile-friendly input types. No data was submitted.', recommendation: 'For future end-to-end flow testing, add a safe staging-only test data mode.' });
  }

  return { data, issues };
}
