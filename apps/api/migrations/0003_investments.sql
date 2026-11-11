-- Investments: money put away (not spending). One bucket per kind of investment, no fund-level detail.
-- `type` / `kind` are plain text columns, so the new value needs no schema change, only starter buckets.
INSERT INTO `categories` (`id`, `name`, `emoji`, `color`, `kind`, `sort_order`) VALUES
  ('01M7R71HFE865V215DE1CTEWH0', 'Mutual funds', '📈', 'lime', 'investment', 0),
  ('01M7RAVNH9DN65R6PPG2X7R5JQ', 'Fixed deposit', '🏦', 'sky', 'investment', 1),
  ('01M7RC42EJ5E6RHXQAQPDH4AFA', 'Stocks', '📊', 'violet', 'investment', 2),
  ('01M7RXRHEM3E2MSH4DMDZSX9G8', 'PPF', '🛡️', 'mint', 'investment', 3),
  ('01M7RFGVSQE8Z5379AV4RRXG07', 'NPS', '🧓', 'teal', 'investment', 4),
  ('01M7RHN7JVAX0GB6KC9QA0MZ17', 'Gold', '🪙', 'amber', 'investment', 5),
  ('01M7RQKF3F55Z488YAGVDCKSQW', 'Other investment', '💎', 'indigo', 'investment', 6);
