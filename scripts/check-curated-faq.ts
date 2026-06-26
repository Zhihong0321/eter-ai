import { findCuratedFaq, loadCuratedFaqEntries } from '../server/knowledge/curated-faq.js';

const expectedMatches = [
  ['why eternalgy?', 'why-choose-eternalgy'],
  ['Can I trust your company?', 'trust-and-credentials'],
  ['Is the cheapest solar quote the best choice?', 'proposal-value'],
  ['Will solar cause my roof to leak?', 'roof-protection'],
  ['Are solar rebates still available?', 'install-solar-now'],
  ['Why did you choose Jinko panels?', 'product-selection-panel'],
  ['Is SAJ a good inverter?', 'product-selection-inverter'],
  ['Is Huawei inverter better than SAJ?', 'saj-competitor-comparison'],
  ['How does SAJ compare with other inverter brands?', 'saj-competitor-comparison'],
  ['Was this proposal designed for my property?', 'system-suitability'],
  ['Will solar eliminate my TNB bill?', 'solar-savings-mechanism'],
  ['I want to proceed. What happens next?', 'next-steps'],
] as const;

const entries = await loadCuratedFaqEntries();
const expectedThemes: Record<string, string> = {
  'why-choose-eternalgy': 'company',
  'trust-and-credentials': 'trust',
  'proposal-value': 'value',
  'installation-and-support': 'journey',
  'protection-and-warranty': 'protection',
  'roof-protection': 'roof',
  'install-solar-now': 'timing',
  'product-selection-panel': 'panel',
  'product-selection-inverter': 'inverter',
  'saj-competitor-comparison': 'comparison',
  'system-suitability': 'suitability',
  'solar-savings-mechanism': 'savings',
  'next-steps': 'next',
};

if (entries.length !== 13) {
  throw new Error(`Expected 13 curated FAQs, found ${entries.length}.`);
}

for (const entry of entries) {
  if (!entry.html.includes('class="ans-premium"')) {
    if (!entry.html.includes('class="ans-premium ')) {
      throw new Error(`Premium HTML missing for ${entry.id}.`);
    }
  }
  const expectedTheme = expectedThemes[entry.id];
  if (!expectedTheme || !entry.html.includes(`ans-premium--${expectedTheme}`)) {
    throw new Error(`Bespoke presentation theme missing for ${entry.id}.`);
  }
  if (entry.html.includes('Supporting Facts') || entry.html.includes('intent:')) {
    throw new Error(`Internal metadata leaked into HTML for ${entry.id}.`);
  }
  if (entry.html.length < 900) {
    throw new Error(`Presentation for ${entry.id} is unexpectedly sparse.`);
  }
}

for (const [question, expectedId] of expectedMatches) {
  const match = await findCuratedFaq(question);
  if (match?.id !== expectedId) {
    throw new Error(
      `Expected "${question}" to match ${expectedId}; received ${match?.id ?? 'null'}.`,
    );
  }
}

const unrelated = await findCuratedFaq('What colour is the moon tonight?');
if (unrelated !== null) {
  throw new Error(`Unrelated question incorrectly matched ${unrelated.id}.`);
}

console.log(`Curated FAQ checks passed (${entries.length} entries).`);
