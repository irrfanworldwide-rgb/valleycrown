import {fetchProducts} from './products.js';
import {renderProducts} from './app.js';

let products=[];
(async()=>{
  products=await fetchProducts();
  const input=document.querySelector('[data-search]');
  const grid=document.querySelector('[data-search-grid]');
  if(!input||!grid)return;

  const run=()=>{
    const q=input.value.trim().toLowerCase();
    const matches=products.filter(p=>[
      p.name,
      p.category,
      p.material,
      p.short_description,
      p.description,
      p.sku
    ].some(value=>String(value||'').toLowerCase().includes(q)));

    if(!matches.length){
      grid.innerHTML='<div class="empty" style="grid-column:1/-1">No products found. Try another product name, category or material.</div>';
      return;
    }
    renderProducts(grid,matches);
  };

  input.addEventListener('input',run);
  run();
})();
