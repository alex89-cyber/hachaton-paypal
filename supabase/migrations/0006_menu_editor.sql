-- ¿Todavía hay? · the owner edits dishes, prices, ingredients and recipes

-- Past sales and reservations point at dishes, so a removed dish or
-- ingredient is archived, not deleted.
alter table dishes add column if not exists archived boolean not null default false;
alter table ingredients add column if not exists archived boolean not null default false;

-- An archived ingredient must not block a new one with the same name.
alter table ingredients drop constraint if exists ingredients_business_id_name_key;
create unique index if not exists ingredients_active_name
  on ingredients (business_id, lower(name)) where not archived;

-- Replaces the menu in one go.
--   p_ingredients: [{"key": "<id or new:N>", "name": "Carne", "unit": "g"}, ...]
--   p_dishes:      [{"id": "<id or null>", "name_es": "...", "name_en": "...", "price_cents": 4500,
--                    "recipe": [{"ingredient": "<key>", "qty": 80}, ...]}, ...]
-- The order of p_dishes is the menu order. Anything left out is archived.
-- A new ingredient starts with no stock: add it with "Surtir" or the opening count.
create or replace function save_menu(p_business uuid, p_ingredients jsonb, p_dishes jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_keys jsonb := '{}'::jsonb;  -- ingredient key -> id
  v_ing jsonb;
  v_dish jsonb;
  v_item jsonb;
  v_id uuid;
  v_kept_ing uuid[] := '{}';
  v_kept_dish uuid[] := '{}';
  v_sort int := 0;
begin
  if not can_manage(p_business) then raise exception 'forbidden'; end if;

  for v_ing in select * from jsonb_array_elements(p_ingredients) loop
    v_id := null;
    if (v_ing->>'key') !~ '^new:' then
      update ingredients set name = v_ing->>'name', unit = v_ing->>'unit', archived = false
      where id = (v_ing->>'key')::uuid and business_id = p_business
      returning id into v_id;
    end if;
    if v_id is null then
      insert into ingredients (business_id, name, unit, stock)
      values (p_business, v_ing->>'name', v_ing->>'unit', 0)
      returning id into v_id;
    end if;
    v_keys := v_keys || jsonb_build_object(v_ing->>'key', v_id::text);
    v_kept_ing := v_kept_ing || v_id;
  end loop;

  update ingredients set archived = true
  where business_id = p_business and not archived and not (id = any (v_kept_ing));

  for v_dish in select * from jsonb_array_elements(p_dishes) loop
    v_sort := v_sort + 1;
    v_id := null;
    if coalesce(v_dish->>'id', '') <> '' then
      update dishes set name_es = v_dish->>'name_es', name_en = v_dish->>'name_en',
        price_cents = (v_dish->>'price_cents')::int, sort = v_sort, archived = false
      where id = (v_dish->>'id')::uuid and business_id = p_business
      returning id into v_id;
    end if;
    if v_id is null then
      insert into dishes (business_id, name_es, name_en, price_cents, sort)
      values (p_business, v_dish->>'name_es', v_dish->>'name_en', (v_dish->>'price_cents')::int, v_sort)
      returning id into v_id;
    end if;
    delete from recipe_items where dish_id = v_id;
    for v_item in select * from jsonb_array_elements(coalesce(v_dish->'recipe', '[]'::jsonb)) loop
      if v_keys ? (v_item->>'ingredient') then
        insert into recipe_items (dish_id, ingredient_id, qty)
        values (v_id, (v_keys->>(v_item->>'ingredient'))::uuid, (v_item->>'qty')::numeric)
        on conflict (dish_id, ingredient_id) do update set qty = excluded.qty;
      end if;
    end loop;
    v_kept_dish := v_kept_dish || v_id;
  end loop;

  update dishes set archived = true
  where business_id = p_business and not archived and not (id = any (v_kept_dish));

  update businesses set updated_at = now() where id = p_business;
end $$;
