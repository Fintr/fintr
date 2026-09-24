# frozen_string_literal: true

module TransactionEditing
  # Process-local editor map for v1 presence.
  # Multi-process cable workers may need a shared store later.
  class PresenceRegistry
    @mutex = Mutex.new
    @editors = Hash.new { |hash, key| hash[key] = {} }

    class << self
      def stream_key(space_id:, transaction_id:)
        "transaction_editing:#{space_id}:#{transaction_id}"
      end

      def start_editing(space_id:, transaction_id:, user:)
        key = stream_key(space_id:, transaction_id:)
        # Reload so we pick up photo_url synced from Auth0 picture claims
        # (ActionCable may serve a cached user row without the avatar).
        fresh_user = Auth::User.find_by(id: user.id) || user
        uid = fresh_user.id.to_s
        entry = {
          "userId" => uid,
          "authId" => fresh_user.auth_id.to_s,
          "fullName" => fresh_user.full_name.presence || fresh_user.email.to_s,
          "photoUrl" => fresh_user.photo_url,
          "startedAt" => Time.current.iso8601,
        }

        @mutex.synchronize do
          existing = @editors[key][uid]
          # Keep original startedAt so the first editor retains edit rights
          # across reconnect / duplicate start_editing calls.
          if existing.present?
            entry["startedAt"] = existing["startedAt"]
          end
          @editors[key][uid] = entry
          @editors[key].values
        end
      end

      def stop_editing(space_id:, transaction_id:, user_id:)
        key = stream_key(space_id:, transaction_id:)
        uid = user_id.to_s

        @mutex.synchronize do
          @editors[key].delete(uid)
          values = @editors[key].values
          @editors.delete(key) if values.empty?
          values
        end
      end

      def editors(space_id:, transaction_id:)
        key = stream_key(space_id:, transaction_id:)
        @mutex.synchronize { @editors[key].values.dup }
      end

      def reset_for_tests!
        @mutex.synchronize { @editors.clear }
      end
    end
  end
end
