# frozen_string_literal: true

module Sync
  module Operations
    class PullChanges < Dry::Operation
      DEFAULT_LIMIT = 500
      MAX_LIMIT = 1_000

      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:since).value(:integer)
          optional(:limit).value(:integer)
        end
      end

      def call(params)
        params = step validate(params:)
        step check_cursor_within_retained_window(params:)
        step fetch_changes(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def check_cursor_within_retained_window(params:)
        oldest_seq = Sync::ChangeLogEntry
          .where(space_id: params[:space_id])
          .minimum(:seq)

        return Success(nil) if oldest_seq.nil?

        if params[:since].positive? && params[:since] < oldest_seq
          return Failure(
            bootstrap_required: true,
            message: "Cursor older than retained change log",
            oldest_available_seq: oldest_seq,
          )
        end

        Success(nil)
      end

      def fetch_changes(params:)
        limit = [params[:limit] || DEFAULT_LIMIT, MAX_LIMIT].min
        oldest_available_seq = Sync::ChangeLogEntry
          .where(space_id: params[:space_id])
          .minimum(:seq)

        scope = Sync::ChangeLogEntry
          .where(space_id: params[:space_id])
          .where("seq > ?", params[:since])
          .order(:seq)
          .limit(limit + 1)

        rows = scope.to_a
        has_more = rows.length > limit
        changes = has_more ? rows.first(limit) : rows
        latest_seq = Sync::SpaceSequence.find_by(space_id: params[:space_id])&.last_seq || 0

        Success(
          since: params[:since],
          latest_seq:,
          oldest_available_seq: oldest_available_seq || 0,
          changes:,
          has_more:,
        )
      end
    end
  end
end
