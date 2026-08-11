# frozen_string_literal: true

require "base64"
require "stringio"

module Entities
  module Operations
    class GenerateEntityPhoto < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:id).value(:string)
          optional(:full_name).maybe(:string)
          optional(:prompt).maybe(:string, max_size?: 500)
          optional(:image_url).maybe(:string)
          optional(:force_generate).maybe(:bool)
        end
      end

      def call(params)
        params = step validate(params:)
        entity = step find_entity(params:)
        merchant_name = params[:full_name].presence || entity.full_name
        image = step resolve_image(
          entity:,
          merchant_name:,
          prompt: params[:prompt],
          image_url: params[:image_url],
          force_generate: params[:force_generate],
        )
        updated_entity = step attach_photo(entity:, image:)

        {
          entity: updated_entity.reload,
          photo_source: image[:source],
        }
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def find_entity(params:)
        entity = Entities::Entity.find_by(
          id: params[:id],
          space_id: params[:space_id],
        )
        return Failure(id: "not found") unless entity

        Success(entity)
      end

      def resolve_image(entity:, merchant_name:, prompt:, image_url:, force_generate:)
        if image_url.present?
          return download_image(image_url:)
        end

        if force_generate
          _ = step verify_paid_subscription(space_id: entity.space_id.to_s)
          return generate_image(entity:, merchant_name:, prompt:)
        end

        find_or_generate_image(entity:, merchant_name:, prompt:)
      end

      def download_image(image_url:)
        image = Entities::MerchantImageFinder.download_image(image_url)
        return Failure(image: ["Could not download the selected image"]) unless image

        Success(image.merge(source: "search"))
      end

      def find_or_generate_image(entity:, merchant_name:, prompt:)
        searched = Entities::MerchantImageFinder.find(
          merchant_name:,
          search_hints: [prompt].compact,
        )
        if searched
          return Success(
            searched.merge(source: "search"),
          )
        end

        _ = step verify_paid_subscription(space_id: entity.space_id.to_s)
        generate_image(entity:, merchant_name:, prompt:)
      end

      def verify_paid_subscription(space_id:)
        has_paid = Finance::SpaceSubscription
                   .active
                   .for_space(space_id)
                   .where(subscription_type: %i[paid sponsor])
                   .exists?

        return Failure(subscription: ["Active paid subscription required to generate a photo"]) unless has_paid

        Success(true)
      end

      def generate_image(entity:, merchant_name:, prompt:)
        b64_json = Ai::Llm::ImageClient.generate(
          prompt: build_prompt(merchant_name:, user_prompt: prompt),
        )

        Success(
          bytes: Base64.decode64(b64_json),
          content_type: "image/png",
          filename: "merchant-photo.png",
          source: "generated",
        )
      rescue Ai::Llm::ImageClient::Error => e
        Rails.logger.error "[GenerateEntityPhoto] Image API error: #{e.message}"
        Failure(image: [e.message])
      rescue StandardError => e
        Rails.logger.error "[GenerateEntityPhoto] Error: #{e.class}: #{e.message}"
        Failure(image: [e.message])
      end

      def attach_photo(entity:, image:)
        entity.photo.purge if entity.photo.attached?

        entity.photo.attach(
          io: StringIO.new(image[:bytes]),
          filename: image[:filename],
          content_type: image[:content_type],
          key: "spaces/#{entity.space_id}/entities/#{entity.id}/photo-#{SecureRandom.uuid}-#{image[:filename]}",
          identify: false,
        )

        Success(entity)
      rescue StandardError => e
        Failure(image: [e.message])
      end

      def build_prompt(merchant_name:, user_prompt:)
        base = user_prompt.presence || "Official brand logo for \"#{merchant_name}\"."

        <<~PROMPT.squish
          #{base.strip}
          Recognizable store or company logo, centered on a plain white background.
          Clean, high-quality, square composition suitable as a small circular avatar.
          No extra text, watermark, or decorative border.
        PROMPT
      end
    end
  end
end
