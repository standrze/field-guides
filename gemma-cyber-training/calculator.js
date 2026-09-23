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

  function updateBatchCalculator(root = document) {
    const form = root.querySelector('#batch-calculator');
    if (!form) return;
    const fields = ['examples', 'epochs', 'micro', 'accum', 'replicas', 'length', 'targets'];
    const values = Object.fromEntries(fields.map(name => [name, Number(form.elements.namedItem(name).value)]));
    const valid = fields.every(name => Number.isFinite(values[name]) && values[name] > 0)
      && ['examples', 'micro', 'accum', 'replicas'].every(name => Number.isInteger(values[name]))
      && values.targets <= values.length;
    const effective = values.micro * values.accum * values.replicas;
    const results = {effective, updates: values.examples * values.epochs / effective,
      inputs: effective * values.length, supervised: effective * values.targets,
      total: values.examples * values.epochs * values.length};
    const okay = valid && Object.values(results).every(Number.isFinite);
    form.querySelectorAll('[data-batch-output]').forEach(output => {
      output.textContent = okay ? number.format(results[output.dataset.batchOutput]) : '—';
    });
    form.dataset.valid = String(okay);
    form.querySelector('[data-batch-status]').textContent = okay
      ? 'Arithmetic estimate; assumes constant average lengths and full batches. It does not predict quality or GPU memory.'
      : 'Enter positive values; dataset size, microbatch, accumulation and replicas must be integers. Targets cannot exceed input tokens.';
  }
  document.addEventListener('input', event => {
    if (event.target.closest('#batch-calculator')) updateBatchCalculator();
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'batch-calculator') { event.preventDefault(); updateBatchCalculator(); }
  });
  window.updateBatchCalculator = updateBatchCalculator;
  updateBatchCalculator();

  window.updateBudgetCalculator = updateBudgetCalculator;
  updateBudgetCalculator();
})();
