# frozen_string_literal: true

module Spaces
  module Broadcasts
    class SettingsChange
      def self.stream_key(space_id:)
        "spaces:#{space_id}"
      end

      def self.currency_changed(
        space:,
        actor:,
        currency:,
        default_transaction_currency: nil
      )
        new.currency_changed(
          space:,
          actor:,
          currency:,
          default_transaction_currency:,
        )
      end

      def currency_changed(
        space:,
        actor:,
        currency:,
        default_transaction_currency: nil
      )
        return if space.blank?

        payload = {
          currency: currency.to_s.upcase,
          space_id: space.id.to_s,
        }
        if default_transaction_currency.present?
          payload[:default_transaction_currency] = default_transaction_currency.to_s.upcase
        end

        Sync::Broadcasts::PublishChange.call(
          op: "space.settings.updated",
          space_id: space.id,
          payload:,
          stream_key: self.class.stream_key(space_id: space.id),
          actor:,
          entity_id: space.id,
          logger_tag: "Spaces::Broadcasts::SettingsChange",
        )
      end
    end
  end
end
