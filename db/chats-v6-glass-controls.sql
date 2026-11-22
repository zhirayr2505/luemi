BEGIN;

ALTER TABLE luemi_chats.members
 ADD COLUMN notifications_muted boolean NOT NULL DEFAULT false;
GRANT UPDATE (notifications_muted) ON luemi_chats.members TO luemi_chats_writer;

ALTER TABLE luemi_chats.message_marks DROP CONSTRAINT message_marks_emoji_check;
ALTER TABLE luemi_chats.message_marks ADD CONSTRAINT message_marks_emoji_check
 CHECK (emoji IN ('❤️','👍','🔥','🥰','😂','😮','😢','✨','👏','😍','🤩','🙌','🙏','💯','🎉','🤍','💔','🤔','😎','🥹','🤝','👀','🫶','🌹'));

COMMIT;
