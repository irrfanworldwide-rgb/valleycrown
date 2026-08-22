import { fetchProducts } from './products.js';
import { fetchCategories } from './categories.js';
import { renderProducts } from './app.js';
import { getParam } from './utils.js';

let all = [];
const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c] || c));

function apply() {
  let results = [...all];
  const q = document.querySelector('[data-shop-search]')?.value.toLowerCase() || '';
  const selectedCategories = [...document.querySelectorAll('[data-cat]:checked')].map(x => x.value);
  const max = Number(document.querySelector('[data-price]')?.value || 5000);
  const stockOnly = document.querySelector('[data-stock]')?.checked;
  const sort = document.querySelector('[data-sort]')?.value;

  if (q) results = results.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  if (selectedCategories.length) results = results.filter(p => selectedCategories.includes(p.category));
  results = results.filter(p => (p.sale_price || p.price) <= max);
  if (stockOnly) results = results.filter(p => p.stock > 0);
  if (getParam('filter') === 'new') results = results.filter(p => p.new_arrival);
  if (getParam('filter') === 'sale') results = results.filter(p => p.sale_price);
  if (getParam('filter') === 'bestseller') results = results.filter(p => p.bestseller);

  const category = getParam('category');
  if (category) results = results.filter(p => p.category === category);

  if (sort === 'low') results.sort((a,b) => (a.sale_price || a.price) - (b.sale_price || b.price));
  if (sort === 'high') results.sort((a,b) => (b.sale_price || b.price) - (a.sale_price || a.price));
  if (sort === 'sale') results = results.filter(p => p.sale_price);

  document.querySelector('[data-result-count]').textContent = `${results.length} pieces`;
  renderProducts(document.querySelector('[data-shop-grid]'), results);
}

function renderCategoryFilters(categories) {
  const host = document.querySelector('[data-category-filters]');
  if (!host) return;
  if (!categories.length) {
    host.innerHTML = '<span style="font-size:13px;color:var(--muted)">No categories available.</span>';
    return;
  }
  host.innerHTML = categories.map(c => `<label><input type="checkbox" value="${escapeHtml(c.name)}" data-cat> ${escapeHtml(c.name)}</label>`).join('');
  host.querySelectorAll('[data-cat]').forEach(el => el.addEventListener('change', apply));
}

(async () => {
  const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
  all = products;
  renderCategoryFilters(categories);
  document.querySelectorAll('[data-shop-search],[data-stock],[data-price]').forEach(el => el.addEventListener(el.matches('[data-stock]') ? 'change' : 'input', apply));
  document.querySelector('[data-sort]')?.addEventListener('change', apply);
  apply();
})();
