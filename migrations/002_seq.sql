ALTER TABLE items ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
UPDATE items SET seq = rowid;
CREATE INDEX items_seq ON items (seq);
