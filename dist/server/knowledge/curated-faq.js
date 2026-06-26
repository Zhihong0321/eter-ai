import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const FAQ_DIR = resolve(process.cwd(), 'knowledge', 'faq');
const STOP_WORDS = new Set([
    'a',
    'an',
    'and',
    'are',
    'can',
    'do',
    'does',
    'for',
    'how',
    'i',
    'is',
    'it',
    'me',
    'my',
    'of',
    'should',
    'the',
    'this',
    'to',
    'was',
    'what',
    'when',
    'why',
    'will',
    'with',
    'you',
    'your',
]);
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function normalise(value) {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Light stemmer so singular/plural and common verb endings match.
 * Applied symmetrically to query and candidate, so over-stemming
 * (e.g. "process" -> "proces") is harmless as long as it is consistent.
 */
function stem(word) {
    if (word.length > 4 && word.endsWith('ies'))
        return `${word.slice(0, -3)}y`;
    if (word.length > 4 && word.endsWith('es'))
        return word.slice(0, -2);
    if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss'))
        return word.slice(0, -1);
    return word;
}
function contentTokens(value) {
    return normalise(value)
        .split(' ')
        .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
        .map(stem);
}
function parseFrontmatter(markdown) {
    const lines = markdown.split(/\r?\n/);
    if (lines[0]?.trim() !== '---') {
        throw new Error('Curated FAQ is missing opening frontmatter.');
    }
    const closingIndex = lines.slice(1).findIndex((line) => line.trim() === '---');
    if (closingIndex === -1) {
        throw new Error('Curated FAQ is missing closing frontmatter.');
    }
    const frontmatter = lines.slice(1, closingIndex + 1);
    let id = '';
    let intent = '';
    let readingQuestions = false;
    const questions = [];
    for (const line of frontmatter) {
        const trimmed = line.trim();
        if (trimmed.startsWith('id:')) {
            id = trimmed.slice(3).trim();
            readingQuestions = false;
            continue;
        }
        if (trimmed.startsWith('intent:')) {
            intent = trimmed.slice(7).trim();
            readingQuestions = false;
            continue;
        }
        if (trimmed === 'questions:') {
            readingQuestions = true;
            continue;
        }
        if (readingQuestions && trimmed.startsWith('- ')) {
            questions.push(trimmed.slice(2).trim());
        }
    }
    if (!id || !intent || questions.length === 0) {
        throw new Error('Curated FAQ requires id, intent, and at least one question.');
    }
    return { id, intent, questions };
}
export function extractCuratedFaqAnswer(markdown) {
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    if (!titleMatch) {
        throw new Error('Curated FAQ is missing an H1 title.');
    }
    const title = titleMatch[1].trim();
    const titleEnd = (titleMatch.index ?? 0) + titleMatch[0].length;
    const supportingFactsIndex = markdown.indexOf('\n## Supporting Facts', titleEnd);
    const answerBlock = markdown
        .slice(titleEnd, supportingFactsIndex === -1 ? undefined : supportingFactsIndex)
        .trim();
    const answer = answerBlock
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('#'))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!answer) {
        throw new Error('Curated FAQ is missing its approved answer.');
    }
    return { title, answer };
}
function splitSentences(answer) {
    return answer
        .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
}
const PRESENTATIONS = {
    'why-choose-eternalgy': {
        eyebrow: 'Why Eternalgy',
        theme: 'company',
        showcase: true,
        hero: 'Choose a solar partner built on real experience, uncompromising standards, roof expertise, and nationally recognised authority.',
        metrics: [
            { value: '1100+', title: 'installations', body: 'Across Peninsular Malaysia' },
            { value: '140', title: 'projects in one month', body: 'Proven delivery capacity' },
            { value: '20+', title: 'years system life', body: 'Built to last, not just installed' },
        ],
        cards: [
            { title: 'Experience', body: 'Battle-tested across terraced houses, villas, farms, and factories. What we deliver is system design and engineering refined through countless real-world projects — an invisible asset you cannot buy from a brochure.' },
            { title: 'No Compromise', body: 'True value is safety. True expense is risk. We use components with extra-long durability and additional safety redundancy. We do not sell the lowest price — we deliver absolute safety across the full 20+ year system life.' },
            { title: 'Roof Expertise', body: 'We understand not just solar, but roofs. Our dedicated in-house roof expert team minimises installation damage, handles professional roof repairs and reinforcement, and ensures your solar system coexists perfectly with your building.' },
            { title: 'Authority', body: 'SEDA registered provider, CIDB G3 contractor, Maybank Exclusive Solar PV Installer, SAJ Sole Distributor of Malaysia, SHRDC CoE Partner, and Malaysia Golden Bull Award — Outstanding Bull 2025.' },
        ],
        closing: 'A better solar decision is one you can still feel confident about years after installation.',
    },
    'trust-and-credentials': {
        eyebrow: 'Trust, made verifiable',
        theme: 'trust',
        showcase: true,
        hero: 'Do not rely on promises alone. Check the registrations, track record, and protection behind the proposal.',
        metrics: [
            { value: 'G3', title: 'CIDB registered', body: 'Category B / CE / ME' },
            { value: 'SEDA', title: 'registered provider', body: 'Solar PV Service Provider' },
            { value: '1100+', title: 'installations', body: 'Across Peninsular Malaysia' },
        ],
        cards: [
            { title: 'Documented registrations', body: 'Registration details are available for client verification.' },
            { title: 'Defined accountability', body: 'Workmanship, roof-leak, equipment, and insurance protection are stated clearly.' },
            { title: 'Recognised business', body: 'Malaysia Golden Bull Award recipient and Maybank financing partner.' },
        ],
        note: 'Always verify that the company name, equipment, and warranty terms match your final signed proposal.',
    },
    'proposal-value': {
        eyebrow: 'Compare lifetime value',
        theme: 'value',
        hero: 'The lowest upfront number is not automatically the lowest long-term cost.',
        compare: {
            leftTitle: 'Price-only comparison',
            leftItems: ['Equipment price', 'Installation total', 'Short-term discount'],
            rightTitle: 'Eternalgy value',
            rightItems: ['Engineering safety margins', 'In-house delivery and roof expertise', 'Defined warranty and insurance protection'],
        },
        cards: [
            { title: 'Lower execution risk', body: 'Clear responsibility reduces gaps between sales, installation, and support.' },
            { title: 'Designed for longevity', body: 'Durable equipment and disciplined engineering matter over 20+ years.' },
            { title: 'Transparent protection', body: 'You can compare exactly what is covered—not just what is installed.' },
        ],
        closing: 'Compare every quotation line by line. The value should remain visible after the discount disappears.',
    },
    'installation-and-support': {
        eyebrow: 'Your project journey',
        theme: 'journey',
        hero: 'One accountable team stays with your system from installation through after-sales support.',
        steps: [
            { value: '01', title: 'Prepare', body: 'The delivery and roof teams coordinate the site requirements.' },
            { value: '02', title: 'Install', body: 'A self-operated team manages workmanship, safety, and scheduling.' },
            { value: '03', title: 'Commission', body: 'The system is tested, connected, and handed over with monitoring access.' },
            { value: '04', title: 'Support', body: 'Technical support is available six days a week, with annual maintenance checkups.' },
        ],
        note: 'You keep a clear point of accountability instead of navigating an unmanaged chain of subcontractors.',
    },
    'protection-and-warranty': {
        eyebrow: 'Layered protection',
        theme: 'protection',
        hero: 'Your proposal protects the equipment, installation quality, roof interface, and insured system.',
        metrics: [
            { value: '30 yr', title: 'linear power warranty', body: 'JinkoSolar panels' },
            { value: '12 yr', title: 'product warranty', body: 'JinkoSolar panels' },
            { value: '10 yr', title: 'product warranty', body: 'Proposed SAJ string inverter' },
        ],
        cards: [
            { value: '3 yr', title: 'Workmanship', body: 'Eternalgy installation warranty' },
            { value: '1 yr', title: 'Roof leak', body: 'Eternalgy standard package' },
            { value: '3 yr', title: 'MSIG insurance', body: 'All-risk solar-system cover' },
        ],
        note: 'Final coverage follows the exact equipment, exclusions, registration requirements, and terms in your signed proposal.',
    },
    'roof-protection': {
        eyebrow: 'Roof-first installation',
        theme: 'roof',
        hero: 'The roof is treated as part of the solar system—not as an afterthought.',
        steps: [
            { value: '01', title: 'Assess', body: 'Review roof condition, structure, orientation, and installation access.' },
            { value: '02', title: 'Prepare', body: 'Address identified repair or reinforcement needs before mounting.' },
            { value: '03', title: 'Design', body: 'Plan mounting around the property’s actual roof condition.' },
            { value: '04', title: 'Protect', body: 'Include a 1-year roof-leak warranty under the standard package.' },
        ],
        closing: 'If the assessment finds a concern, the design should change before panels go onto the roof.',
    },
    'install-solar-now': {
        eyebrow: '2026 incentive window',
        theme: 'timing',
        hero: 'Act early enough to check eligibility and complete the required approval and commissioning steps.',
        metrics: [
            { value: 'RM600', title: 'per kWac', body: 'Eligible SuRIA Home rebate' },
            { value: 'RM3,000', title: 'maximum rebate', body: 'Subject to programme conditions' },
            { value: '31 Dec', title: '2026 deadline', body: 'Or earlier if allocation is exhausted' },
        ],
        cards: [
            { title: 'Residential', body: 'Eligible Solar ATAP systems may qualify for SuRIA Home on a first-come, first-served basis.' },
            { title: 'Business', body: 'Qualifying expenditure may be considered for GITA through 31 December 2026.' },
        ],
        note: 'Incentives are not guaranteed until eligibility, approval, allocation, and commissioning requirements are satisfied.',
    },
    'product-selection-panel': {
        eyebrow: 'Built for Malaysian rooftops',
        theme: 'panel',
        brandLogo: { src: '/logo/jinko-logo.svg', alt: 'JinkoSolar' },
        hero: 'Tiger Neo 3.0 is selected to handle heat, humidity, cloud cover, and limited roof space.',
        metrics: [
            { value: '-0.29%', title: 'per °C', body: 'Lower heat-related power loss' },
            { value: '30 yr', title: 'linear warranty', body: 'Long-term output confidence' },
            { value: '100%', title: 'bankability score', body: 'BloombergNEF 2024 survey' },
        ],
        cards: [
            { title: 'Heat', body: 'N-type TOPCon technology performs efficiently at elevated rooftop temperatures.' },
            { title: 'Humidity', body: 'Dual-glass construction improves resistance to moisture ingress.' },
            { title: 'Partial shade', body: 'Multi-segment design limits the impact of shaded areas.' },
        ],
        note: 'Actual energy production still depends on system design, roof conditions, weather, and operating environment.',
    },
    'product-selection-inverter': {
        eyebrow: 'The system control centre',
        theme: 'inverter',
        hero: 'The proposed SAJ inverter converts panel output, protects the system, and keeps performance always visible.',
        carousel: [
            {
                icon: '98.2%',
                title: 'Peak Conversion Efficiency',
                body: 'Converts your solar DC to grid-compatible AC with minimal energy loss — maximising every ringgit of generation.',
            },
            {
                icon: '29dB',
                title: 'Ultra-Quiet Operation',
                body: 'Fanless natural convection cooling on residential models runs below 29 dB — quieter than a library.',
            },
            {
                icon: 'SPD',
                title: 'Built-In Surge Protection',
                body: 'Integrated Type II DC surge protection guards the entire system against lightning strikes and voltage spikes.',
            },
            {
                icon: '10YR',
                title: '10-Year Product Warranty',
                body: 'Every proposed SAJ string inverter carries a full 10-year product warranty — backed by Eternalgy as distributor.',
            },
            {
                icon: 'APP',
                title: 'Live System Monitoring',
                body: 'The elekeeper app shows real-time solar generation, household consumption, and grid export in one view.',
            },
            {
                icon: '85+',
                title: 'Global Proven Track Record',
                body: 'SAJ established 2005, operating in 85+ countries with 9 GW annual inverter manufacturing capacity.',
            },
        ],
        note: 'The exact model, protection features, and warranty terms are confirmed in your signed proposal.',
    },
    'saj-competitor-comparison': {
        eyebrow: 'An honest recommendation',
        theme: 'comparison',
        hero: 'We will not invent a Huawei-versus-SAJ verdict without verified model-specific data—but we can show you why SAJ earned its place in our proposal.',
        compare: {
            leftTitle: 'What we will not claim',
            leftItems: [
                'That SAJ beats every Huawei or competing model',
                'A side-by-side result without matching specifications',
                'A ranking based only on brand recognition',
            ],
            rightTitle: 'What our team has established',
            rightItems: [
                'Procurement reviewed performance, protection, monitoring, warranty, and support',
                'SAJ is one of our strongest overall choices for project delivery',
                'The recommendation is based on balance—not one headline specification',
            ],
        },
        metrics: [
            { value: '2005', title: 'established', body: 'Long operating history' },
            { value: '85+', title: 'countries', body: 'International product footprint' },
            { value: '9 GW', title: 'annual capacity', body: 'Inverter manufacturing' },
        ],
        cards: [
            { title: 'High conversion efficiency', body: 'Listed residential R5 and R6 models reach up to 98.8% maximum efficiency.' },
            { title: 'Protection and quiet operation', body: 'Applicable models include surge protection and low-noise residential operation.' },
            { title: 'Monitoring and support', body: 'The software ecosystem provides real-time visibility, backed by proposal-specific warranty terms.' },
        ],
        note: 'Share the exact Huawei or competing model and datasheet, and our team can compare it against the proposed SAJ model point by point.',
        closing: 'Our position is simple: another brand may also be excellent, but SAJ gives our clients a strong overall balance of performance, safety, visibility, warranty, and project support.',
    },
    'system-suitability': {
        eyebrow: 'Designed around your property',
        theme: 'suitability',
        hero: 'A proposal becomes final only after the system is matched to your roof, electrical setup, and energy use.',
        steps: [
            { value: '01', title: 'Understand usage', body: 'Review historical bills and the property’s load profile.' },
            { value: '02', title: 'Inspect the site', body: 'Check roof condition, orientation, shading, and electrical-board requirements.' },
            { value: '03', title: 'Confirm capacity', body: 'Select a system size that fits both safe installation and useful consumption.' },
            { value: '04', title: 'Refine the design', body: 'Revise assumptions when the technical assessment finds something different.' },
        ],
        note: 'We do not force an original proposal onto a property when the site evidence says it should change.',
    },
    'solar-savings-mechanism': {
        eyebrow: 'How the savings are created',
        theme: 'savings',
        hero: 'The strongest value comes from using your own solar electricity while it is being generated.',
        flow: [
            { value: '1', title: 'Generate', body: 'Panels produce electricity during daylight hours.' },
            { value: '2', title: 'Use first', body: 'Your property consumes solar before importing from TNB.' },
            { value: '3', title: 'Export excess', body: 'Eligible surplus earns Solar ATAP credits within programme limits.' },
        ],
        compare: {
            leftTitle: 'Can reduce',
            leftItems: ['Imported daytime energy', 'Eligible energy charges', 'Dependence on grid electricity'],
            rightTitle: 'Still remains',
            rightItems: ['Fixed charges and levies', 'Taxes and maximum demand', 'Credits unused after monthly reset'],
        },
        note: 'Savings vary by system size, tariff, weather, daytime use, export rate, and programme rules.',
    },
    'package-what-is-included': {
        eyebrow: 'Complete rooftop solar system',
        theme: 'value',
        brandLogo: { src: '/logo/eternalgy.png', alt: 'Eternalgy Solar' },
        hero: 'Your package covers everything — design, government applications, installation, and commissioning — with full warranty and insurance protection included.',
        metrics: [
            { value: '12 yr', title: 'Panel product warranty', body: 'JinkoSolar product warranty' },
            { value: '30 yr', title: 'Panel power warranty', body: 'JinkoSolar linear guarantee' },
            { value: '10 yr', title: 'Inverter warranty', body: 'SAJ product warranty' },
            { value: '3 yr', title: 'Workmanship', body: '+ 1-yr roof-leak cover' },
        ],
        cards: [
            { value: '11×', title: '650W JinkoSolar TIGER NEO 3.0', body: 'N-type TOPCon — highest tropical efficiency, 30-yr linear power warranty' },
            { value: '1×', title: 'SAJ R6 5kW 3-Phase Inverter', body: '98.2% peak efficiency, built-in surge protection' },
            { title: 'SEDA ATAP Application', body: 'Full grid-export application — Eternalgy handles all paperwork' },
            { title: 'TNB Smart Meter Application', body: 'Required for net-billing; submitted on your behalf' },
            { title: 'System & Electrical Design', body: 'Solar architecture design + electrical system design' },
            { title: 'Roof Survey & Installation', body: 'Site surveying + roof panel installation + electrical works' },
            { title: 'SkyLift Access Equipment', body: 'Safe motorised rooftop access for installation' },
        ],
        note: '3-year MSIG all-risk solar system insurance included from day one. Also includes 12-year JinkoSolar product warranty. Final coverage follows your signed proposal.',
    },
    'next-steps': {
        eyebrow: 'A clear path forward',
        theme: 'next',
        hero: 'Proceed with clarity: confirm the final scope first, then move through application, approval, and installation.',
        steps: [
            { value: '01', title: 'Review', body: 'Confirm system scope, equipment, warranties, assessment status, and financing needs.' },
            { value: '02', title: 'Accept', body: 'Complete the proposal acceptance and required customer documents.' },
            { value: '03', title: 'Apply', body: 'A SEDA-registered provider submits the Solar ATAP application through eATAP.' },
            { value: '04', title: 'Deliver', body: 'After approvals and site conditions are confirmed, coordinate installation and commissioning.' },
        ],
        closing: 'Your next action is simple: ask our team to walk you through the final proposal and acceptance requirements.',
    },
    'payment-methods': {
        eyebrow: 'Flexible payment options',
        theme: 'payment',
        hero: 'Pay by Online GIRO, cash deposit, credit card, or spread the cost with a Credit Card Easy Payment Plan (EPP) through 7 participating banks.',
        cards: [
            { title: 'Online GIRO / Cash Deposit', body: 'Direct bank transfer or over-the-counter cash deposit to Eternalgy.' },
            { title: 'Visa / Mastercard', body: 'One-time full payment by credit or debit card.' },
            { title: 'Credit Card EPP', body: 'Spread payments over 6 to 60 months through selected banks at fixed annual interest rates.' },
        ],
        compare: {
            leftTitle: 'EPP — Lower rates',
            leftItems: [
                'Maybank: 6m 2.50% · 12m 3.50% · 24m 5.50% · 36m 6.00% · 48m 8.00% · 60m 10.00%',
                'Public Bank: 6m 2.50% · 12m 3.50% · 18m 4.00% · 24m 5.50% · 36m 6.00% · 48m 8.00% · 60m 10.00%',
                'UOB: 6m 2.50% · 12m 3.50% · 24m 5.50% · 48m 8.50%',
                'CIMB: 6m 2.50% · 12m 3.50%',
            ],
            rightTitle: 'EPP — Other banks',
            rightItems: [
                'Hong Leong: 12m 3.50% · 24m 5.50% · 36m 6.00% · 48m 8.00% · 60m 10.00%',
                'OCBC: 6m 4.00% · 12m 5.00% · 18m 6.00% · 24m 7.00% · 36m 8.00% · 48m 9.00%',
                'AmBank: 24m 7.00% · 36m 9.00%',
            ],
        },
        note: 'EPP rates are per annum. Available tenures and rates vary by bank and card type. Confirm with your bank before proceeding.',
    },
    'payment-terms-and-process': {
        eyebrow: '3 payments. We handle everything else.',
        theme: 'journey',
        hero: 'You only act at three milestones. Eternalgy manages all government applications, scheduling, and paperwork in between.',
        steps: [
            { value: '① 5%', title: 'Confirm your order — we start immediately', body: 'Pay the 5% deposit to lock in your proposal. Eternalgy submits the SEDA Solar ATAP application for you the same week — no action needed from you.' },
            { value: '✓', title: 'SEDA approves your application', body: 'Eternalgy tracks and manages the approval process. Once SEDA gives the green light, we contact you to move to the next step.' },
            { value: '② 60%', title: 'Installation payment — your system goes in', body: 'Pay 60% and your installation date is confirmed. Our self-operated team installs panels, inverter, and full electrical works — typically completed within 2–4 weeks.' },
            { value: '③ 35%', title: 'Final payment — only after your system is complete', body: 'You pay the remaining 35% only after installation is finished and handed over to you. Nothing to pay until you are satisfied.' },
            { value: '✓', title: 'TNB activates your ATAP export meter', body: 'Eternalgy submits the TNB meter change application on your behalf. Once TNB completes the switch, your system is fully live and earning Solar ATAP credits.' },
        ],
        note: 'SEDA and TNB approval timelines are set by the government — Eternalgy manages all submissions and follows up on your behalf throughout.',
    },
};
function renderItems(items, className) {
    return items
        .map((item) => [
        `<div class="${className}">`,
        item.value
            ? `<span class="${className}__value">${escapeHtml(item.value)}</span>`
            : '<span class="ans-premium__mini-mark">✓</span>',
        '<div class="ans-premium__item-copy">',
        `<p class="${className}__title">${escapeHtml(item.title)}</p>`,
        item.body
            ? `<p class="${className}__body">${escapeHtml(item.body)}</p>`
            : '',
        '</div>',
        '</div>',
    ].join(''))
        .join('');
}
function renderCompare(compare) {
    const column = (title, items, modifier) => [
        `<div class="ans-premium__compare-col ${modifier}">`,
        `<p class="ans-premium__compare-title">${escapeHtml(title)}</p>`,
        '<ul class="ans-premium__compare-list">',
        ...items.map((item) => `<li>${escapeHtml(item)}</li>`),
        '</ul>',
        '</div>',
    ].join('');
    return `<div class="ans-premium__compare">${column(compare.leftTitle, compare.leftItems, 'ans-premium__compare-col--muted')}${column(compare.rightTitle, compare.rightItems, 'ans-premium__compare-col--accent')}</div>`;
}
const REPRESENTED_BRANDS = [
    { name: 'Eternalgy', detail: 'In-house solar PV delivery', logo: '/logo/eternalgy.png' },
    { name: 'JinkoSolar', detail: 'Panel warranty and performance', logo: '/logo/jinko-logo.svg' },
    { name: 'SAJ', detail: 'Inverter supply and support', logo: '/logo/SAJ-LOGO.jpg' },
    { name: 'Maybank', detail: 'Exclusive financing partner', logo: '/logo/maybank.png' },
    { name: 'MSIG', detail: 'Solar all-risk insurance' },
    { name: 'SHRDC', detail: 'CoE industry partner' },
];
const CERTIFICATIONS = [
    { name: 'CIDB G3', detail: 'Registered contractor', logo: '/logo/cidb-registered.png' },
    { name: 'SEDA RPVSP', detail: 'Solar PV Service Provider', logo: '/logo/Seda-Malaysia001.png' },
    { name: 'SEDA Investor', detail: 'Solar PV Investor', logo: '/logo/Seda-Malaysia001.png' },
    { name: 'SHRDC CoE', detail: 'Selangor Human Resource Dev Center CoE Partner' },
    { name: 'MPiA', detail: 'Member of MPiA' },
    { name: 'MyHIJAU', detail: 'SAJ certification MyHS00025/25', logo: '/logo/myhijau_plain.jpg' },
    { name: 'Golden Bull', detail: 'Outstanding Bull 2025', logo: '/logo/golden-bull.png' },
    { name: 'TÜV Rheinland', detail: 'Class A+ anti-shading panel certification', logo: '/logo/tuv-rheinland.png' },
];
function renderLogoTiles(items) {
    return items
        .map((item) => {
        const mark = item.logo
            ? `<img class="ans-premium__logo-img" src="${escapeHtml(item.logo)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
            : `<span class="ans-premium__logo-mark">${escapeHtml(item.name)}</span>`;
        return [
            `<div class="ans-premium__logo-tile${item.logo ? ' ans-premium__logo-tile--image' : ''}">`,
            mark,
            `<span class="ans-premium__logo-detail">${escapeHtml(item.detail)}</span>`,
            '</div>',
        ].join('');
    })
        .join('');
}
function renderBrandShowcase() {
    return [
        '<div class="ans-premium__showcase">',
        '<p class="ans-premium__showcase-title">Represented brands, partners & certifications</p>',
        '<div class="ans-premium__showcase-group">',
        '<p class="ans-premium__showcase-label">Brands & partners</p>',
        '<div class="ans-premium__logo-grid">',
        renderLogoTiles(REPRESENTED_BRANDS),
        '</div>',
        '</div>',
        '<div class="ans-premium__showcase-group">',
        '<p class="ans-premium__showcase-label">Certifications & recognition</p>',
        '<div class="ans-premium__logo-grid">',
        renderLogoTiles(CERTIFICATIONS),
        '</div>',
        '</div>',
        '</div>',
    ].join('');
}
function renderCarousel(slides) {
    const slideHtml = slides.map((s, i) => {
        const colorClass = `ans-carousel__slide--c${(i % 12) + 1}`;
        return [
            `<div class="ans-carousel__slide ${colorClass}">`,
            `<span class="ans-carousel__slide-icon">${escapeHtml(s.icon)}</span>`,
            `<p class="ans-carousel__slide-title">${escapeHtml(s.title)}</p>`,
            `<p class="ans-carousel__slide-body">${escapeHtml(s.body)}</p>`,
            '</div>',
        ].join('');
    }).join('');
    const dotsHtml = slides.map((_, i) => `<span class="ans-carousel__dot${i === 0 ? ' ans-carousel__dot--active' : ''}"></span>`).join('');
    return [
        '<div class="ans-carousel">',
        '<div class="ans-carousel__track">',
        slideHtml,
        '</div>',
        '<div class="ans-carousel__nav">',
        '<button class="ans-carousel__prev" type="button" aria-label="Previous slide">&#8249;</button>',
        `<div class="ans-carousel__dots">${dotsHtml}</div>`,
        '<button class="ans-carousel__next" type="button" aria-label="Next slide">&#8250;</button>',
        '</div>',
        '</div>',
    ].join('');
}
function renderPremiumHtml(id, title, answer) {
    const spec = PRESENTATIONS[id];
    const sentences = splitSentences(answer);
    const lead = spec?.hero ?? sentences[0] ?? answer;
    if (!spec) {
        const points = sentences.slice(1).map((body, index) => ({
            value: String(index + 1),
            title: `Key point ${index + 1}`,
            body,
        }));
        return [
            '<section class="ans-premium ans-premium--default">',
            '<p class="ans-premium__eyebrow">Eternalgy recommendation</p>',
            `<h3 class="ans-premium__title">${escapeHtml(title)}</h3>`,
            `<p class="ans-premium__lead">${escapeHtml(lead)}</p>`,
            points.length
                ? `<div class="ans-premium__cards">${renderItems(points, 'ans-premium__card')}</div>`
                : '',
            '</section>',
        ].join('');
    }
    return [
        `<section class="ans-premium ans-premium--${escapeHtml(spec.theme)}">`,
        '<div class="ans-premium__glow"></div>',
        `<p class="ans-premium__eyebrow">${escapeHtml(spec.eyebrow)}</p>`,
        spec.brandLogo
            ? `<div class="ans-premium__brand-row"><img src="${escapeHtml(spec.brandLogo.src)}" alt="${escapeHtml(spec.brandLogo.alt)}" class="ans-premium__brand-logo" loading="lazy" /></div>`
            : '',
        `<h3 class="ans-premium__title">${escapeHtml(title)}</h3>`,
        `<p class="ans-premium__lead">${escapeHtml(lead)}</p>`,
        spec.showcase ? renderBrandShowcase() : '',
        spec.carousel ? renderCarousel(spec.carousel) : '',
        spec.metrics
            ? `<div class="ans-premium__metrics">${renderItems(spec.metrics, 'ans-premium__metric')}</div>`
            : '',
        spec.flow
            ? `<div class="ans-premium__flow">${renderItems(spec.flow, 'ans-premium__flow-step')}</div>`
            : '',
        spec.compare ? renderCompare(spec.compare) : '',
        spec.steps
            ? `<div class="ans-premium__timeline">${renderItems(spec.steps, 'ans-premium__step')}</div>`
            : '',
        spec.cards
            ? `<div class="ans-premium__cards">${renderItems(spec.cards, 'ans-premium__card')}</div>`
            : '',
        spec.note
            ? `<div class="ans-premium__note"><span class="ans-premium__note-mark">i</span><p>${escapeHtml(spec.note)}</p></div>`
            : '',
        spec.closing
            ? `<p class="ans-premium__closing">${escapeHtml(spec.closing)}</p>`
            : '',
        '</section>',
    ].join('');
}
export function parseCuratedFaq(markdown) {
    const metadata = parseFrontmatter(markdown);
    const { title, answer } = extractCuratedFaqAnswer(markdown);
    return {
        ...metadata,
        title,
        answer,
        html: renderPremiumHtml(metadata.id, title, answer),
    };
}
let faqCache = null;
export async function loadCuratedFaqEntries() {
    if (faqCache)
        return faqCache;
    const files = (await readdir(FAQ_DIR))
        .filter((name) => name.endsWith('.md'))
        .sort();
    faqCache = await Promise.all(files.map(async (name) => {
        const markdown = await readFile(resolve(FAQ_DIR, name), 'utf-8');
        return parseCuratedFaq(markdown);
    }));
    return faqCache;
}
export function clearCuratedFaqCache() {
    faqCache = null;
}
function matchScore(question, candidate) {
    const queryNormalised = normalise(question);
    const candidateNormalised = normalise(candidate);
    if (queryNormalised === candidateNormalised)
        return 1;
    if ((candidateNormalised.length >= 8 && queryNormalised.includes(candidateNormalised))
        || (queryNormalised.length >= 8 && candidateNormalised.includes(queryNormalised))) {
        return 0.96;
    }
    const queryTokens = new Set(contentTokens(question));
    const candidateTokens = new Set(contentTokens(candidate));
    if (queryTokens.size === 0 || candidateTokens.size === 0)
        return 0;
    let overlap = 0;
    for (const token of queryTokens) {
        if (candidateTokens.has(token))
            overlap++;
    }
    if (overlap < 2)
        return 0;
    const queryCoverage = overlap / queryTokens.size;
    const candidateCoverage = overlap / candidateTokens.size;
    return (queryCoverage * 0.65) + (candidateCoverage * 0.35);
}
function isCompanyIntroQuestion(question) {
    const normalized = normalise(question);
    const companyIntroPatterns = [
        /\bintro\b.*\bcompany\b/,
        /\bintroduce\b.*\bcompany\b/,
        /\bintroduce\b.*\beternalgy\b/,
        /\btell me about\b.*\bcompany\b/,
        /\btell me about\b.*\beternalgy\b/,
        /\bwhat is\b.*\beternalgy\b/,
        /\bwho is\b.*\beternalgy\b/,
        /\bnever heard of\b.*\beternalgy\b/,
        /\byour company good\b/,
        /\bis your company good\b/,
        /\bwhy choose\b.*\beternalgy\b/,
        /\bwhy should i choose\b.*\beternalgy\b/,
        /\bwhy should we go with\b.*\beternalgy\b/,
        /\bwhy should i trust\b/,
        /\bcan i trust\b/,
        /\btrustworthy\b/,
        /\breliable\b/,
        /\bcertification\b/,
        /\bcertified\b/,
    ];
    return companyIntroPatterns.some((pattern) => pattern.test(normalized));
}
export async function findCuratedFaq(question) {
    const entries = await loadCuratedFaqEntries();
    const companyIntroQuestion = isCompanyIntroQuestion(question);
    let best = null;
    for (const entry of entries) {
        for (const candidate of entry.questions) {
            let score = matchScore(question, candidate);
            if (companyIntroQuestion
                && (entry.id === 'why-choose-eternalgy' || entry.id === 'trust-and-credentials')) {
                score = Math.max(score, 0.95);
            }
            if (!best || score > best.score) {
                best = { entry, matchedQuestion: candidate, score };
            }
        }
    }
    if (!best || best.score < 0.78)
        return null;
    return {
        id: best.entry.id,
        intent: best.entry.intent,
        matchedQuestion: best.matchedQuestion,
        html: best.entry.html,
    };
}
//# sourceMappingURL=curated-faq.js.map