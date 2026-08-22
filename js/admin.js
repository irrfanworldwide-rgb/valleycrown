import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { money } from './utils.js';

const sb = getSupabase();
const page = document.body.dataset.adminPage || '';
const isLogin = page === 'login';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHtml = (v = '') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const slugify = (v='') => v.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const csv = (v='') => v.split(',').map(x=>x.trim()).filter(Boolean);
const formatDate = v => v ? new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v)) : '—';

function go(path){ location.replace(path); }
function setMsg(selector, text, isError=false){ const el=$(selector); if(!el)return; el.textContent=text||''; el.style.color=isError?'#ffb2b2':'#d8c99e'; }
function openModal(sel){ $(sel)?.classList.remove('hide'); document.body.style.overflow='hidden'; }
function closeModal(sel){ $(sel)?.classList.add('hide'); document.body.style.overflow=''; }

function initShell(){
  $(`[data-nav="${page}"]`)?.classList.add('active');
  const sidebar=$('[data-admin-sidebar]'), overlay=$('[data-admin-overlay]');
  const close=()=>{sidebar?.classList.remove('open');overlay?.classList.remove('show')};
  $('[data-admin-menu]')?.addEventListener('click',()=>{sidebar?.classList.toggle('open');overlay?.classList.toggle('show')});
  overlay?.addEventListener('click',close);
  $$('.admin-nav a').forEach(a=>a.addEventListener('click',close));
}

async function requireAdmin(){
  if(!isSupabaseConfigured() || !sb){ if(!isLogin) go('/admin/login.html'); return false; }
  const {data:{session}, error:sessionError}=await sb.auth.getSession();
  if(sessionError){ if(!isLogin) go('/admin/login.html'); return false; }
  if(isLogin){
    if(session){ const {data:{user}}=await sb.auth.getUser(); if(user?.app_metadata?.role==='admin') go('/admin/index.html'); else await sb.auth.signOut(); }
    return true;
  }
  if(!session){ go('/admin/login.html'); return false; }
  const {data:{user},error}=await sb.auth.getUser();
  if(error || !user || user.app_metadata?.role!=='admin'){ await sb.auth.signOut(); go('/admin/login.html'); return false; }
  return true;
}

async function initLogin(){
  $('#admin-login')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=$('button[type="submit"]',e.currentTarget); btn.disabled=true; setMsg('#msg','Signing in…');
    if(!isSupabaseConfigured()||!sb){setMsg('#msg','Supabase is not configured in js/config.js.',true);btn.disabled=false;return}
    const {error}=await sb.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
    if(error){setMsg('#msg',error.message,true);btn.disabled=false;return}
    const {data:{user},error:userError}=await sb.auth.getUser();
    if(userError||user?.app_metadata?.role!=='admin'){await sb.auth.signOut();setMsg('#msg','This account does not have admin access.',true);btn.disabled=false;return}
    go('/admin/index.html');
  });
}

async function initDashboard(){
  const [productsRes, ordersRes, lowRes, recentRes] = await Promise.all([
    sb.from('products').select('*',{count:'exact',head:true}),
    sb.from('orders').select('*',{count:'exact',head:true}),
    sb.from('products').select('*',{count:'exact',head:true}).lte('stock',5),
    sb.from('orders').select('id,order_number,customer_name,total,status,created_at').order('created_at',{ascending:false}).limit(5)
  ]);
  $('[data-stat-products]').textContent=productsRes.count??0;
  $('[data-stat-orders]').textContent=ordersRes.count??0;
  $('[data-stat-low]').textContent=lowRes.count??0;
  const {data:delivered}=await sb.from('orders').select('total').eq('status','Delivered');
  const revenue=(delivered||[]).reduce((s,o)=>s+Number(o.total||0),0);
  $('[data-stat-revenue]').textContent=money(revenue);
  const wrap=$('[data-recent-orders]');
  if(!recentRes.data?.length){wrap.innerHTML='<div class="admin-list-empty">No orders yet.</div>';return}
  wrap.innerHTML=recentRes.data.map(o=>`<div class="admin-recent__row"><span><strong>${escapeHtml(o.order_number)}</strong><br><small>${escapeHtml(o.customer_name||'No customer name')}</small></span><span>${money(o.total||0)}</span><span>${escapeHtml(o.status)}</span><span>${formatDate(o.created_at)}</span></div>`).join('');
}

let productRows=[]; let categoryRows=[]; let currentProductImages=[];
async function loadCategoriesForProducts(){
  const {data,error}=await sb.from('categories').select('id,name,slug,status').order('name');
  if(error) throw error; categoryRows=data||[];
  const select=$('[data-category-options]');
  if(select) select.innerHTML='<option value="">No category</option>'+categoryRows.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}
async function loadProducts(){
  const {data,error}=await sb.from('products').select('*,categories(name),product_images(id,url,sort_order)').order('created_at',{ascending:false});
  if(error){ $('[data-products-list]').innerHTML=`<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`; return; }
  productRows=(data||[]).map(p=>({...p,product_images:(p.product_images||[]).sort((a,b)=>a.sort_order-b.sort_order)})); renderProductsAdmin();
}
function renderProductsAdmin(){
  const q=($('[data-product-search]')?.value||'').trim().toLowerCase(); const status=$('[data-product-filter]')?.value||'all';
  const rows=productRows.filter(p=>(status==='all'||p.status===status)&&(!q||[p.name,p.sku,p.categories?.name].some(v=>String(v||'').toLowerCase().includes(q))));
  $('[data-product-count]').textContent=`${rows.length} product${rows.length===1?'':'s'}`;
  const body=$('[data-products-list]');
  if(!rows.length){body.innerHTML='<tr><td colspan="6"><div class="admin-list-empty">No products found.</div></td></tr>';return}
  body.innerHTML=rows.map(p=>`<tr><td data-label="Product"><div style="display:flex;gap:10px;align-items:center">${p.product_images?.[0]?.url?`<img class="admin-thumb" src="${escapeHtml(p.product_images[0].url)}" alt="">`:''}<div><strong>${escapeHtml(p.name)}</strong><br><small>${escapeHtml(p.categories?.name||'Uncategorised')}</small></div></div></td><td data-label="Price">${money(p.sale_price||p.price)}${p.sale_price?` <small><s>${money(p.price)}</s></small>`:''}</td><td data-label="Stock">${p.stock}</td><td data-label="Status"><span class="admin-status ${p.status==='inactive'?'admin-status--inactive':''}">${escapeHtml(p.status)}</span></td><td data-label="Flags">${[p.featured&&'Featured',p.new_arrival&&'New',p.bestseller&&'Bestseller'].filter(Boolean).join(' · ')||'—'}</td><td data-label="Actions"><div style="display:flex;gap:7px;justify-content:flex-end"><button class="admin-btn admin-btn--secondary" data-edit-product="${p.id}">Edit</button><button class="admin-btn admin-btn--danger" data-delete-product="${p.id}">Delete</button></div></td></tr>`).join('');
}
function fillProductForm(p=null){
  const f=$('[data-product-form]'); f.reset(); currentProductImages=[]; $('[data-image-preview]').innerHTML='';
  f.elements.id.value=p?.id||''; f.elements.name.value=p?.name||''; f.elements.slug.value=p?.slug||''; f.elements.category_id.value=p?.category_id||''; f.elements.sku.value=p?.sku||''; f.elements.price.value=p?.price??''; f.elements.sale_price.value=p?.sale_price??''; f.elements.stock.value=p?.stock??0; f.elements.material.value=p?.material||''; f.elements.sizes.value=(p?.sizes||[]).join(', '); f.elements.colors.value=(p?.colors||[]).join(', '); f.elements.short_description.value=p?.short_description||''; f.elements.description.value=p?.description||''; f.elements.status.value=p?.status||'active'; f.elements.featured.checked=Boolean(p?.featured); f.elements.new_arrival.checked=Boolean(p?.new_arrival); f.elements.bestseller.checked=Boolean(p?.bestseller);
  currentProductImages=[...(p?.product_images||[])]; renderImagePreview(); $('[data-product-modal-title]').textContent=p?'Edit product':'Add product'; setMsg('[data-product-message]','');
}
function renderImagePreview(){
  const el=$('[data-image-preview]'); if(!el)return; el.innerHTML=currentProductImages.map(img=>`<div class="admin-image-item"><img src="${escapeHtml(img.url)}" alt=""><button type="button" data-remove-existing-image="${img.id}" aria-label="Remove image">×</button></div>`).join('');
}
async function uploadProductImages(productId,files){
  const valid=[...files].filter(f=>['image/jpeg','image/png','image/webp'].includes(f.type)&&f.size<=5*1024*1024);
  const available=8-currentProductImages.length; const selected=valid.slice(0,available); if(!selected.length)return;
  for(let i=0;i<selected.length;i++){
    const file=selected[i]; const ext=(file.name.split('.').pop()||'jpg').toLowerCase(); const path=`${productId}/${Date.now()}-${i}.${ext}`;
    const {error:upErr}=await sb.storage.from('products').upload(path,file,{cacheControl:'31536000',upsert:false}); if(upErr) throw upErr;
    const {data:{publicUrl}}=sb.storage.from('products').getPublicUrl(path);
    const {error:dbErr}=await sb.from('product_images').insert({product_id:productId,url:publicUrl,sort_order:currentProductImages.length+i}); if(dbErr) throw dbErr;
  }
}
async function saveProduct(e){
  e.preventDefault(); const f=e.currentTarget, btn=$('button[type="submit"]',f); btn.disabled=true; setMsg('[data-product-message]','Saving…');
  try{
    const id=f.elements.id.value; const payload={name:f.elements.name.value.trim(),slug:slugify(f.elements.slug.value||f.elements.name.value),category_id:f.elements.category_id.value||null,sku:f.elements.sku.value.trim()||null,price:Number(f.elements.price.value),sale_price:f.elements.sale_price.value?Number(f.elements.sale_price.value):null,stock:Number(f.elements.stock.value||0),material:f.elements.material.value.trim()||null,sizes:csv(f.elements.sizes.value),colors:csv(f.elements.colors.value),short_description:f.elements.short_description.value.trim()||null,description:f.elements.description.value.trim()||null,status:f.elements.status.value,featured:f.elements.featured.checked,new_arrival:f.elements.new_arrival.checked,bestseller:f.elements.bestseller.checked};
    let productId=id;
    if(id){const {error}=await sb.from('products').update(payload).eq('id',id);if(error)throw error}else{const {data,error}=await sb.from('products').insert(payload).select('id').single();if(error)throw error;productId=data.id}
    const files=f.elements.images.files; if(currentProductImages.length+files.length>8) throw new Error('Maximum 8 product images are allowed.');
    await uploadProductImages(productId,files); setMsg('[data-product-message]','Saved.'); await loadProducts(); setTimeout(()=>closeModal('[data-product-modal]'),350);
  }catch(err){setMsg('[data-product-message]',err.message||'Could not save product.',true)}finally{btn.disabled=false}
}
async function deleteProduct(id){
  const p=productRows.find(x=>x.id===id); if(!confirm(`Delete “${p?.name||'this product'}”? This also removes its image records.`))return;
  const prefix=`${id}`; const {data:objects}=await sb.storage.from('products').list(prefix,{limit:100}); if(objects?.length) await sb.storage.from('products').remove(objects.map(o=>`${prefix}/${o.name}`));
  const {error}=await sb.from('products').delete().eq('id',id); if(error) alert(error.message); else loadProducts();
}
async function initProducts(){
  await loadCategoriesForProducts(); await loadProducts();
  $('[data-new-product]')?.addEventListener('click',()=>{fillProductForm();openModal('[data-product-modal]')});
  $$('[data-close-product]').forEach(b=>b.addEventListener('click',()=>closeModal('[data-product-modal]')));
  $('[data-product-form]')?.addEventListener('submit',saveProduct); $('[data-product-search]')?.addEventListener('input',renderProductsAdmin); $('[data-product-filter]')?.addEventListener('change',renderProductsAdmin);
  $('[data-products-list]')?.addEventListener('click',async e=>{const edit=e.target.closest('[data-edit-product]'),del=e.target.closest('[data-delete-product]');if(edit){fillProductForm(productRows.find(p=>p.id===edit.dataset.editProduct));openModal('[data-product-modal]')}if(del)await deleteProduct(del.dataset.deleteProduct)});
  $('[data-image-preview]')?.addEventListener('click',async e=>{const b=e.target.closest('[data-remove-existing-image]');if(!b)return;const img=currentProductImages.find(x=>x.id===b.dataset.removeExistingImage);if(!img)return;if(!confirm('Remove this image?'))return;const {error}=await sb.from('product_images').delete().eq('id',img.id);if(error){alert(error.message);return}try{const url=new URL(img.url);const marker='/storage/v1/object/public/products/';const idx=url.pathname.indexOf(marker);if(idx>=0){const path=decodeURIComponent(url.pathname.slice(idx+marker.length));await sb.storage.from('products').remove([path])}}catch{}currentProductImages=currentProductImages.filter(x=>x.id!==img.id);renderImagePreview()});
  $('[data-product-form] [name="name"]')?.addEventListener('input',e=>{const slug=$('[data-product-form] [name="slug"]');if(!slug.dataset.touched)slug.value=slugify(e.target.value)}); $('[data-product-form] [name="slug"]')?.addEventListener('input',e=>e.target.dataset.touched='1');
}

let categoriesAdmin=[];
async function loadCategoriesAdmin(){
  const [{data,error},{data:productRefs,error:productError}]=await Promise.all([sb.from('categories').select('id,name,slug,status').order('name'),sb.from('products').select('category_id')]);
  if(error||productError){$('[data-categories-list]').innerHTML=`<tr><td colspan="5">${escapeHtml((error||productError).message)}</td></tr>`;return} const counts=(productRefs||[]).reduce((m,p)=>(p.category_id&&(m[p.category_id]=(m[p.category_id]||0)+1),m),{}); categoriesAdmin=(data||[]).map(c=>({...c,product_count:counts[c.id]||0})); renderCategoriesAdmin();
}
function renderCategoriesAdmin(){const q=($('[data-category-search]')?.value||'').toLowerCase();const rows=categoriesAdmin.filter(c=>!q||c.name.toLowerCase().includes(q)||c.slug.toLowerCase().includes(q));$('[data-category-count]').textContent=`${rows.length} categor${rows.length===1?'y':'ies'}`;const body=$('[data-categories-list]');body.innerHTML=rows.length?rows.map(c=>`<tr><td data-label="Name"><strong>${escapeHtml(c.name)}</strong></td><td data-label="Slug">${escapeHtml(c.slug)}</td><td data-label="Status"><span class="admin-status ${c.status==='inactive'?'admin-status--inactive':''}">${escapeHtml(c.status)}</span></td><td data-label="Products">${c.product_count??0}</td><td data-label="Actions"><div style="display:flex;gap:7px;justify-content:flex-end"><button class="admin-btn admin-btn--secondary" data-edit-category="${c.id}">Edit</button><button class="admin-btn admin-btn--danger" data-delete-category="${c.id}">Delete</button></div></td></tr>`).join(''):'<tr><td colspan="5"><div class="admin-list-empty">No categories found.</div></td></tr>'}
function fillCategory(c=null){const f=$('[data-category-form]');f.reset();f.elements.id.value=c?.id||'';f.elements.name.value=c?.name||'';f.elements.slug.value=c?.slug||'';f.elements.status.value=c?.status||'active';$('[data-category-modal-title]').textContent=c?'Edit category':'Add category';setMsg('[data-category-message]','')}
async function saveCategory(e){e.preventDefault();const f=e.currentTarget,btn=$('button[type="submit"]',f);btn.disabled=true;try{const payload={name:f.elements.name.value.trim(),slug:slugify(f.elements.slug.value||f.elements.name.value),status:f.elements.status.value};const id=f.elements.id.value;const res=id?await sb.from('categories').update(payload).eq('id',id):await sb.from('categories').insert(payload);if(res.error)throw res.error;await loadCategoriesAdmin();closeModal('[data-category-modal]')}catch(err){setMsg('[data-category-message]',err.message,true)}finally{btn.disabled=false}}
async function deleteCategory(id){const c=categoriesAdmin.find(x=>x.id===id);const count=c?.product_count??0;if(count>0){alert(`This category is used by ${count} product(s). Move those products to another category before deleting it.`);return}if(!confirm(`Delete “${c?.name}”?`))return;const {error}=await sb.from('categories').delete().eq('id',id);if(error)alert(error.message);else loadCategoriesAdmin()}
async function initCategories(){await loadCategoriesAdmin();$('[data-new-category]')?.addEventListener('click',()=>{fillCategory();openModal('[data-category-modal]')});$$('[data-close-category]').forEach(b=>b.addEventListener('click',()=>closeModal('[data-category-modal]')));$('[data-category-form]')?.addEventListener('submit',saveCategory);$('[data-category-search]')?.addEventListener('input',renderCategoriesAdmin);$('[data-categories-list]')?.addEventListener('click',async e=>{const edit=e.target.closest('[data-edit-category]'),del=e.target.closest('[data-delete-category]');if(edit){fillCategory(categoriesAdmin.find(c=>c.id===edit.dataset.editCategory));openModal('[data-category-modal]')}if(del)await deleteCategory(del.dataset.deleteCategory)});$('[data-category-form] [name="name"]')?.addEventListener('input',e=>{const slug=$('[data-category-form] [name="slug"]');if(!slug.dataset.touched)slug.value=slugify(e.target.value)});$('[data-category-form] [name="slug"]')?.addEventListener('input',e=>e.target.dataset.touched='1')}

let ordersAdmin=[];
async function loadOrders(){const {data,error}=await sb.from('orders').select('*').order('created_at',{ascending:false});if(error){$('[data-orders-list]').innerHTML=`<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;return}ordersAdmin=data||[];renderOrders()}
function renderOrders(){const q=($('[data-order-search]')?.value||'').toLowerCase(),status=$('[data-order-filter]')?.value||'all';const rows=ordersAdmin.filter(o=>(status==='all'||o.status===status)&&(!q||[o.order_number,o.customer_name,o.phone].some(v=>String(v||'').toLowerCase().includes(q))));$('[data-order-count]').textContent=`${rows.length} order${rows.length===1?'':'s'}`;const body=$('[data-orders-list]');body.innerHTML=rows.length?rows.map(o=>`<tr><td data-label="Order"><strong>${escapeHtml(o.order_number)}</strong></td><td data-label="Customer">${escapeHtml(o.customer_name||'—')}<br><small>${escapeHtml(o.phone||'')}</small></td><td data-label="Total">${money(o.total||0)}</td><td data-label="Status"><span class="admin-status ${o.status==='Cancelled'?'admin-status--cancelled':''}">${escapeHtml(o.status)}</span></td><td data-label="Date">${formatDate(o.created_at)}</td><td data-label="Actions"><div style="display:flex;gap:7px;justify-content:flex-end"><button class="admin-btn admin-btn--secondary" data-edit-order="${o.id}">Edit</button><button class="admin-btn admin-btn--danger" data-delete-order="${o.id}">Delete</button></div></td></tr>`).join(''):'<tr><td colspan="6"><div class="admin-list-empty">No orders found.</div></td></tr>'}
function fillOrder(o=null){const f=$('[data-order-form]');f.reset();f.elements.id.value=o?.id||'';f.elements.order_number.value=o?.order_number||`VC-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${String(Date.now()).slice(-4)}`;f.elements.status.value=o?.status||'New';f.elements.customer_name.value=o?.customer_name||'';f.elements.phone.value=o?.phone||'';f.elements.address.value=o?.address||'';f.elements.total.value=o?.total??0;f.elements.items_summary.value=o?.items_summary||'';f.elements.notes.value=o?.notes||'';$('[data-order-modal-title]').textContent=o?'Edit order':'Add order';setMsg('[data-order-message]','')}
async function saveOrder(e){e.preventDefault();const f=e.currentTarget,btn=$('button[type="submit"]',f);btn.disabled=true;try{const payload={order_number:f.elements.order_number.value.trim(),status:f.elements.status.value,customer_name:f.elements.customer_name.value.trim()||null,phone:f.elements.phone.value.trim()||null,address:f.elements.address.value.trim()||null,total:Number(f.elements.total.value||0),items_summary:f.elements.items_summary.value.trim()||null,notes:f.elements.notes.value.trim()||null};const id=f.elements.id.value;const res=id?await sb.from('orders').update(payload).eq('id',id):await sb.from('orders').insert(payload);if(res.error)throw res.error;await loadOrders();closeModal('[data-order-modal]')}catch(err){setMsg('[data-order-message]',err.message,true)}finally{btn.disabled=false}}
async function initOrders(){await loadOrders();$('[data-new-order]')?.addEventListener('click',()=>{fillOrder();openModal('[data-order-modal]')});$$('[data-close-order]').forEach(b=>b.addEventListener('click',()=>closeModal('[data-order-modal]')));$('[data-order-form]')?.addEventListener('submit',saveOrder);$('[data-order-search]')?.addEventListener('input',renderOrders);$('[data-order-filter]')?.addEventListener('change',renderOrders);$('[data-orders-list]')?.addEventListener('click',async e=>{const edit=e.target.closest('[data-edit-order]'),del=e.target.closest('[data-delete-order]');if(edit){fillOrder(ordersAdmin.find(o=>o.id===edit.dataset.editOrder));openModal('[data-order-modal]')}if(del&&confirm('Delete this order?')){const {error}=await sb.from('orders').delete().eq('id',del.dataset.deleteOrder);if(error)alert(error.message);else loadOrders()}})}

async function initSettings(){const f=$('[data-settings-form]');const {data,error}=await sb.from('site_settings').select('value').eq('key','store').maybeSingle();if(!error&&data?.value){for(const [k,v] of Object.entries(data.value)){if(f.elements[k])f.elements[k].value=v??''}}f.addEventListener('submit',async e=>{e.preventDefault();const btn=$('button[type="submit"]',f);btn.disabled=true;setMsg('[data-settings-message]','Saving…');const value=Object.fromEntries(new FormData(f).entries());const {error}=await sb.from('site_settings').upsert({key:'store',value},{onConflict:'key'});setMsg('[data-settings-message]',error?error.message:'Settings saved.',Boolean(error));btn.disabled=false})}

async function boot(){
  initShell();
  const ok=await requireAdmin(); if(!ok)return;
  if(isLogin){await initLogin();return}
  $('[data-logout]')?.addEventListener('click',async()=>{await sb.auth.signOut();go('/admin/login.html')});
  sb.auth.onAuthStateChange((_event,session)=>{if(!session&&!isLogin)go('/admin/login.html')});
  try{
    if(page==='dashboard')await initDashboard();
    if(page==='products')await initProducts();
    if(page==='categories')await initCategories();
    if(page==='orders')await initOrders();
    if(page==='settings')await initSettings();
  }catch(err){console.error(err);alert(`Admin error: ${err.message||err}`)}
}
boot();
