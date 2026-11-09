-- Automatic bucket sorting: Claude can place purchases the plain rules can't, and says why.
alter table allocations drop constraint allocations_source_check;
alter table allocations add constraint allocations_source_check
  check (source in ('auto', 'rule', 'user', 'receipt', 'ai'));
alter table allocations add column reason text;

-- Lets a household turn AI sorting off (it's on by default; it costs no credits).
alter table households add column ai_sorting boolean not null default true;
