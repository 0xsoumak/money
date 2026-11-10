-- Default categories so the app is usable on first login. Rename, recolor or archive freely.
INSERT INTO `categories` (`id`, `name`, `emoji`, `color`, `kind`, `sort_order`) VALUES
  ('01M71R9BSCRVNRH5VKJ2GRD1FJ', 'Food & Dining',     '🍜', 'coral',  'expense', 0),
  ('01M71R9BSHFKYWS8XANCY7QJG9', 'Groceries',         '🛒', 'lime',   'expense', 1),
  ('01M71R9BSHZFVFHDZ72SZRNBAK', 'Transport',         '🚕', 'amber',  'expense', 2),
  ('01M71R9BSH69JWKQY1C4REYDHF', 'Shopping',          '🛍️', 'pink',   'expense', 3),
  ('01M71R9BSH83KKBHK6DR4DZYQ2', 'Bills & Utilities', '💡', 'sky',    'expense', 4),
  ('01M71R9BSH75NAXZVW6BR5VP81', 'Rent & Home',       '🏠', 'indigo', 'expense', 5),
  ('01M71R9BSH9PVTCX2KAPJ1DYA6', 'Health',            '💊', 'mint',   'expense', 6),
  ('01M71R9BSHMFYSHVPB5W6JVNEJ', 'Entertainment',     '🎬', 'violet', 'expense', 7),
  ('01M71R9BSH6YCQFMW67FXZ0S92', 'Travel',            '✈️', 'teal',   'expense', 8),
  ('01M71R9BSHMF8T2Y5RGCHP731R', 'Other',             '📦', 'slate',  'expense', 9),
  ('01M71R9BSHX0JP16RPJRBDDJRZ', 'Salary',            '💼', 'mint',   'income',  0),
  ('01M71R9BSHG15H35VGXBDQT5D4', 'Other income',      '💰', 'amber',  'income',  1);
--> statement-breakpoint
INSERT INTO `settings` (`key`, `value`) VALUES
  ('currency', '"INR"'),
  ('locale', '"en-IN"'),
  ('weekStart', '"monday"');
