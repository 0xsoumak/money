-- Fixed costs: categories spent every month regardless of choices (rent, bills, EMIs, family
-- support). Analytics compares flexible spending only. Rent and bills start out fixed; anything
-- else is marked on the Categories page.
ALTER TABLE `categories` ADD `fixed` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `categories` SET `fixed` = 1 WHERE `id` IN ('01M71R9BSH75NAXZVW6BR5VP81', '01M71R9BSH83KKBHK6DR4DZYQ2');
