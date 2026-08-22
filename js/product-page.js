import {fetchProduct,fetchProducts} from './products.js';
import {getParam,money} from './utils.js';
import {addToCart} from './cart.js';
import {productMessage,wa} from './whatsapp.js';
import {renderProducts} from './app.js';
import {isWishlisted,toggleWishlist} from './wishlist.js';

(async()=>{
  const p=await fetchProduct(getParam('id'));
  const wrap=document.querySelector('[data-product-detail]');
  if(!p||!wrap){
    if(wrap)wrap.innerHTML='<div class="empty">Product unavailable.<br><br><a class="button" href="/shop.html">Back to shop</a></div>';
    return;
  }

  const images=(Array.isArray(p.images)&&p.images.length?p.images:[p.image]).filter(Boolean).slice(0,8);
  let activeImage=images[0]||'';
  let size=p.sizes?.[0]||'M',color=p.colors?.[0]||'Black',qty=1;

  wrap.innerHTML=`<div class="product-detail"><div class="gallery"><div class="thumbs" data-thumbs>${images.map((src,i)=>`<button class="thumb ${i===0?'active':''}" type="button" data-image="${i}" aria-label="View image ${i+1} of ${images.length}"><img src="${src}" alt="${p.name} image ${i+1}" loading="${i===0?'eager':'lazy'}"></button>`).join('')}</div><div class="main-image"><img data-main-image src="${activeImage}" alt="${p.name}"></div></div><div class="detail-copy"><span class="eyebrow">${p.category} · ${p.material}</span><h1>${p.name}</h1><div class="price">${money(p.sale_price||p.price)} ${p.sale_price?`<del>${money(p.price)}</del>`:''}</div><button class="product-wishlist" type="button" data-product-wish aria-pressed="${isWishlisted(p.id)}">${isWishlisted(p.id)?'♥ Saved to wishlist':'♡ Add to wishlist'}</button><p>Designed for everyday wear with a refined silhouette and easy layering. Product availability is confirmed before any WhatsApp order is accepted.</p><div class="variant-row"><strong>Size</strong><div class="chips" data-sizes>${(p.sizes||['M']).map((s,i)=>`<button class="chip ${i?'':'active'}" data-size="${s}">${s}</button>`).join('')}</div></div><div class="variant-row"><strong>Color</strong><div class="chips" data-colors>${(p.colors||['Black']).map((s,i)=>`<button class="chip ${i?'':'active'}" data-color="${s}">${s}</button>`).join('')}</div></div><div class="variant-row"><strong>Quantity</strong><div class="qty"><button data-minus>−</button><span data-qty>1</span><button data-plus>+</button></div></div><div class="sticky-actions"><button class="button button--light" data-add>Add to cart</button><a class="button" data-wa target="_blank" rel="noopener">Buy on WhatsApp</a></div><div class="search-panel" style="margin-top:25px"><strong>Shipping</strong><p>Free shipping across India · Estimated 3–7 working days.</p></div></div></div>`;

  wrap.querySelectorAll('[data-image]').forEach(button=>button.addEventListener('click',()=>{
    const index=Number(button.dataset.image);
    activeImage=images[index]||activeImage;
    wrap.querySelector('[data-main-image]').src=activeImage;
    wrap.querySelectorAll('[data-image]').forEach(x=>x.classList.toggle('active',x===button));
  }));

  const wishButton=wrap.querySelector('[data-product-wish]');
  wishButton.addEventListener('click',()=>{
    const saved=toggleWishlist(p.id);
    wishButton.textContent=saved?'♥ Saved to wishlist':'♡ Add to wishlist';
    wishButton.setAttribute('aria-pressed',String(saved));
  });

  wrap.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{wrap.querySelectorAll('[data-size]').forEach(x=>x.classList.remove('active'));b.classList.add('active');size=b.dataset.size;update()});
  wrap.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{wrap.querySelectorAll('[data-color]').forEach(x=>x.classList.remove('active'));b.classList.add('active');color=b.dataset.color;update()});
  wrap.querySelector('[data-plus]').onclick=()=>{qty++;update()};
  wrap.querySelector('[data-minus]').onclick=()=>{qty=Math.max(1,qty-1);update()};
  wrap.querySelector('[data-add]').onclick=()=>addToCart({id:p.id,name:p.name,price:p.sale_price||p.price,image:p.image,size,color,qty});
  function update(){wrap.querySelector('[data-qty]').textContent=qty;wrap.querySelector('[data-wa]').href=wa(productMessage(p,size,color,qty))}
  update();
  const all=await fetchProducts();
  renderProducts(document.querySelector('[data-related-grid]'),all.filter(x=>x.id!==p.id).slice(0,4));
})();
