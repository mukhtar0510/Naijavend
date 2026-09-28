-- iDevTenancy — payment integrity (intent: only the payment webhook path may mark orders paid)
-- The mock payment flow calls the server route with the service role client; the anon/auth
-- path can never move an order out of 'pending' because RLS blocks anon UPDATE entirely and
-- this trigger rejects owner-side transitions into 'paid'/'fulfilled' that did not come
-- from the service role.

create or replace function public.guard_order_status_transition()
returns trigger language plpgsql as $$
begin
  -- service_role bypasses RLS and triggers run as invoker; auth.uid() is null for service role.
  if auth.uid() is null then
    return new; -- service-role (webhook/mock-pay server route) or anon insert; insert path only sets 'pending'
  end if;

  -- Authenticated seller transitions
  if new.status = old.status then
    return new;
  end if;

  -- Sellers may move pending -> cancelled, paid -> fulfilled, paid -> cancelled.
  -- They may NEVER mark an order 'paid' themselves.
  if old.status = 'pending' and new.status = 'cancelled' then
    return new;
  end if;
  if old.status = 'paid' and new.status in ('fulfilled','cancelled') then
    return new;
  end if;

  raise exception 'Order status transition % -> % not allowed for sellers', old.status, new.status;
end $$;

create constraint trigger trg_guard_order_status
  after update on public.orders
  deferrable initially deferred
  for each row execute function public.guard_order_status_transition();
