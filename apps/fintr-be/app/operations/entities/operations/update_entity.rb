# frozen_string_literal: true

module Entities
  module Operations
    class UpdateEntity < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).filled(:string)
          required(:id).filled(:string)
          optional(:full_name).filled(:string)
          optional(:photo)
          optional(:remove_photo).maybe(:bool)
        end
      end

      def call(params)
        params = step validate(params:)
        entity = step find_entity(params:)
        step update_entity(entity:, params:)
      end

      private

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def find_entity(params:)
        entity = Entities::Entity.find_by(
          id: params[:id],
          space_id: params[:space_id],
        )
        return Failure(id: "not found") unless entity

        Success(entity)
      end

      def update_entity(entity:, params:)
        if params[:full_name].present?
          entity.full_name = params[:full_name]
        end

        remove_photo = ActiveModel::Type::Boolean.new.cast(params[:remove_photo])

        if remove_photo
          entity.photo.purge if entity.photo.attached?
        elsif params[:photo].present?
          attach_photo(entity:, photo: params[:photo])
        end

        entity.save!
        Success(entity)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: entity.errors.to_hash, error: e, expected: true)
      end

      def attach_photo(entity:, photo:)
        Utils::ActiveStorage.attach_file(
          entity.photo,
          photo,
          entity.space_id,
        )
      end
    end
  end
end
