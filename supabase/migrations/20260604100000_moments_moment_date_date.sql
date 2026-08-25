-- Store moment_date as DATE (calendar day only — no timezone on the memory date).
-- Safe if column is already DATE or castable from timestamp/text.

alter table public.moments
  alter column moment_date type date
  using (
    case
      when moment_date is null then null
      when moment_date::text ~ '^\d{4}-\d{2}-\d{2}' then (substring(moment_date::text from 1 for 10))::date
      else moment_date::date
    end
  );

comment on column public.moments.moment_date is 'Calendar date of the memory (DATE, no time zone).';
