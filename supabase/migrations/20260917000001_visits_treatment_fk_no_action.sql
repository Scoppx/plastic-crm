-- restrict fires immediately and blocks deleting a user whose treatments still have visits
-- (cascade order). no action is checked at end of statement; direct deletes still fail with 23503.
alter table public.visits drop constraint visits_treatment_id_fkey;
alter table public.visits
  add constraint visits_treatment_id_fkey
  foreign key (treatment_id) references public.treatments(id) on delete no action;
