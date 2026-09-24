# frozen_string_literal: true

require "base64"
require "stringio"

module Transactions
  module Operations
    module Tags
      class GenerateTagStyleImage < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:id).value(:string)
            required(:space_id).value(:string)
            required(:prompt).filled(:string, max_size?: 500)
            optional(:user_id).maybe(:string)
          end
        end

        def call(params)
          params = step validate(params:)
          _     = step verify_pro_access(params:)
          tag   = step find_tag(params:)
          tag   = step generate_and_attach_image(tag:, prompt: params[:prompt])

          tag
        end

        private

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def verify_pro_access(params:)
          Finance::ProGate.require!(
            user_id: params[:user_id],
            space_id: params[:space_id],
          )
        end

        def find_tag(params:)
          tag = Transactions::Tag.find_by(id: params[:id], space_id: params[:space_id])
          return Failure(tag: "Not found") unless tag

          Success(tag)
        end

        def generate_and_attach_image(tag:, prompt:)
          b64_json = Ai::Llm::ImageClient.generate(prompt: build_prompt(tag:, user_prompt: prompt))

          image_bytes = Base64.decode64(b64_json)
          tag.update!(style_preset_key: nil)
          tag.style_image.attach(
            io: StringIO.new(image_bytes),
            filename: "tag-style.png",
            content_type: "image/png",
            key: "spaces/#{tag.space_id}/tags/#{tag.id}/style-#{SecureRandom.uuid}.png",
            identify: false,
          )

          Success(tag.reload)
        rescue Ai::Llm::ImageClient::Error => e
          Rails.logger.error "[GenerateTagStyleImage] Image API error: #{e.message}"
          Failure(image: [e.message])
        rescue StandardError => e
          Rails.logger.error "[GenerateTagStyleImage] Error: #{e.class}: #{e.message}"
          Failure(image: [e.message])
        end

        def build_prompt(tag:, user_prompt:)
          <<~PROMPT.squish
            #{user_prompt.strip}
            Flat minimal vector-style illustration for a personal finance app tag themed "#{tag.name}".
            Soft pastel colors, no text, no letters, no watermark.
            Clean shapes suitable as a small decorative panel in a rounded UI pill.
            Horizontal scenic composition with simple layers.
          PROMPT
        end
      end
    end
  end
end
