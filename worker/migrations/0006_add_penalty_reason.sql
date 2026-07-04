-- Причина штрафу — текстова нотатка офіцера. NULL для старих записів.
ALTER TABLE raid_penalties ADD COLUMN reason TEXT DEFAULT '';
