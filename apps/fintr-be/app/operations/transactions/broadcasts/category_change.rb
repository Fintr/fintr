# frozen_string_literal: true

module Transactions
  module Broadcasts
    class CategoryChange
      def self.stream_key(space_id:)
        TransactionChange.stream_key(space_id:)
      end

      def self.created(category:, actor: nil)
        new.created(category:, actor:)
      end

      def self.updated(category:, actor: nil)
        new.updated(category:, actor:)
      end

      def self.deleted(category_id:, space_id:, actor: nil)
        new.deleted(category_id:, space_id:, actor:)
      end

      def created(category:, actor: nil)
        publish_entity(
          op: "category.created",
          space_id: category.space_id,
          payload: { category: serialize_category(category:) },
          entity_id: category.id,
          actor:,
        )
      end

      def updated(category:, actor: nil)
        publish_entity(
          op: "category.updated",
          space_id: category.space_id,
          payload: { category: serialize_category(category:) },
          entity_id: category.id,
          actor:,
        )
      end

      def deleted(category_id:, space_id:, actor: nil)
        publish_entity(
          op: "category.deleted",
          space_id:,
          payload: { category_id: category_id.to_s },
          entity_id: category_id,
          actor:,
        )
      end

      private

      def publish_entity(op:, space_id:, payload:, entity_id:, actor:)
        Sync::Broadcasts::PublishChange.call(
          op:,
          space_id:,
          payload:,
          stream_key: self.class.stream_key(space_id:),
          actor:,
          entity_id:,
          logger_tag: "Transactions::Broadcasts::CategoryChange",
        )
      end

      def serialize_category(category:)
        {
          id: category.id.to_s,
          name: category.name,
          category_type: category.category_type,
          parent_id: category.parent_id,
          icon: category.icon,
          color: category.color,
        }
      end
    end
  end
end
