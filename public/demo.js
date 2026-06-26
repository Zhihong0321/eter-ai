(() => {
  const searchForm = document.getElementById('invoice-search-form');
  const searchInput = document.getElementById('invoice-search-input');
  const searchButton = document.getElementById('invoice-search-btn');
  const searchStatus = document.getElementById('invoice-search-status');
  const resultsContainer = document.getElementById('invoice-results');

  if (
    !(searchForm instanceof HTMLFormElement) ||
    !(searchInput instanceof HTMLInputElement) ||
    !(searchButton instanceof HTMLButtonElement) ||
    !(searchStatus instanceof HTMLElement) ||
    !(resultsContainer instanceof HTMLElement)
  ) {
    return;
  }

  function setStatus(message, isError = false) {
    searchStatus.textContent = message;
    searchStatus.className =
      'invoice-search-status' + (isError ? ' invoice-search-status--error' : '');
  }

  function applyInvoice(invoiceUid) {
    window.location.href = '/?invoice_uid=' + encodeURIComponent(invoiceUid);
  }

  function renderResults(results) {
    resultsContainer.replaceChildren();
    if (results.length === 0) {
      setStatus('No matching invoice found.');
      return;
    }

    setStatus(results.length + (results.length === 1 ? ' invoice found.' : ' invoices found.'));
    for (const result of results) {
      const card = document.createElement('article');
      card.className = 'invoice-result';

      const details = document.createElement('div');
      const customer = document.createElement('div');
      customer.className = 'invoice-result__customer';
      customer.textContent = result.customerName;

      const number = document.createElement('div');
      number.className = 'invoice-result__number';
      number.textContent = 'Invoice: ' + result.invoiceNumber;

      const packageName = document.createElement('div');
      packageName.className = 'invoice-result__package';
      packageName.textContent = result.packageName;
      details.append(customer, number, packageName);

      if (result.packageDescription) {
        const description = document.createElement('div');
        description.className = 'invoice-result__description';
        const firstLines = result.packageDescription
          .split(/\r?\n/)
          .filter(Boolean)
          .slice(0, 3);
        description.textContent = firstLines.join(' • ');
        details.appendChild(description);
      }

      const applyButton = document.createElement('button');
      applyButton.type = 'button';
      applyButton.className = 'invoice-result__apply';
      applyButton.textContent = 'Apply to Conversation';
      applyButton.addEventListener('click', () => applyInvoice(result.invoiceUid));

      card.append(details, applyButton);
      resultsContainer.appendChild(card);
    }
  }

  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    resultsContainer.replaceChildren();

    if (query.length < 2) {
      setStatus('Enter at least 2 characters.', true);
      return;
    }

    searchButton.disabled = true;
    searchButton.textContent = 'Searching...';
    setStatus('Searching production invoices...');

    try {
      const response = await fetch('/api/invoices/search?q=' + encodeURIComponent(query));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invoice search failed.');
      renderResults(Array.isArray(data.results) ? data.results : []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Invoice search failed.', true);
    } finally {
      searchButton.disabled = false;
      searchButton.textContent = 'Search Invoice';
    }
  });
})();
