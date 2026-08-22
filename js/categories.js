import { getSupabase } from './supabase.js';

const DEMO_CATEGORIES = [
  { id: 'demo-everyday', name: 'Everyday', slug: 'everyday', status: 'active' },
  { id: 'demo-layers', name: 'Layers', slug: 'layers', status: 'active' },
  { id: 'demo-occasion', name: 'Occasion', slug: 'occasion', status: 'active' }
];

export async function fetchCategories() {
  const sb = getSupabase();
  if (!sb) return DEMO_CATEGORIES;

  const { data, error } = await sb
    .from('categories')
    .select('id,name,slug,status')
    .eq('status', 'active')
    .order('name');

  if (error) {
    console.error('Could not load categories from Supabase:', error);
    return [];
  }

  return data || [];
}
