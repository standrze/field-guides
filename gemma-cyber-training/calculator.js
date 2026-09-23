(() => {
  'use strict';
  const currency = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 2});
  const number = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});

  function updateBudgetCalculator(root = document) {
    const form = root.querySelector('#budget-calculator');
    if (!form) return;
    const outputs = form.querySelectorAll('[data-cost-output]');
    const fields = ['tokens', 'throughput', 'hourly', 'overhead', 'runs'];
    const values = Object.fromEntries(fields.map(name => {
      const input = form.elements.namedItem(name);
      return [name, input && input.value.trim() !== '' ? Number(input.value) : NaN];
    }));
    const valid = fields.every(name => Number.isFinite(values[name]) && (name === 'overhead' ? values[name] >= 0 : values[name] > 0)) && Number.isInteger(values.runs);
    const hours = values.tokens * 1e6 / values.throughput / 3600 * (1 + values.overhead / 100);
    const perRun = hours * values.hourly;
    const total = perRun * values.runs;
    if (!valid || ![hours, perRun, total].every(Number.isFinite)) {
      outputs.forEach(output => { output.textContent = '—'; });
      const status = form.querySelector('[data-cost-status]');
      if (status) status.textContent = 'Enter positive numbers, a nonnegative overhead, and a whole number of runs.';
      form.dataset.valid = 'false';
      return;
    }
    const formatted = {hours: `${number.format(hours)} hours`, 'per-run': currency.format(perRun), total: currency.format(total)};
    outputs.forEach(output => {
      output.textContent = formatted[output.dataset.costOutput] ?? `${formatted.hours} per run · ${formatted['per-run']} per run · ${formatted.total} for ${number.format(values.runs)} runs`;
    });
    const status = form.querySelector('[data-cost-status]');
    if (status) status.textContent = 'Illustrative compute cost. Storage, tax, and other fees are additional.';
    form.dataset.valid = 'true';
  }

  document.addEventListener('input', event => {
    if (event.target.closest('#budget-calculator')) updateBudgetCalculator();
  });
  document.addEventListener('change', event => {
    if (event.target.closest('#budget-calculator')) updateBudgetCalculator();
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'budget-calculator') {
      event.preventDefault();
      updateBudgetCalculator();
    }
  });
  window.updateBudgetCalculator = updateBudgetCalculator;
  updateBudgetCalculator();
})();
