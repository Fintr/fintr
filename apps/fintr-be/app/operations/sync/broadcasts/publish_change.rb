# frozen_string_literal: true

module Sync
  module Broadcasts
    class PublishChange
      def self.call(**kwargs)
        new(**kwargs).call
      end

      def initialize(
        op:,
        space_id:,
        payload:,
        stream_key:,
        actor: nil,
        entity_id: nil,
        origin_client_mutation_id: nil,
        suppress_actor_toast: false,
        logger_tag: "Sync::Broadcasts::PublishChange"
      )
        @op = op
        @space_id = space_id
        @payload = PayloadHelper.stringify(payload)
        @stream_key = stream_key
        @actor = actor
        @entity_id = entity_id
        @origin_client_mutation_id = origin_client_mutation_id
        @suppress_actor_toast = suppress_actor_toast
        @logger_tag = logger_tag
      end

      def call
        append_result = Sync::Operations::AppendChangeLog.new.call(append_params)
        unless append_result.success?
          Rails.logger.error(
            "[#{@logger_tag}] Failed to append change log: #{append_result.failure}",
          )
          return nil
        end

        entry = append_result.value!
        broadcast_message(entry)
        entry
      rescue StandardError => e
        Rails.logger.error("[#{@logger_tag}] Failed to publish sync_change: #{e.message}")
        nil
      end

      private

      def append_params
        params = {
          space_id: @space_id.to_s,
          op: @op,
          payload: @payload,
        }
        params[:entity_id] = @entity_id.to_s if @entity_id.present?
        params[:actor_user_id] = @actor.id.to_s if @actor.present?
        if @origin_client_mutation_id.present?
          params[:origin_client_mutation_id] = @origin_client_mutation_id
        end
        params
      end

      def broadcast_message(entry)
        message = {
          type: "sync_change",
          seq: entry.seq,
          op: @op,
          space_id: @space_id.to_s,
          occurred_at: entry.created_at.iso8601(3),
          payload: @payload,
        }

        actor_payload = serialize_actor(user: @actor)
        message[:actor] = actor_payload if actor_payload.present?
        message[:suppress_actor_toast] = true if @suppress_actor_toast
        if @origin_client_mutation_id.present?
          message[:origin_client_mutation_id] = @origin_client_mutation_id
        end
        attach_origin_tab_id!(message)

        ActionCable.server.broadcast(
          @stream_key,
          ::Transformers::LowerCamelKeys.transform(message),
        )
      end

      def serialize_actor(user:)
        return if user.blank?

        fresh_user = Auth::User.find_by(id: user.id) || user

        {
          user_id: fresh_user.id.to_s,
          auth_id: fresh_user.auth_id.to_s,
          full_name: fresh_user.full_name.presence || fresh_user.email.to_s,
          photo_url: fresh_user.photo_url,
        }
      end

      def attach_origin_tab_id!(message)
        origin_tab_id = Current.client_tab_id.to_s.strip
        return if origin_tab_id.blank?

        message[:origin_tab_id] = origin_tab_id
      end
    end
  end
end
