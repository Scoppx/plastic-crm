-- updated_at automatico
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- tabelle ----------
create table public.treatments (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  recall_days int,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.patients (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  first_name     text not null,
  last_name      text not null,
  phone          text not null default '',
  email          text not null default '',
  birth_date     date,
  tags           text[] not null default '{}',
  notes          text not null default '',
  do_not_contact boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.visits (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id   uuid not null references public.patients(id) on delete cascade,
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  date         date not null,
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id   uuid not null references public.patients(id) on delete cascade,
  date         date not null,
  channel      text not null check (channel in ('call', 'whatsapp', 'email')),
  snooze_until date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.settings (
  owner_id            uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  clinic_name         text not null default 'Il mio studio',
  global_dormant_days int not null default 180,
  recall_window_days  int not null default 14,
  snooze_days         int not null default 30,
  templates           jsonb not null,
  updated_at          timestamptz not null default now()
);

-- ---------- indici ----------
create index treatments_owner_idx on public.treatments (owner_id, sort);
create index patients_owner_idx   on public.patients (owner_id);
create index visits_owner_idx     on public.visits (owner_id);
create index visits_patient_idx   on public.visits (patient_id);
create index contacts_owner_idx   on public.contacts (owner_id);
create index contacts_patient_idx on public.contacts (patient_id);

-- ---------- trigger updated_at ----------
create trigger treatments_updated_at before update on public.treatments for each row execute function public.set_updated_at();
create trigger patients_updated_at   before update on public.patients   for each row execute function public.set_updated_at();
create trigger visits_updated_at     before update on public.visits     for each row execute function public.set_updated_at();
create trigger contacts_updated_at   before update on public.contacts   for each row execute function public.set_updated_at();
create trigger settings_updated_at   before update on public.settings   for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.treatments enable row level security;
alter table public.patients   enable row level security;
alter table public.visits     enable row level security;
alter table public.contacts   enable row level security;
alter table public.settings   enable row level security;

create policy "own rows" on public.treatments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own rows" on public.patients   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own rows" on public.visits     for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own rows" on public.contacts   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own rows" on public.settings   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- nuovo utente: settings + trattamenti di default ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.settings (owner_id, templates) values (
    new.id,
    '{"whatsapp": "Ciao {nome}, sono {clinica}. Sono passati circa {mesi} mesi dal tuo ultimo {trattamento}: vuoi prenotare un controllo? Rispondi pure a questo messaggio.", "email": {"subject": "Il tuo prossimo appuntamento da {clinica}", "body": "Gentile {nome},\n\nsono passati circa {mesi} mesi dal tuo ultimo trattamento ({trattamento}). Saremmo felici di rivederti per un controllo.\n\nRispondi a questa email o chiamaci per fissare un appuntamento.\n\nA presto,\n{clinica}"}}'::jsonb
  );
  insert into public.treatments (owner_id, name, recall_days, sort) values
    (new.id, 'Botox', 120, 0),
    (new.id, 'Filler labbra', 270, 1),
    (new.id, 'Filler zigomi', 365, 2),
    (new.id, 'Biorivitalizzazione', 180, 3),
    (new.id, 'Peeling', 90, 4),
    (new.id, 'Rinoplastica', null, 5),
    (new.id, 'Mastoplastica', null, 6),
    (new.id, 'Blefaroplastica', null, 7);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
