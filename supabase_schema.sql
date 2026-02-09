-- GPK Suggestions Voting Schema
-- Run this in the Supabase SQL Editor after creating the project.

-- 1. Votes table
create table gpk_votes (
  id            bigint generated always as identity primary key,
  suggestion_id int not null,              -- matches index in suggestions.json
  fingerprint   text not null,             -- browser fingerprint hash (anon)
  vote          smallint not null default 1, -- +1 upvote, -1 downvote
  created_at    timestamptz default now(),
  
  -- Each fingerprint can only vote once per suggestion
  unique (suggestion_id, fingerprint)
);

-- 2. Index for fast aggregation
create index idx_gpk_votes_suggestion on gpk_votes (suggestion_id);

-- 3. View for vote tallies
create or replace view gpk_vote_tallies as
  select
    suggestion_id,
    count(*) filter (where vote = 1)  as upvotes,
    count(*) filter (where vote = -1) as downvotes,
    sum(vote)                         as score
  from gpk_votes
  group by suggestion_id;

-- 4. Row Level Security
alter table gpk_votes enable row level security;

-- Allow anon users to insert votes (upsert handled by unique constraint)
create policy "anon_insert_votes" on gpk_votes
  for insert
  to anon
  with check (true);

-- Allow anon users to read vote tallies (via the view / direct read)
create policy "anon_read_votes" on gpk_votes
  for select
  to anon
  using (true);

-- Allow anon users to update their own vote (change upvote to downvote)
create policy "anon_update_own_vote" on gpk_votes
  for update
  to anon
  using (true)
  with check (true);

-- Allow anon users to delete their own vote (undo)
create policy "anon_delete_own_vote" on gpk_votes
  for delete
  to anon
  using (true);
